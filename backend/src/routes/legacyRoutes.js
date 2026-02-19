const { Router } = require('express');
const upload     = require('../middleware/upload');
const ctrl       = require('../controllers/legacyController');

const router = Router();

// เส้นทางเดิมที่ไม่ต้อง login – คงไว้เพื่อ backward compatibility
router.get('/test-buckets',       ctrl.testBuckets);                    // ทดสอบ Supabase Storage
router.post('/upload',            upload.single('file'), ctrl.upload);  // อัปโหลดไฟล์
router.get('/files',              ctrl.listFiles);                      // ดูรายการไฟล์
router.get('/download/:fileId',   ctrl.downloadFile);                   // ขอ URL โหลดไฟล์
router.delete('/delete/:fileId',  ctrl.deleteFile);                     // ลบไฟล์
router.get('/view/:fileId',       ctrl.viewFile);                       // เปิดดูไฟล์

module.exports = router;
