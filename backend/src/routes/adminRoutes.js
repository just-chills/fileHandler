const { Router }                  = require('express');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const ctrl                        = require('../controllers/adminController');

const router = Router();

// ทุก route ใต้นี้ต้อง login และเป็น admin เท่านั้น – mount อยู่ที่ /api/admin/...
router.use(requireAuth, requireAdmin);

// จัดการไฟล์ทั้งหมดในระบบ
router.get('/files',               ctrl.getFiles);      // ดูไฟล์ทั้งหมด
router.get('/files/:id/download',  ctrl.downloadFile);  // โหลดไฟล์
router.get('/files/:id/preview',   ctrl.previewFile);   // เปิดดูไฟล์
router.delete('/files/:id',        ctrl.deleteFile);    // ลบไฟล์

// จัดการ user ในระบบ
router.get('/users',               ctrl.getUsers);      // ดู user ทั้งหมด
router.patch('/users/:id/toggle',  ctrl.toggleUser);    // เปิด/ปิด account
router.patch('/users/:id/unlock',  ctrl.unlockUser);    // ปลดล็อก user
router.delete('/users/:id',        ctrl.deleteUser);    // ลบ user

module.exports = router;
