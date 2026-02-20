const multer = require('multer');

const MAX_SIZE_MB = 50; // ขนาดไฟล์สูงสุด (MB)

// เก็บไฟล์ไว้ใน memory (buffer) ไม่บันทึกลง disk
// เพราะจะส่งต่อไปยัง Supabase Storage โดยตรง
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: { fileSize: MAX_SIZE_MB * 1024 * 1024 },
});

module.exports = upload;
