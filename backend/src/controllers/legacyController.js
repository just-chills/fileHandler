const { supabase, supabaseUrl } = require('../config/supabase');

// ดู list ของ bucket ทั้งหมดใน Supabase Storage (ใช้ทดสอบการเชื่อมต่อ)
async function testBuckets(req, res) {
  try {
    const { data, error } = await supabase.storage.listBuckets();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ buckets: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// อัปโหลดไฟล์แบบ legacy – ไม่ต้อง login ส่ง user_id มาใน body ได้เลย
async function upload(req, res) {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    // ถ้าไม่ส่ง user_id มา จะเก็บใน folder 'anonymous'
    const userId    = req.body.user_id ? parseInt(req.body.user_id) : null;
    const userIdStr = req.body.user_id || 'anonymous';
    const filename  = `${userIdStr}/${Date.now()}-${req.file.originalname}`;

    const { error } = await supabase.storage
      .from('files')
      .upload(filename, req.file.buffer, { contentType: req.file.mimetype });

    if (error) return res.status(500).json({ error: error.message });

    const fileUrl = `${supabaseUrl}/storage/v1/object/public/files/${filename}`;

    const { error: dbErr } = await supabase.from('files').insert([{
      user_id:   userId,
      filename:  req.file.originalname,
      file_url:  fileUrl,
      file_size: req.file.size,
      mimetype:  req.file.mimetype,
      status:    'active'
    }]);

    if (dbErr) return res.status(500).json({ error: dbErr.message });

    res.json({ message: 'File uploaded successfully', filename: req.file.originalname, file_url: fileUrl });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// ดึงรายการไฟล์ filter ตาม user_id ที่ส่งมาใน query string
// ถ้าไม่ส่ง user_id มา จะคืนไฟล์ทั้งหมด
async function listFiles(req, res) {
  try {
    const userIdParam = req.query.user_id;
    let query = supabase.from('files').select('*').eq('status', 'active');

    if (userIdParam && userIdParam !== '' && userIdParam !== 'anonymous') {
      const uid = parseInt(userIdParam);
      if (isNaN(uid)) return res.status(400).json({ error: 'Invalid user_id' });
      query = query.eq('user_id', uid);
    } else if (!userIdParam) {
      // ไม่ส่ง user_id มา → คืนทุกไฟล์
    } else {
      // user_id = 'anonymous' → คืนไฟล์ที่ไม่มีเจ้าของ
      query = query.is('user_id', null);
    }

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// คืน URL สำหรับโหลดไฟล์ (ไม่ได้ stream ตรงๆ แค่ส่ง URL กลับไป)
async function downloadFile(req, res) {
  try {
    const { data, error } = await supabase
      .from('files')
      .select('file_url')
      .eq('id', req.params.fileId)
      .single();

    if (error || !data) return res.status(404).json({ error: 'File not found' });
    res.json({ download_url: data.file_url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// soft delete ไฟล์ตาม fileId (ไม่ต้อง login)
async function deleteFile(req, res) {
  try {
    const { data, error } = await supabase
      .from('files')
      .update({ status: 'deleted' })
      .eq('id', req.params.fileId)
      .select('id')
      .single();

    if (error || !data) return res.status(404).json({ error: 'File not found' });
    res.json({ message: 'File deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// redirect ไปยัง URL จริงของไฟล์ใน Supabase Storage
async function viewFile(req, res) {
  try {
    const { data, error } = await supabase
      .from('files')
      .select('file_url')
      .eq('id', req.params.fileId)
      .single();

    if (error || !data) return res.status(404).json({ error: 'File not found' });
    res.redirect(data.file_url);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = { testBuckets, upload, listFiles, downloadFile, deleteFile, viewFile };
