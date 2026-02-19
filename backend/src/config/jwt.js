const jwt = require('jsonwebtoken');

// secret key สำหรับเซ็น token (ควรเปลี่ยนใน .env ก่อน deploy จริง)
const JWT_SECRET         = process.env.JWT_SECRET         || 'dev_secret_change_me';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'dev_refresh_secret_change_me';

const JWT_EXPIRES         = '15m'; // access token หมดอายุใน 15 นาที
const JWT_REFRESH_EXPIRES = '7d';  // refresh token หมดอายุใน 7 วัน

// สร้าง access token (อายุสั้น – ใช้เรียก API)
function signAccess(payload)  { return jwt.sign(payload, JWT_SECRET,         { expiresIn: JWT_EXPIRES }); }

// สร้าง refresh token (อายุยาว – ใช้ขอ access token ใหม่โดยไม่ต้อง login ซ้ำ)
function signRefresh(payload) { return jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: JWT_REFRESH_EXPIRES }); }

module.exports = { JWT_SECRET, JWT_REFRESH_SECRET, JWT_EXPIRES, JWT_REFRESH_EXPIRES, signAccess, signRefresh };
