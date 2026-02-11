const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const app = express();
const port = 5000;
app.use(cors()); // อนุญาตให Frontend เรียกใช š šงาน
app.use(express.static('uploads')); // ใหšเขšาถึงไฟลŤที่อัปโหลด
// ตั้งคŠาที่เก็บไฟลŤอัปโหลด
const storage = multer.diskStorage({
 destination: 'uploads/',
 filename: (req, file, cb) => {
 cb(null, file.originalname);
 }
});
const upload = multer({ storage });
// อัปโหลดไฟลŤจาก Client -> Server
app.post('/upload', upload.single('file'), (req, res) => {
 res.json({ message: 'File uploaded successfully', filename: req.file.filename });
});
// แสดงรายการไฟลŤที่มีในเซริŤฟเวอรŤ
app.get('/files', (req, res) => {
 fs.readdir('uploads', (err, files) => {
 if (err) return res.status(500).json({ error: 'Unable to list files' });
 res.json(files);
 });
});
// ใหš Client ดาวนŤโหลดไฟลŤจาก Server
app.get('/download/:filename', (req, res) => {
 const filePath = path.join(__dirname, 'uploads', req.params.filename);
 res.download(filePath);
});
// เริ่มเซิรŤฟเวอรŤ
app.listen(port, () => {
 console.log(`Server running at http://localhost:${port}`);
});