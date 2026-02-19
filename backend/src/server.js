const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const app = express();
const port = 5000;

// เชื่อม Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// ตั้งค้า multer เก็บไฟล์ในแรม
const storage = multer.memoryStorage();
const upload = multer({ storage });

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
 res.send('Backend running smoothly with Supabase');
});

// ทดสอบ list buckets
app.get('/test-buckets', async (req, res) => {
 try {
  const { data, error } = await supabase.storage.listBuckets();
  if (error) {
   return res.status(500).json({ error: error.message });
  }
  res.json({ buckets: data });
 } catch (error) {
  res.status(500).json({ error: error.message });
 }
});

// ทดสอบ manual insert
app.get('/test-insert', async (req, res) => {
 try {
  const { data, error } = await supabase
   .from('files')
   .insert([
    {
     user_id: null,
     filename: 'test.txt',
     file_url: 'https://example.com/test.txt',
     file_size: 123
    }
   ]);

  if (error) {
   return res.status(500).json({ error: error.message });
  }

  res.json({ message: 'Insert successful', data });
 } catch (error) {
  res.status(500).json({ error: error.message });
 }
});

// อัปโหลดไฟล์ไป Supabase Storage
app.post('/upload', upload.single('file'), async (req, res) => {
 try {
  console.log('Upload request received:', {
   hasFile: !!req.file,
   body: req.body
  });

  if (!req.file) {
   return res.status(400).json({ error: 'No file uploaded' });
  }

  const userId = req.body.user_id ? parseInt(req.body.user_id) : null;
  const userIdStr = req.body.user_id || 'anonymous';
  const filename = `${userIdStr}/${Date.now()}-${req.file.originalname}`;
  
  console.log('Processing file upload:', {
   userId,
   userIdStr,
   filename,
   fileSize: req.file.size
  });
  
  // อัปโหลดไฟล์ไป Supabase Storage
  const { data, error } = await supabase.storage
   .from('files')
   .upload(filename, req.file.buffer, {
    contentType: req.file.mimetype
   });

  if (error) {
   console.error('Supabase storage error:', error);
   return res.status(500).json({ error: error.message });
  }

  // บันทึก metadata ลง Database พร้อม status = 'active'
  const fileUrl = `${supabaseUrl}/storage/v1/object/public/files/${filename}`;
  const { data: dbData, error: dbError } = await supabase
   .from('files')
   .insert([
    {
     user_id: userId, // ใช้ userId ที่เป็น integer หรือ null
     filename: req.file.originalname,
     file_url: fileUrl,
     file_size: req.file.size,
     status: 'active' // เพิ่ม default status
    }
   ]);

  if (dbError) {
   console.error('Supabase database error:', dbError);
   return res.status(500).json({ error: dbError.message });
  }

  console.log('File uploaded successfully:', filename);
  res.json({ 
   message: 'File uploaded successfully', 
   filename: req.file.originalname,
   file_url: fileUrl
  });
 } catch (error) {
  console.error('Upload error:', error);
  res.status(500).json({ error: error.message });
 }
});

// แสดงรายการไฟล์จากฐานข้อมูล (เฉพาะ active files)
app.get('/files', async (req, res) => {
 try {
  const userIdParam = req.query.user_id;
  let userId = null;
  
  // ตรวจสอบและแปลง user_id
  if (userIdParam && userIdParam !== 'anonymous' && userIdParam !== '') {
   const parsedId = parseInt(userIdParam);
   if (isNaN(parsedId)) {
    return res.status(400).json({ error: 'Invalid user_id format. Must be a number.' });
   }
   userId = parsedId;
  }

  // Query ไฟล์จาก Supabase - เฉพาะ active files (ซ่อนไฟล์ที่ลบ)
  let query = supabase.from('files').select('*').eq('status', 'active');
  
  if (userId !== null) {
   query = query.eq('user_id', userId);
  } else {
   query = query.is('user_id', null);
  }

  const { data, error } = await query;

  if (error) {
   console.error('Supabase error:', error);
   return res.status(500).json({ error: error.message });
  }

  res.json(data || []);
 } catch (error) {
  console.error('Server error:', error);
  res.status(500).json({ error: error.message });
 }
});

// ดาวน์โหลดไฟล์จาก Supabase Storage
app.get('/download/:fileId', async (req, res) => {
 try {
  const { data, error } = await supabase
   .from('files')
   .select('file_url')
   .eq('id', req.params.fileId)
   .single();

  if (error || !data) {
   return res.status(404).json({ error: 'File not found' });
  }

  res.json({ download_url: data.file_url });
 } catch (error) {
  res.status(500).json({ error: error.message });
 }
});

// ลบไฟล์ (Soft Delete - แค่เปลี่ยน status เป็น deleted ใน Supabase แต่ไม่ลบจริง)
app.delete('/delete/:fileId', async (req, res) => {
 try {
  const { data, error } = await supabase
   .from('files')
   .update({ status: 'deleted' })
   .eq('id', req.params.fileId)
   .select('id')
   .single();

  if (error || !data) {
   return res.status(404).json({ error: 'File not found' });
  }

  res.json({ message: 'File deleted successfully' });
 } catch (error) {
  res.status(500).json({ error: error.message });
 }
});



// เพิ่ม endpoint สำหรับดูไฟล์โดยตรงผ่าน URL
app.get('/view/:fileId', async (req, res) => {
 try {
  const { data, error } = await supabase
   .from('files')
   .select('file_url, filename')
   .eq('id', req.params.fileId)
   .single();

  if (error || !data) {
   return res.status(404).json({ error: 'File not found' });
  }

  // Redirect ไปยัง actual file URL ใน Supabase Storage
  res.redirect(data.file_url);
 } catch (error) {
  res.status(500).json({ error: error.message });
 }
});

// เริ่มเซิร์ฟเวอร์
app.listen(port, () => {
 console.log(`Server running at http://localhost:${port}`);
});