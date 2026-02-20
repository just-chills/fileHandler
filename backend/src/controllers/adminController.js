const { supabase } = require('../config/supabase');

// ดึง storage path จาก file_url
function getStoragePath(fileUrl) {
  const marker = '/storage/v1/object/public/files/';
  const idx = fileUrl.indexOf(marker);
  return idx === -1 ? null : fileUrl.slice(idx + marker.length);
}

// แปลง extension ของชื่อไฟล์เป็น mimetype
function getMimeFromFilename(filename) {
  if (!filename) return 'application/octet-stream';
  const ext = filename.split('.').pop().toLowerCase();
  const map = {
    // Images
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
    gif: 'image/gif',  webp: 'image/webp', svg: 'image/svg+xml',
    bmp: 'image/bmp',  ico: 'image/x-icon',
    // Video
    mp4: 'video/mp4', webm: 'video/webm', ogg: 'video/ogg',
    mov: 'video/quicktime', avi: 'video/x-msvideo', mkv: 'video/x-matroska',
    // Audio
    mp3: 'audio/mpeg', wav: 'audio/wav', flac: 'audio/flac', aac: 'audio/aac',
    // Documents
    pdf:  'application/pdf',
    doc:  'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls:  'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ppt:  'application/vnd.ms-powerpoint',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    // Archives
    zip: 'application/zip', rar: 'application/x-rar-compressed',
    '7z': 'application/x-7z-compressed', tar: 'application/x-tar',
    // Text
    txt: 'text/plain', csv: 'text/csv', json: 'application/json',
    xml: 'application/xml', html: 'text/html', css: 'text/css',
    js:  'text/javascript',
  };
  return map[ext] || 'application/octet-stream';
}

// ดึงไฟล์ทั้งหมดในระบบพร้อมชื่อเจ้าของ (admin เห็นได้ทุกไฟล์)
async function getFiles(req, res) {
  try {
    const { data, error } = await supabase
      .from('files')
      .select('*, users(username)')
      .eq('status', 'active')
      .order('id', { ascending: false });

    if (error) return res.status(500).json({ message: error.message });

    const files = (data || []).map(f => ({
      id:            f.id,
      original_name: f.filename,
      mimetype:      getMimeFromFilename(f.filename),
      size:          f.file_size,
      created_at:    f.uploaded_at || null,
      file_url:      f.file_url,
      owner:         f.users?.username || 'anonymous'
    }));

    res.json({ files });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

// admin โหลดไฟล์ได้ทุกไฟล์ ไม่ต้องเช็คเจ้าของ
async function downloadFile(req, res) {
  try {
    const { data, error } = await supabase
      .from('files')
      .select('file_url, filename')
      .eq('id', req.params.id)
      .single();

    if (error || !data) return res.status(404).json({ message: 'File not found' });

    const storagePath = getStoragePath(data.file_url);
    if (!storagePath) return res.status(500).json({ message: 'Invalid file URL' });

    const { data: blob, error: dlErr } = await supabase.storage.from('files').download(storagePath);
    if (dlErr || !blob) return res.status(500).json({ message: dlErr?.message || 'Could not fetch file' });

    const buffer = Buffer.from(await blob.arrayBuffer());
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(data.filename)}"`);
    res.setHeader('Content-Type', blob.type || getMimeFromFilename(data.filename));
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

// admin เปิดดูไฟล์ได้ทุกไฟล์
async function previewFile(req, res) {
  try {
    const { data, error } = await supabase
      .from('files')
      .select('file_url, filename')
      .eq('id', req.params.id)
      .single();

    if (error || !data) return res.status(404).json({ message: 'File not found' });

    const storagePath = getStoragePath(data.file_url);
    if (!storagePath) return res.status(500).json({ message: 'Invalid file URL' });

    const { data: blob, error: dlErr } = await supabase.storage.from('files').download(storagePath);
    if (dlErr || !blob) return res.status(500).json({ message: dlErr?.message || 'Could not fetch file' });

    const buffer = Buffer.from(await blob.arrayBuffer());
    res.setHeader('Content-Type', blob.type || getMimeFromFilename(data.filename));
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

// admin ลบไฟล์ได้ทุกไฟล์ (soft delete)
async function deleteFile(req, res) {
  try {
    const { data, error } = await supabase
      .from('files')
      .update({ status: 'deleted' })
      .eq('id', req.params.id)
      .select('id')
      .single();

    if (error || !data) return res.status(404).json({ message: 'File not found' });
    res.json({ message: 'File deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

// ดึงรายชื่อ user ทั้งหมดในระบบ พร้อม status และ role
async function getUsers(req, res) {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, username, email, role, status, created_at')
      .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ message: error.message });

    const users = (data || []).map(u => ({
      ...u,
      full_name:    u.username,
      is_active:    u.status !== 'disabled',
      locked_until: null
    }));

    res.json({ users });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

// สลับสถานะ user ระหว่าง active ↔ disabled (กดปุ่มเดียวเปิด/ปิดได้เลย)
async function toggleUser(req, res) {
  try {
    const { data: user } = await supabase.from('users').select('status').eq('id', req.params.id).single();
    if (!user) return res.status(404).json({ message: 'User not found' });

    const newStatus = user.status === 'disabled' ? 'active' : 'disabled';
    const { error } = await supabase.from('users').update({ status: newStatus }).eq('id', req.params.id);
    if (error) return res.status(500).json({ message: error.message });

    res.json({ message: `User ${newStatus === 'active' ? 'enabled' : 'disabled'}` });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

// ปลดล็อก user – บังคับเปลี่ยน status กลับเป็น active
async function unlockUser(req, res) {
  try {
    const { error } = await supabase.from('users').update({ status: 'active' }).eq('id', req.params.id);
    if (error) return res.status(500).json({ message: error.message });
    res.json({ message: 'User unlocked' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

// ลบ user ออกจากระบบ – ต้อง hard delete ไฟล์ทั้งหมดก่อน (foreign key constraint)
async function deleteUser(req, res) {
  try {
    // hard delete ไฟล์ทั้งหมดของ user ก่อน เพื่อไม่ให้ FK constraint ขัด
    const { error: filesErr } = await supabase.from('files').delete().eq('user_id', req.params.id);
    if (filesErr) return res.status(500).json({ message: filesErr.message });

    const { error } = await supabase.from('users').delete().eq('id', req.params.id);
    if (error) return res.status(500).json({ message: error.message });
    res.json({ message: 'User deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

module.exports = {
  getFiles, downloadFile, previewFile, deleteFile,
  getUsers, toggleUser, unlockUser, deleteUser
};
