const multer  = require('multer');

// เก็บไฟล์ไว้ใน memory (buffer) ไม่บันทึกลง disk
// เพราะจะส่งต่อไปยัง Supabase Storage โดยตรง
const storage = multer.memoryStorage();
const upload  = multer({ storage });

module.exports = upload;
