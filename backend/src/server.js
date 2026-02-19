const express = require('express');
const multer  = require('multer');
const cors    = require('cors');
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');

const app  = express();
const port = process.env.PORT || 5000;

// ─── Supabase ─────────────────────────────────────────────────────────────────
// Strip trailing slash from URL to avoid double-slashes in storage URLs
const supabaseUrl = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const supabaseKey = process.env.SUPABASE_KEY;
const supabase    = createClient(supabaseUrl, supabaseKey);

// ─── JWT config ───────────────────────────────────────────────────────────────
const JWT_SECRET         = process.env.JWT_SECRET         || 'dev_secret_change_me';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'dev_refresh_secret_change_me';
const JWT_EXPIRES        = '15m';
const JWT_REFRESH_EXPIRES = '7d';

// ─── Multer (memory storage) ──────────────────────────────────────────────────
const storage = multer.memoryStorage();
const upload  = multer({ storage });

app.use(cors());
app.use(express.json());

// ─── JWT helpers ──────────────────────────────────────────────────────────────
function signAccess(payload)  { return jwt.sign(payload, JWT_SECRET,         { expiresIn: JWT_EXPIRES }); }
function signRefresh(payload) { return jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: JWT_REFRESH_EXPIRES }); }

// ─── Auth middleware ──────────────────────────────────────────────────────────
async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer '))
    return res.status(401).json({ message: 'Authentication required' });

  try {
    const decoded = jwt.verify(authHeader.slice(7), JWT_SECRET);
    const { data: user, error } = await supabase
      .from('users')
      .select('id, username, full_name, email, role, is_active')
      .eq('id', decoded.id)
      .single();

    if (error || !user || !user.is_active)
      return res.status(401).json({ message: 'Invalid or expired token' });

    req.user = user;
    next();
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
}

function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin')
    return res.status(403).json({ message: 'Admin access required' });
  next();
}

// ─── Health ───────────────────────────────────────────────────────────────────
app.get('/', (req, res) => res.send('Backend running smoothly with Supabase'));

// ════════════════════════════════════════════════════════════════════════════════
// AUTH ROUTES
// ════════════════════════════════════════════════════════════════════════════════

// POST /api/auth/register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, password, full_name, email } = req.body;
    if (!username || !password || !full_name || !email)
      return res.status(400).json({ message: 'All fields are required' });

    // Validate email format
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return res.status(400).json({ message: 'Invalid email format' });

    // Check existing
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .or(`username.eq.${username},email.eq.${email}`)
      .maybeSingle();

    if (existing)
      return res.status(409).json({ message: 'Username or email already taken' });

    const password_hash = await bcrypt.hash(password, 12);

    const { error } = await supabase
      .from('users')
      .insert([{ username, full_name, email, password_hash, role: 'user', is_active: true }]);

    if (error) return res.status(500).json({ message: error.message });

    res.status(201).json({ message: 'Registration successful. You can now log in.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/auth/login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password)
      return res.status(400).json({ message: 'Username and password required' });

    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('username', username)
      .single();

    if (error || !user)
      return res.status(401).json({ message: 'Invalid username or password' });

    if (!user.is_active)
      return res.status(403).json({ message: 'Account is disabled. Contact an admin.' });

    if (user.locked_until && new Date(user.locked_until) > new Date())
      return res.status(403).json({ message: `Account locked until ${new Date(user.locked_until).toLocaleString()}` });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      // Increment failed attempts
      const attempts = (user.failed_login_attempts || 0) + 1;
      const lockUntil = attempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null;
      await supabase.from('users').update({
        failed_login_attempts: attempts,
        locked_until: lockUntil
      }).eq('id', user.id);
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    // Reset failed attempts on success
    await supabase.from('users')
      .update({ failed_login_attempts: 0, locked_until: null })
      .eq('id', user.id);

    const payload = { id: user.id, username: user.username, role: user.role };
    const accessToken  = signAccess(payload);
    const refreshToken = signRefresh(payload);

    // Store refresh token
    await supabase.from('refresh_tokens').insert([{
      user_id: user.id,
      token: refreshToken,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    }]);

    res.json({
      accessToken,
      refreshToken,
      user: {
        id:        user.id,
        username:  user.username,
        full_name: user.full_name,
        email:     user.email,
        role:      user.role
      }
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/auth/refresh
app.post('/api/auth/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken)
      return res.status(401).json({ message: 'Refresh token required' });

    let decoded;
    try {
      decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET);
    } catch {
      return res.status(401).json({ message: 'Invalid refresh token' });
    }

    // Check token exists in DB
    const { data: stored } = await supabase
      .from('refresh_tokens')
      .select('id')
      .eq('token', refreshToken)
      .eq('user_id', decoded.id)
      .maybeSingle();

    if (!stored)
      return res.status(401).json({ message: 'Refresh token revoked' });

    const { data: user } = await supabase
      .from('users')
      .select('id, username, full_name, email, role, is_active')
      .eq('id', decoded.id)
      .single();

    if (!user || !user.is_active)
      return res.status(401).json({ message: 'User not found or disabled' });

    // Rotate tokens
    await supabase.from('refresh_tokens').delete().eq('token', refreshToken);
    const payload       = { id: user.id, username: user.username, role: user.role };
    const newAccess     = signAccess(payload);
    const newRefresh    = signRefresh(payload);
    await supabase.from('refresh_tokens').insert([{
      user_id: user.id,
      token: newRefresh,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    }]);

    res.json({
      accessToken:  newAccess,
      refreshToken: newRefresh,
      user: { id: user.id, username: user.username, full_name: user.full_name, email: user.email, role: user.role }
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/auth/logout
app.post('/api/auth/logout', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (refreshToken)
      await supabase.from('refresh_tokens').delete().eq('token', refreshToken);
    res.json({ message: 'Logged out successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/auth/check-username  (forgot password step 1 – stub, returns success)
app.post('/api/auth/check-username', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: 'Email required' });
  const { data: user } = await supabase.from('users').select('email').eq('email', email).maybeSingle();
  if (!user) return res.status(404).json({ message: 'No account found with that email' });
  // TODO: send real OTP email. For now return a static code stored in DB.
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  await supabase.from('otp_codes').upsert([{
    email,
    code: await bcrypt.hash(otp, 8),
    expires_at: new Date(Date.now() + 10 * 60 * 1000),
    used: false
  }], { onConflict: 'email' });
  console.log(`[DEV] OTP for ${email}: ${otp}`); // remove in production
  res.json({ message: `OTP sent to ${email.replace(/(.{2}).+(@.+)/, '$1***$2')}` });
});

// POST /api/auth/verify-otp
app.post('/api/auth/verify-otp', async (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) return res.status(400).json({ message: 'Email and OTP required' });
  const { data: row } = await supabase.from('otp_codes').select('*').eq('email', email).maybeSingle();
  if (!row || row.used || new Date(row.expires_at) < new Date())
    return res.status(400).json({ message: 'OTP is invalid or expired' });
  const match = await bcrypt.compare(otp, row.code);
  if (!match) return res.status(400).json({ message: 'Incorrect OTP' });
  await supabase.from('otp_codes').update({ used: true }).eq('email', email);
  const resetToken = jwt.sign({ email }, JWT_SECRET, { expiresIn: '10m' });
  res.json({ resetToken });
});

// POST /api/auth/reset-password
app.post('/api/auth/reset-password', async (req, res) => {
  const { resetToken, newPassword } = req.body;
  if (!resetToken || !newPassword) return res.status(400).json({ message: 'All fields required' });
  let decoded;
  try { decoded = jwt.verify(resetToken, JWT_SECRET); } catch { return res.status(401).json({ message: 'Reset token expired or invalid' }); }
  const password_hash = await bcrypt.hash(newPassword, 12);
  const { error } = await supabase.from('users').update({ password_hash, failed_login_attempts: 0, locked_until: null }).eq('email', decoded.email);
  if (error) return res.status(500).json({ message: error.message });
  res.json({ message: 'Password reset successfully' });
});

// ════════════════════════════════════════════════════════════════════════════════
// USER FILE ROUTES  /api/user/...
// ════════════════════════════════════════════════════════════════════════════════

// GET /api/user/files  – list calling user's files
app.get('/api/user/files', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('files')
      .select('*')
      .eq('user_id', req.user.id)
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ message: error.message });

    const files = (data || []).map(f => ({
      id:            f.id,
      original_name: f.filename,
      mimetype:      f.mimetype || '',
      size:          f.file_size,
      created_at:    f.created_at,
      file_url:      f.file_url,
      is_mine:       true,
      owner:         req.user.username
    }));

    res.json({ files });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/user/files/upload
app.post('/api/user/files/upload', requireAuth, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

    const userId   = req.user.id;
    const filename = `${userId}/${Date.now()}-${req.file.originalname}`;

    const { error: storageErr } = await supabase.storage
      .from('files')
      .upload(filename, req.file.buffer, { contentType: req.file.mimetype });

    if (storageErr) return res.status(500).json({ message: storageErr.message });

    const fileUrl = `${supabaseUrl}/storage/v1/object/public/files/${filename}`;

    const { error: dbErr } = await supabase.from('files').insert([{
      user_id:   userId,
      filename:  req.file.originalname,
      file_url:  fileUrl,
      file_size: req.file.size,
      mimetype:  req.file.mimetype,
      status:    'active'
    }]);

    if (dbErr) return res.status(500).json({ message: dbErr.message });

    res.json({ message: 'File uploaded successfully', filename: req.file.originalname });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/user/files/:id/download
app.get('/api/user/files/:id/download', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('files')
      .select('file_url, filename, user_id')
      .eq('id', req.params.id)
      .eq('status', 'active')
      .single();

    if (error || !data) return res.status(404).json({ message: 'File not found' });
    if (data.user_id !== req.user.id && req.user.role !== 'admin')
      return res.status(403).json({ message: 'Access denied' });

    // Proxy the file from Supabase storage so the browser can download it
    const fileResp = await fetch(data.file_url);
    if (!fileResp.ok) return res.status(500).json({ message: 'Could not fetch file from storage' });

    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(data.filename)}"`);
    res.setHeader('Content-Type', fileResp.headers.get('content-type') || 'application/octet-stream');
    fileResp.body.pipe(res);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/user/files/:id/preview
app.get('/api/user/files/:id/preview', requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('files')
      .select('file_url, filename, user_id, mimetype')
      .eq('id', req.params.id)
      .eq('status', 'active')
      .single();

    if (error || !data) return res.status(404).json({ message: 'File not found' });
    if (data.user_id !== req.user.id && req.user.role !== 'admin')
      return res.status(403).json({ message: 'Access denied' });

    const fileResp = await fetch(data.file_url);
    if (!fileResp.ok) return res.status(500).json({ message: 'Could not fetch file from storage' });

    res.setHeader('Content-Type', data.mimetype || fileResp.headers.get('content-type') || 'application/octet-stream');
    fileResp.body.pipe(res);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/user/files/:id
app.delete('/api/user/files/:id', requireAuth, async (req, res) => {
  try {
    const { data: file } = await supabase
      .from('files')
      .select('id, user_id')
      .eq('id', req.params.id)
      .eq('status', 'active')
      .single();

    if (!file) return res.status(404).json({ message: 'File not found' });
    if (file.user_id !== req.user.id && req.user.role !== 'admin')
      return res.status(403).json({ message: 'Access denied' });

    await supabase.from('files').update({ status: 'deleted' }).eq('id', req.params.id);
    res.json({ message: 'File deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/user/files/:id/shares  (stub – sharing not yet implemented)
app.get('/api/user/files/:id/shares', requireAuth, (req, res) => res.json({ shares: [] }));

// POST /api/user/files/:id/share  (stub)
app.post('/api/user/files/:id/share', requireAuth, (req, res) => {
  const { usernames = [] } = req.body;
  res.json({ shared: usernames, notFound: [] });
});

// POST /api/user/files/:id/unshare  (stub)
app.post('/api/user/files/:id/unshare', requireAuth, (req, res) => res.json({ message: 'Unshared' }));

// GET /api/user/users?q=  – search users for share autocomplete
app.get('/api/user/users', requireAuth, async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (!q) return res.json({ users: [] });

    const { data } = await supabase
      .from('users')
      .select('id, username, full_name')
      .ilike('username', `%${q}%`)
      .neq('id', req.user.id)
      .limit(10);

    res.json({ users: data || [] });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ════════════════════════════════════════════════════════════════════════════════
// ADMIN ROUTES  /api/admin/...
// ════════════════════════════════════════════════════════════════════════════════

// GET /api/admin/files  – all active files with owner info
app.get('/api/admin/files', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('files')
      .select('*, users(username)')
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ message: error.message });

    const files = (data || []).map(f => ({
      id:            f.id,
      original_name: f.filename,
      mimetype:      f.mimetype || '',
      size:          f.file_size,
      created_at:    f.created_at,
      file_url:      f.file_url,
      owner:         f.users?.username || 'anonymous'
    }));

    res.json({ files });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/admin/files/:id/download
app.get('/api/admin/files/:id/download', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('files')
      .select('file_url, filename')
      .eq('id', req.params.id)
      .single();

    if (error || !data) return res.status(404).json({ message: 'File not found' });

    const fileResp = await fetch(data.file_url);
    if (!fileResp.ok) return res.status(500).json({ message: 'Could not fetch file' });

    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(data.filename)}"`);
    res.setHeader('Content-Type', fileResp.headers.get('content-type') || 'application/octet-stream');
    fileResp.body.pipe(res);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/admin/files/:id/preview
app.get('/api/admin/files/:id/preview', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('files')
      .select('file_url, filename, mimetype')
      .eq('id', req.params.id)
      .single();

    if (error || !data) return res.status(404).json({ message: 'File not found' });

    const fileResp = await fetch(data.file_url);
    if (!fileResp.ok) return res.status(500).json({ message: 'Could not fetch file' });

    res.setHeader('Content-Type', data.mimetype || fileResp.headers.get('content-type') || 'application/octet-stream');
    fileResp.body.pipe(res);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/admin/files/:id
app.delete('/api/admin/files/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('files')
      .update({ status: 'deleted' })
      .eq('id', req.params.id)
      .select('id')
      .single();

    if (error || !data) return res.status(404).json({ message: 'File not found' });
    res.json({ message: 'File deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/admin/users
app.get('/api/admin/users', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, username, full_name, email, role, is_active, locked_until, created_at')
      .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ message: error.message });
    res.json({ users: data || [] });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PATCH /api/admin/users/:id/toggle  – enable / disable account
app.patch('/api/admin/users/:id/toggle', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { data: user } = await supabase.from('users').select('is_active').eq('id', req.params.id).single();
    if (!user) return res.status(404).json({ message: 'User not found' });

    const { error } = await supabase.from('users').update({ is_active: !user.is_active }).eq('id', req.params.id);
    if (error) return res.status(500).json({ message: error.message });
    res.json({ message: `User ${!user.is_active ? 'enabled' : 'disabled'}` });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PATCH /api/admin/users/:id/unlock  – clear account lock
app.patch('/api/admin/users/:id/unlock', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { error } = await supabase.from('users')
      .update({ locked_until: null, failed_login_attempts: 0 })
      .eq('id', req.params.id);

    if (error) return res.status(500).json({ message: error.message });
    res.json({ message: 'User unlocked' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/admin/users/:id
app.delete('/api/admin/users/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    // Soft-delete all their files first
    await supabase.from('files').update({ status: 'deleted' }).eq('user_id', req.params.id);
    const { error } = await supabase.from('users').delete().eq('id', req.params.id);
    if (error) return res.status(500).json({ message: error.message });
    res.json({ message: 'User deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ════════════════════════════════════════════════════════════════════════════════
// LEGACY / SIMPLE ROUTES (ของเพื่อน – kept for compatibility)
// ════════════════════════════════════════════════════════════════════════════════

// Test Supabase buckets
app.get('/test-buckets', async (req, res) => {
  try {
    const { data, error } = await supabase.storage.listBuckets();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ buckets: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Simple upload (no auth) – user_id as plain integer
app.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const userId    = req.body.user_id ? parseInt(req.body.user_id) : null;
    const userIdStr = req.body.user_id || 'anonymous';
    const filename  = `${userIdStr}/${Date.now()}-${req.file.originalname}`;

    const { error } = await supabase.storage
      .from('files')
      .upload(filename, req.file.buffer, { contentType: req.file.mimetype });

    if (error) return res.status(500).json({ error: error.message });

    const fileUrl = `${supabaseUrl}/storage/v1/object/public/files/${filename}`;

    const { error: dbErr } = await supabase.from('files').insert([{
      user_id:   userId,
      filename:  req.file.originalname,
      file_url:  fileUrl,
      file_size: req.file.size,
      mimetype:  req.file.mimetype,
      status:    'active'
    }]);

    if (dbErr) return res.status(500).json({ error: dbErr.message });

    res.json({ message: 'File uploaded successfully', filename: req.file.originalname, file_url: fileUrl });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Simple file list (no auth) – filter by user_id query param
app.get('/files', async (req, res) => {
  try {
    const userIdParam = req.query.user_id;
    let query = supabase.from('files').select('*').eq('status', 'active');

    if (userIdParam && userIdParam !== '' && userIdParam !== 'anonymous') {
      const uid = parseInt(userIdParam);
      if (isNaN(uid)) return res.status(400).json({ error: 'Invalid user_id' });
      query = query.eq('user_id', uid);
    } else if (!userIdParam) {
      // no filter – return all active files
    } else {
      query = query.is('user_id', null);
    }

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Simple download – returns JSON with download_url
app.get('/download/:fileId', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('files')
      .select('file_url')
      .eq('id', req.params.fileId)
      .single();

    if (error || !data) return res.status(404).json({ error: 'File not found' });
    res.json({ download_url: data.file_url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Simple soft-delete
app.delete('/delete/:fileId', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('files')
      .update({ status: 'deleted' })
      .eq('id', req.params.fileId)
      .select('id')
      .single();

    if (error || !data) return res.status(404).json({ error: 'File not found' });
    res.json({ message: 'File deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Simple view – redirect to file URL
app.get('/view/:fileId', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('files')
      .select('file_url')
      .eq('id', req.params.fileId)
      .single();

    if (error || !data) return res.status(404).json({ error: 'File not found' });
    res.redirect(data.file_url);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// เริ่มเซิร์ฟเวอร์
app.listen(port, () => {
 console.log(`Server running at http://localhost:${port}`);
});