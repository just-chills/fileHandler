const { supabase } = require('../config/supabase');

// ดึงไฟล์ทั้งหมดในระบบพร้อมชื่อเจ้าของ (admin เห็นได้ทุกไฟล์)
async function getFiles(req, res) {
  try {
    const { data, error } = await supabase
      .from('files')
      .select('*, users(username)')
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

    const fileResp = await fetch(data.file_url);
    if (!fileResp.ok) return res.status(500).json({ message: 'Could not fetch file' });

    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(data.filename)}"`);
    res.setHeader('Content-Type', fileResp.headers.get('content-type') || 'application/octet-stream');
    fileResp.body.pipe(res);
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

    const fileResp = await fetch(data.file_url);
    if (!fileResp.ok) return res.status(500).json({ message: 'Could not fetch file' });

    res.setHeader('Content-Type', fileResp.headers.get('content-type') || 'application/octet-stream');
    fileResp.body.pipe(res);
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

// ลบ user ออกจากระบบ – soft delete ไฟล์ทั้งหมดของ user ก่อน แล้วถึงลบ user
async function deleteUser(req, res) {
  try {
    await supabase.from('files').update({ status: 'deleted' }).eq('user_id', req.params.id);
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
