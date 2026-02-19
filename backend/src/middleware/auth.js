const jwt            = require('jsonwebtoken');
const { supabase }   = require('../config/supabase');
const { JWT_SECRET } = require('../config/jwt');

// ตรวจสอบว่า request มี JWT token ที่ถูกต้องหรือไม่
// ถ้าผ่าน จะแนบข้อมูล user ไว้ที่ req.user เพื่อให้ controller ใช้ต่อได้
async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  // ต้องส่ง header มาในรูปแบบ "Bearer <token>"
  if (!authHeader?.startsWith('Bearer '))
    return res.status(401).json({ message: 'Authentication required' });

  try {
    // ถอด token ออกมาแล้วตรวจสอบว่าถูกต้องและยังไม่หมดอายุ
    const decoded = jwt.verify(authHeader.slice(7), JWT_SECRET);

    // ดึงข้อมูล user จาก DB เพื่อเช็คว่ายังมีอยู่และไม่ถูก disable
    const { data: user, error } = await supabase
      .from('users')
      .select('id, username, email, role, status')
      .eq('id', decoded.id)
      .single();

    if (error || !user || user.status === 'disabled')
      return res.status(401).json({ message: 'Invalid or expired token' });

    req.user = user; // แนบ user ไว้ใน request เพื่อให้ middleware/controller ถัดไปใช้ได้
    next();
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
}

// ตรวจสอบว่า user ที่ login อยู่มี role เป็น admin หรือไม่
// ใช้ต่อจาก requireAuth เสมอ
function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin')
    return res.status(403).json({ message: 'Admin access required' });
  next();
}

module.exports = { requireAuth, requireAdmin };
