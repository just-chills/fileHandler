const { Router } = require('express');
const ctrl = require('../controllers/authController');

const router = Router();

// เส้นทางทั้งหมด mount อยู่ที่ /api/auth/...
router.post('/register',       ctrl.register);       // สมัครสมาชิก
router.post('/login',          ctrl.login);           // เข้าสู่ระบบ
router.post('/refresh',        ctrl.refresh);         // ขอ access token ใหม่
router.post('/logout',         ctrl.logout);          // ออกจากระบบ
router.post('/check-username', ctrl.checkUsername);   // ขอ OTP (ลืมรหัส)
router.post('/verify-otp',     ctrl.verifyOtp);       // ยืนยัน OTP
router.post('/reset-password', ctrl.resetPassword);   // ตั้งรหัสผ่านใหม่

module.exports = router;
