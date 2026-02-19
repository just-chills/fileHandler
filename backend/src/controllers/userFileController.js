const { supabase, supabaseUrl } = require('../config/supabase');

// ดึงรายการไฟล์ทั้งหมดของ user ที่ login อยู่ (เฉพาะ status = active)
async function getFiles(req, res) {
  try {
    const { data, error } = await supabase
      .from('files')
      .select('*')
      .eq('user_id', req.user.id)
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ message: error.message });

    const files = (data || []).map(f => ({
      id:            f.id,
      original_name: f.filename,
      mimetype:      '',
      size:          f.file_size,
      created_at:    f.created_at,
      file_url:      f.file_url,
      is_mine:       true,
      owner:         req.user.username
    }));

    res.json({ files });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

// อัปโหลดไฟล์ไปยัง Supabase Storage แล้วบันทึก metadata ลง DB
async function uploadFile(req, res) {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

    const userId   = req.user.id;
    // ตั้งชื่อไฟล์ใน storage เป็น userId/timestamp-ชื่อไฟล์ เพื่อไม่ให้ชนกัน
    const filename = `${userId}/${Date.now()}-${req.file.originalname}`;

    // อัปโหลด binary ไฟล์ขึ้น Supabase Storage bucket ชื่อ 'files'
    const { error: storageErr } = await supabase.storage
      .from('files')
      .upload(filename, req.file.buffer, { contentType: req.file.mimetype });

    if (storageErr) return res.status(500).json({ message: storageErr.message });

    // สร้าง public URL สำหรับเปิด/โหลดไฟล์
    const fileUrl = `${supabaseUrl}/storage/v1/object/public/files/${filename}`;

    // บันทึก metadata ลงตาราง files ใน DB
    const { error: dbErr } = await supabase.from('files').insert([{
      user_id:   userId,
      filename:  req.file.originalname,
      file_url:  fileUrl,
      file_size: req.file.size,
      status:    'active'
    }]);

    if (dbErr) return res.status(500).json({ message: dbErr.message });

    res.json({ message: 'File uploaded successfully', filename: req.file.originalname });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

// ดาวน์โหลดไฟล์ – ดึงจาก Supabase Storage แล้ว stream กลับให้ browser
// เจ้าของไฟล์หรือ admin เท่านั้นที่โหลดได้
async function downloadFile(req, res) {
  try {
    const { data, error } = await supabase
      .from('files')
      .select('file_url, filename, user_id')
      .eq('id', req.params.id)
      .eq('status', 'active')
      .single();

    if (error || !data) return res.status(404).json({ message: 'File not found' });

    // ตรวจสิทธิ์ – เจ้าของหรือ admin เท่านั้น
    if (data.user_id !== req.user.id && req.user.role !== 'admin')
      return res.status(403).json({ message: 'Access denied' });

    // ดึงไฟล์จาก Supabase Storage แล้ว pipe กลับให้ browser โหลด
    const fileResp = await fetch(data.file_url);
    if (!fileResp.ok) return res.status(500).json({ message: 'Could not fetch file from storage' });

    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(data.filename)}"`);
    res.setHeader('Content-Type', fileResp.headers.get('content-type') || 'application/octet-stream');
    fileResp.body.pipe(res);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

// เปิดดูไฟล์ในหน้าเว็บ – เหมือน download แต่ browser จะแสดงแทนการบังคับโหลด
async function previewFile(req, res) {
  try {
    const { data, error } = await supabase
      .from('files')
      .select('file_url, filename, user_id')
      .eq('id', req.params.id)
      .eq('status', 'active')
      .single();

    if (error || !data) return res.status(404).json({ message: 'File not found' });
    if (data.user_id !== req.user.id && req.user.role !== 'admin')
      return res.status(403).json({ message: 'Access denied' });

    const fileResp = await fetch(data.file_url);
    if (!fileResp.ok) return res.status(500).json({ message: 'Could not fetch file from storage' });

    res.setHeader('Content-Type', fileResp.headers.get('content-type') || 'application/octet-stream');
    fileResp.body.pipe(res);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

// ลบไฟล์แบบ soft delete – เปลี่ยน status เป็น 'deleted' ไม่ได้ลบจริงออกจาก storage
async function deleteFile(req, res) {
  try {
    const { data: file } = await supabase
      .from('files')
      .select('id, user_id')
      .eq('id', req.params.id)
      .eq('status', 'active')
      .single();

    if (!file) return res.status(404).json({ message: 'File not found' });

    // ตรวจสิทธิ์ – เจ้าของหรือ admin เท่านั้น
    if (file.user_id !== req.user.id && req.user.role !== 'admin')
      return res.status(403).json({ message: 'Access denied' });

    await supabase.from('files').update({ status: 'deleted' }).eq('id', req.params.id);
    res.json({ message: 'File deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

// ฟังก์ชัน share ยังไม่ได้ implement – คืนค่าว่างไว้ก่อนเพื่อไม่ให้ frontend พัง
function getShares(req, res)  { res.json({ shares: [] }); }
function shareFile(req, res)  { const { usernames = [] } = req.body; res.json({ shared: usernames, notFound: [] }); }
function unshareFile(req, res) { res.json({ message: 'Unshared' }); }

// ค้นหา user อื่นจาก username (ใช้ใน autocomplete ตอนแชร์ไฟล์)
async function searchUsers(req, res) {
  try {
    const q = (req.query.q || '').trim();
    if (!q) return res.json({ users: [] });

    const { data } = await supabase
      .from('users')
      .select('id, username')
      .ilike('username', `%${q}%`)
      .neq('id', req.user.id)
      .limit(10);

    res.json({ users: data || [] });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

module.exports = {
  getFiles, uploadFile, downloadFile, previewFile, deleteFile,
  getShares, shareFile, unshareFile, searchUsers
};
