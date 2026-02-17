const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const app = express();
const port = 5000;

const uploadsDir = path.join(__dirname, 'uploads');

app.use(cors()); // อนุญาตให้ Frontend เรียกใช้งาน
app.use(express.static(uploadsDir)); // ให้เข้าถึงไฟล์ที่อัปโหลด

// ตั้งค้าที่เก็บไฟล์ที่อัปโหลด
const storage = multer.diskStorage({
 destination: uploadsDir,
 filename: (req, file, cb) => {
 cb(null, file.originalname);
 }
});

app.get('/', (req, res) => {
 res.send('Backend eun smoothly');
});

const upload = multer({ storage });

// อัปโหลดไฟล์จาก Client -> Server
app.post('/upload', upload.single('file'), (req, res) => {
 res.json({ message: 'File uploaded successfully', filename: req.file.filename });
});

// แสดงรตัวอย่างไฟล์ที่อัปโหลด
app.get('/file/:filename', (req, res) => {
  const filePath = path.join(uploadsDir, req.params.filename);
  res.sendFile(filePath);
});

// แสดงรายการไฟล์ที่มีในเซิร์ฟเวอร์
app.get('/files', (req, res) => {
 fs.readdir(uploadsDir, (err, files) => {
 if (err) return res.status(500).json({ error: 'Unable to list files' });
 res.json(files);
 });
});

// ให้ Client ดาวน์โหลดไฟล์จาก Server
app.get('/download/:filename', (req, res) => {
 const filePath = path.join(uploadsDir, req.params.filename);
 res.download(filePath);
});

// ลบไฟล์จาก Server
app.delete('/delete/:filename', (req, res) => {
    const filePath = path.join(uploadsDir, req.params.filename);
    fs.unlink(filePath, (err) => {
        if (err) return res.status(500).json({ error: 'Unable to delete file' });
        res.json({ message: 'File deleted successfully' });
    });
})

// เริ่มเซิร์ฟเวอร์
app.listen(port, () => {
 console.log(`Server running at http://localhost:${port}`);
});