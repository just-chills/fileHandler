const bcrypt                                          = require('bcryptjs');
const jwt                                             = require('jsonwebtoken');
const { supabase }                                    = require('../config/supabase');
const { JWT_SECRET, JWT_REFRESH_SECRET, signAccess, signRefresh } = require('../config/jwt');

// เก็บ refresh token และ OTP ไว้ใน memory (จะหายเมื่อ server restart)
const activeRefreshTokens = new Map(); // token → { userId, expires }
const activeOtps          = new Map(); // email → { code, expires }

const REFRESH_TTL = 7 * 24 * 60 * 60 * 1000; // อายุ refresh token = 7 วัน (มิลลิวินาที)

// สมัครสมาชิกใหม่ – ตรวจสอบ username/email ซ้ำ แล้ว hash password ก่อนบันทึก
async function register(req, res) {
  try {
    const { username, password, email } = req.body;
    if (!username || !password || !email)
      return res.status(400).json({ message: 'All fields are required' });

    // ตรวจรูปแบบ email เบื้องต้น
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return res.status(400).json({ message: 'Invalid email format' });

    // เช็คว่า username นี้มีคนใช้ไปแล้วหรือยัง
    const { data: byUser } = await supabase.from('users').select('id').eq('username', username).maybeSingle();
    if (byUser) return res.status(409).json({ message: 'Username already taken' });

    // เช็คว่า email นี้มีคนใช้ไปแล้วหรือยัง
    const { data: byEmail } = await supabase.from('users').select('id').eq('email', email).maybeSingle();
    if (byEmail) return res.status(409).json({ message: 'Email already registered' });

    // เข้ารหัส password ด้วย bcrypt (cost factor 12)
    const hashedPassword = await bcrypt.hash(password, 12);
    const { error } = await supabase
      .from('users')
      .insert([{ username, email, password: hashedPassword, role: 'user', status: 'active' }]);

    if (error) return res.status(500).json({ message: error.message });

    res.status(201).json({ message: 'Registration successful. You can now log in.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

// เข้าสู่ระบบ – ตรวจสอบ password แล้วออก access token + refresh token
async function login(req, res) {
  try {
    const { username, password } = req.body;
    if (!username || !password)
      return res.status(400).json({ message: 'Username and password required' });

    // ดึงข้อมูล user จาก DB ด้วย username
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('username', username)
      .single();

    if (error || !user)
      return res.status(401).json({ message: 'Invalid username or password' });

    // เช็คว่า account ถูก disable ไปหรือเปล่า
    if (user.status === 'disabled')
      return res.status(403).json({ message: 'Account is disabled. Contact an admin.' });

    // เปรียบเทียบ password ที่พิมพ์มากับ hash ใน DB
    const valid = await bcrypt.compare(password, user.password);
    if (!valid)
      return res.status(401).json({ message: 'Invalid username or password' });

    // สร้าง token คู่ใหม่ (access + refresh)
    const payload      = { id: user.id, username: user.username, role: user.role };
    const accessToken  = signAccess(payload);
    const refreshToken = signRefresh(payload);

    // บันทึก refresh token ไว้ใน memory
    activeRefreshTokens.set(refreshToken, { userId: user.id, expires: Date.now() + REFRESH_TTL });

    res.json({
      accessToken,
      refreshToken,
      user: {
        id:        user.id,
        username:  user.username,
        full_name: user.username,
        email:     user.email,
        role:      user.role
      }
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

// ขอ access token ใหม่โดยใช้ refresh token (ไม่ต้อง login ใหม่)
async function refresh(req, res) {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken)
      return res.status(401).json({ message: 'Refresh token required' });

    // ตรวจสอบว่า refresh token ถูกต้องและยังไม่หมดอายุ
    let decoded;
    try {
      decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET);
    } catch {
      return res.status(401).json({ message: 'Invalid refresh token' });
    }

    // เช็คว่า token นี้ยังอยู่ใน memory และยังไม่ถูก revoke
    const stored = activeRefreshTokens.get(refreshToken);
    if (!stored || stored.expires < Date.now())
      return res.status(401).json({ message: 'Refresh token revoked or expired' });

    const { data: user } = await supabase
      .from('users')
      .select('id, username, email, role, status')
      .eq('id', decoded.id)
      .single();

    if (!user || user.status === 'disabled')
      return res.status(401).json({ message: 'User not found or disabled' });

    // Rotate token – ลบ token เก่าทิ้ง แล้วออก token คู่ใหม่ให้เลย
    activeRefreshTokens.delete(refreshToken);
    const payload    = { id: user.id, username: user.username, role: user.role };
    const newAccess  = signAccess(payload);
    const newRefresh = signRefresh(payload);
    activeRefreshTokens.set(newRefresh, { userId: user.id, expires: Date.now() + REFRESH_TTL });

    res.json({
      accessToken:  newAccess,
      refreshToken: newRefresh,
      user: { id: user.id, username: user.username, full_name: user.username, email: user.email, role: user.role }
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

// ออกจากระบบ – ลบ refresh token ออกจาก memory ทำให้ใช้ไม่ได้อีก
async function logout(req, res) {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) activeRefreshTokens.delete(refreshToken);
    res.json({ message: 'Logged out successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

// ลืมรหัสผ่าน – รับ email แล้วสร้าง OTP 6 หลัก เก็บไว้ใน memory 10 นาที
// (ในระบบจริงควรส่ง OTP ทาง email แต่ตอนนี้ยัง log ออก console)
async function checkUsername(req, res) {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: 'Email required' });

  // ตรวจว่ามี account ที่ใช้ email นี้จริงไหม
  const { data: user } = await supabase.from('users').select('email').eq('email', email).maybeSingle();
  if (!user) return res.status(404).json({ message: 'No account found with that email' });

  // สุ่ม OTP 6 หลัก แล้วตั้งเวลาหมดอายุ 10 นาที
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  activeOtps.set(email, { code: otp, expires: Date.now() + 10 * 60 * 1000 });
  console.log(`[DEV] OTP for ${email}: ${otp}`);

  res.json({ message: `OTP sent to ${email.replace(/(.{2}).+(@.+)/, '$1***$2')}` });
}

// ยืนยัน OTP – ถ้าถูกต้องจะออก resetToken (JWT อายุ 10 นาที) ให้ใช้ตั้งรหัสใหม่
async function verifyOtp(req, res) {
  const { email, otp } = req.body;
  if (!email || !otp) return res.status(400).json({ message: 'Email and OTP required' });

  const stored = activeOtps.get(email);
  if (!stored || stored.expires < Date.now())
    return res.status(400).json({ message: 'OTP is invalid or expired' });
  if (stored.code !== otp)
    return res.status(400).json({ message: 'Incorrect OTP' });

  // OTP ถูกต้อง – ลบออกจาก memory แล้วส่ง resetToken กลับไป
  activeOtps.delete(email);
  const resetToken = jwt.sign({ email }, JWT_SECRET, { expiresIn: '10m' });
  res.json({ resetToken });
}

// ตั้งรหัสผ่านใหม่ – ต้องใช้ resetToken ที่ได้จาก verifyOtp เท่านั้น
async function resetPassword(req, res) {
  const { resetToken, newPassword } = req.body;
  if (!resetToken || !newPassword)
    return res.status(400).json({ message: 'All fields required' });

  // ตรวจสอบ resetToken ว่ายังใช้ได้อยู่ไหม
  let decoded;
  try {
    decoded = jwt.verify(resetToken, JWT_SECRET);
  } catch {
    return res.status(401).json({ message: 'Reset token expired or invalid' });
  }

  // hash รหัสใหม่แล้วอัปเดตใน DB
  const hashedPassword = await bcrypt.hash(newPassword, 12);
  const { error } = await supabase.from('users').update({ password: hashedPassword }).eq('email', decoded.email);
  if (error) return res.status(500).json({ message: error.message });

  res.json({ message: 'Password reset successfully' });
}

module.exports = { register, login, refresh, logout, checkUsername, verifyOtp, resetPassword };
