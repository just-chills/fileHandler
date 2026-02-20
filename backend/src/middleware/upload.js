const multer = require('multer');
const path   = require('path');

// ประเภทไฟล์ที่อนุญาต
const ALLOWED_EXTENSIONS = new Set([
  // รูปภาพ
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp',
  // เอกสาร
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.csv',
  // วิดีโอ
  '.mp4', '.mov', '.avi', '.mkv', '.webm',
  // เสียง
  '.mp3', '.wav', '.aac', '.flac',
  // บีบอัด
  '.zip', '.rar', '.7z',
]);

const MAX_SIZE_MB = 50; // ขนาดไฟล์สูงสุด (MB)

// เก็บไฟล์ไว้ใน memory (buffer) ไม่บันทึกลง disk
// เพราะจะส่งต่อไปยัง Supabase Storage โดยตรง
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: { fileSize: MAX_SIZE_MB * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ALLOWED_EXTENSIONS.has(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`ไม่รองรับไฟล์ประเภท "${ext}" — ประเภทที่อนุญาต: ${[...ALLOWED_EXTENSIONS].join(', ')}`));
    }
  },
});

module.exports = upload;
