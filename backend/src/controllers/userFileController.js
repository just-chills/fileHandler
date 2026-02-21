const { broadcast } = require('../ws');
const { supabase, supabaseUrl } = require('../config/supabase');

// ดึง storage path จาก file_url
function getStoragePath(fileUrl) {
  const marker = '/storage/v1/object/public/files/';
  const idx = fileUrl.indexOf(marker);
  return idx === -1 ? null : fileUrl.slice(idx + marker.length);
}

// แปลง extension เป็น mimetype
function getMimeFromFilename(filename) {
  if (!filename) return 'application/octet-stream';
  const ext = filename.split('.').pop().toLowerCase();
  const map = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
    gif: 'image/gif',  webp: 'image/webp', svg: 'image/svg+xml',
    bmp: 'image/bmp',  ico: 'image/x-icon',
    mp4: 'video/mp4',  webm: 'video/webm', ogg: 'video/ogg',
    mov: 'video/quicktime', avi: 'video/x-msvideo', mkv: 'video/x-matroska',
    mp3: 'audio/mpeg', wav: 'audio/wav', flac: 'audio/flac', aac: 'audio/aac',
    pdf:  'application/pdf',
    doc:  'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls:  'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ppt:  'application/vnd.ms-powerpoint',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    zip: 'application/zip', rar: 'application/x-rar-compressed',
    '7z': 'application/x-7z-compressed', tar: 'application/x-tar',
    txt: 'text/plain', csv: 'text/csv', json: 'application/json',
    xml: 'application/xml', html: 'text/html', css: 'text/css',
    js:  'text/javascript',
  };
  return map[ext] || 'application/octet-stream';
}

// ดึงรายการไฟล์ทั้งหมดของ user ที่ login อยู่ + ไฟล์ที่คนอื่นแชร์มาให้
async function getFiles(req, res) {
  try {
    // 1) & 2) ยิง query คู่ขนานกัน – ไม่ต้องรอทีละอัน
    const [
      { data: own,       error: e1 },
      { data: shareRows, error: e2 },
    ] = await Promise.all([
      supabase
        .from('files')
        .select('id, filename, file_url, file_size, uploaded_at')
        .eq('user_id', req.user.id)
        .eq('status', 'active')
        .order('id', { ascending: false }),
      supabase
        .from('file_shares')
        .select('file_id, owner:owner_id(username)')
        .eq('shared_with_id', req.user.id),
    ]);
    if (e1) return res.status(500).json({ message: e1.message });
    if (e2) return res.status(500).json({ message: e2.message });

    let sharedFiles = [];
    if (shareRows && shareRows.length > 0) {
      const sharedIds = shareRows.map(r => r.file_id);
      const ownerMap  = {};
      shareRows.forEach(r => { ownerMap[r.file_id] = r.owner?.username || '?'; });

      const { data: sf, error: e3 } = await supabase
        .from('files')
        .select('*')
        .in('id', sharedIds)
        .eq('status', 'active');
      if (!e3 && sf) {
        sharedFiles = sf.map(f => ({
          id:            f.id,
          original_name: f.filename,
          mimetype:      getMimeFromFilename(f.filename),
          size:          f.file_size,
          created_at:    f.uploaded_at || null,
          file_url:      f.file_url,
          is_mine:       false,
          owner:         ownerMap[f.id] || '?'
        }));
      }
    }

    const files = [
      ...(own || []).map(f => ({
        id:            f.id,
        original_name: f.filename,
        mimetype:      getMimeFromFilename(f.filename),
        size:          f.file_size,
        created_at:    f.uploaded_at || null,
        file_url:      f.file_url,
        is_mine:       true,
        owner:         req.user.username
      })),
      ...sharedFiles
    ];

    console.log(`[getFiles] user=${req.user.id} own=${(own||[]).length} shared=${sharedFiles.length}`);
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
    // multer อ่าน filename จาก header เป็น latin1 → re-encode กลับเป็น UTF-8 ให้ถูกต้อง
    const originalname = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
    console.log('[upload] originalname:', JSON.stringify(originalname), 'len:', originalname.length);
    // ใช้แค่ timestamp + extension เป็น storage key เพื่อให้สั้น ASCII-safe เสมอ
    const ext        = require('path').extname(originalname) || '';
    const storageKey = `${userId}/${Date.now()}${ext}`;
    console.log('[upload] storageKey:', storageKey, 'len:', storageKey.length);

    // อัปโหลด binary ไฟล์ขึ้น Supabase Storage bucket ชื่อ 'files'
    const { error: storageErr } = await supabase.storage
      .from('files')
      .upload(storageKey, req.file.buffer, { contentType: req.file.mimetype });

    if (storageErr) {
      console.log('[upload] storageErr:', storageErr.message);
      return res.status(500).json({ message: storageErr.message });
    }

    // สร้าง public URL สำหรับเปิด/โหลดไฟล์
    const fileUrl = `${supabaseUrl}/storage/v1/object/public/files/${storageKey}`;
    console.log('[upload] fileUrl len:', fileUrl.length);

    // บันทึก metadata ลงตาราง files ใน DB (เก็บชื่อไฟล์ต้นฉบับที่ decode แล้ว)
    const { data: inserted, error: dbErr } = await supabase.from('files').insert([{
      user_id:   userId,
      filename:  originalname,
      file_url:  fileUrl,
      file_size: req.file.size,
      status:    'active'
    }]).select('id, filename, file_url, file_size, uploaded_at').single();

    if (dbErr) {
      console.log('[upload] dbErr:', dbErr.message);
      return res.status(500).json({ message: dbErr.message });
    }

    const filePayload = {
      id:            inserted.id,
      original_name: inserted.filename,
      mimetype:      getMimeFromFilename(inserted.filename),
      size:          inserted.file_size,
      created_at:    inserted.uploaded_at || null,
      file_url:      inserted.file_url,
      is_mine:       true,
      owner:         req.user.username
    };
    broadcast({ type: 'file_uploaded', file: filePayload, userId: String(userId) },
      c => c.role === 'admin' || c.userId === String(userId));
    res.json({ message: 'File uploaded successfully', file: filePayload });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

// ดาวน์โหลดไฟล์ – ดึงจาก Supabase Storage
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

    // ตรวจสิทธิ์ – เจ้าของ, admin, หรือคนที่ได้รับการแชร์
    if (data.user_id !== req.user.id && req.user.role !== 'admin') {
      const { data: share } = await supabase
        .from('file_shares')
        .select('id')
        .eq('file_id', req.params.id)
        .eq('shared_with_id', req.user.id)
        .maybeSingle();
      if (!share) return res.status(403).json({ message: 'Access denied' });
    }

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
    if (data.user_id !== req.user.id && req.user.role !== 'admin') {
      const { data: share } = await supabase
        .from('file_shares')
        .select('id')
        .eq('file_id', req.params.id)
        .eq('shared_with_id', req.user.id)
        .maybeSingle();
      if (!share) return res.status(403).json({ message: 'Access denied' });
    }

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
    broadcast({ type: 'file_deleted', id: String(req.params.id) });
    res.json({ message: 'File deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

// ดูรายการคนที่ไฟล์นี้ถูกแชร์ให้
async function getShares(req, res) {
  try {
    const fileId = req.params.id;
    // ตรวจว่าเป็นเจ้าของไฟล์
    const { data: file } = await supabase.from('files').select('user_id').eq('id', fileId).single();
    if (!file || file.user_id !== req.user.id)
      return res.status(403).json({ message: 'Access denied' });

    const { data, error } = await supabase
      .from('file_shares')
      .select('shared_with:shared_with_id(username)')
      .eq('file_id', fileId);
    if (error) return res.status(500).json({ message: error.message });

    const shares = (data || []).map(r => ({ username: r.shared_with?.username })).filter(s => s.username);
    res.json({ shares });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

// แชร์ไฟล์ให้ user อื่น
async function shareFile(req, res) {
  try {
    const fileId = Number(req.params.id);
    const { usernames = [] } = req.body;

    // ตรวจว่าเป็นเจ้าของไฟล์
    const { data: file } = await supabase.from('files').select('user_id').eq('id', fileId).single();
    if (!file || file.user_id !== req.user.id)
      return res.status(403).json({ message: 'Access denied' });

    // หา user IDs จาก usernames
    const { data: users } = await supabase
      .from('users')
      .select('id, username')
      .in('username', usernames);

    const foundNames = (users || []).map(u => u.username);
    const notFound   = usernames.filter(n => !foundNames.includes(n));

    if (users && users.length > 0) {
      const rows = users.map(u => ({
        file_id:        fileId,
        owner_id:       req.user.id,
        shared_with_id: u.id
      }));
      // upsert เพื่อไม่ให้ duplicate
      await supabase.from('file_shares').upsert(rows, { onConflict: 'file_id,shared_with_id' });
    }

    res.json({ shared: foundNames, notFound });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

// ยกเลิกการแชร์
async function unshareFile(req, res) {
  try {
    const fileId = Number(req.params.id);
    const { username } = req.body;
    if (!username) return res.status(400).json({ message: 'username required' });

    // ตรวจว่าเป็นเจ้าของไฟล์
    const { data: file } = await supabase.from('files').select('user_id').eq('id', fileId).single();
    if (!file || file.user_id !== req.user.id)
      return res.status(403).json({ message: 'Access denied' });

    // หา user ID
    const { data: user } = await supabase.from('users').select('id').eq('username', username).single();
    if (!user) return res.status(404).json({ message: 'User not found' });

    await supabase.from('file_shares')
      .delete()
      .eq('file_id', fileId)
      .eq('shared_with_id', user.id);

    res.json({ message: 'Unshared' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

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
