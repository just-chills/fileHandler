const { Router }       = require('express');
const { requireAuth }  = require('../middleware/auth');
const upload           = require('../middleware/upload');
const ctrl             = require('../controllers/userFileController');

const router = Router();

// ทุก route ต้อง login ก่อน (requireAuth) – mount อยู่ที่ /api/user/...
router.get('/files',                requireAuth, ctrl.getFiles);                          // ดูไฟล์ของตัวเอง
router.post('/files/upload',        requireAuth, upload.single('file'), ctrl.uploadFile); // อัปโหลดไฟล์
router.get('/files/:id/download',   requireAuth, ctrl.downloadFile);                      // ดาวน์โหลดไฟล์
router.get('/files/:id/preview',    requireAuth, ctrl.previewFile);                       // เปิดดูไฟล์
router.delete('/files/:id',         requireAuth, ctrl.deleteFile);                        // ลบไฟล์
router.get('/files/:id/shares',     requireAuth, ctrl.getShares);                         // ดูรายการที่แชร์
router.post('/files/:id/share',     requireAuth, ctrl.shareFile);                         // แชร์ไฟล์
router.post('/files/:id/unshare',   requireAuth, ctrl.unshareFile);                       // ยกเลิกแชร์

// ค้นหา user สำหรับ autocomplete ตอนแชร์ไฟล์
router.get('/users',                requireAuth, ctrl.searchUsers);

module.exports = router;
