const API = window.API_URL || 'http://localhost:5000/api';

// ─── Auth helpers ─────────────────────────────────────────────────────────────

function getToken() { return sessionStorage.getItem('accessToken'); }

function authHeaders(extra = {}) {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}`, ...extra };
}

async function apiFetch(url, opts = {}) {
  const res = await fetch(url, opts);
  if (res.status === 401) {
    // Try refresh
    const rr = await fetch(`${API}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: sessionStorage.getItem('refreshToken') }),
    });
    if (rr.ok) {
      const d = await rr.json();
      sessionStorage.setItem('accessToken', d.accessToken);
      sessionStorage.setItem('refreshToken', d.refreshToken);
      // Retry original with new token
      opts.headers = { ...opts.headers, Authorization: `Bearer ${d.accessToken}` };
      return fetch(url, opts);
    } else {
      sessionStorage.removeItem('accessToken');
      sessionStorage.removeItem('refreshToken');
      sessionStorage.removeItem('user');
      window.location.href = '../../index.html';
    }
  }
  return res;
}

// ─── Guard (primary check is the inline script in <head>; this is a fallback) ──
const user = (() => { try { return JSON.parse(sessionStorage.getItem('user')); } catch { return null; } })();
if (!user || user.role !== 'user') {
  sessionStorage.removeItem('accessToken');
  sessionStorage.removeItem('refreshToken');
  sessionStorage.removeItem('user');
  window.location.replace('../../index.html');
}

document.getElementById('navUsername').textContent = user.full_name || user.username;

document.getElementById('logoutBtn').addEventListener('click', async () => {
  await fetch(`${API}/auth/logout`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ refreshToken: sessionStorage.getItem('refreshToken') }),
  }).catch(() => {});
  sessionStorage.removeItem('accessToken');
  sessionStorage.removeItem('refreshToken');
  sessionStorage.removeItem('user');
  window.location.href = '../../index.html';
});

// ─── File size formatter ──────────────────────────────────────────────────────
function fmtSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function fileIcon(mime) {
  if (!mime) return '📎';
  if (mime.startsWith('image/'))     return '🖼️';
  if (mime.startsWith('video/'))     return '🎬';
  if (mime.startsWith('audio/'))     return '🎵';
  if (mime.includes('pdf'))          return '📄';
  if (mime.includes('spreadsheet') || mime.includes('excel')) return '📊';
  if (mime.includes('word') || mime.includes('document'))     return '📝';
  if (mime.includes('zip') || mime.includes('rar'))           return '🗜️';
  return '📎';
}

// ─── File list helpers ────────────────────────────────────────────────────────
function fileColorClass(mime) {
  if (!mime) return 'bg-slate-100 text-slate-400';
  if (mime.startsWith('image/'))  return 'bg-purple-100 text-purple-500';
  if (mime.startsWith('video/'))  return 'bg-pink-100 text-pink-500';
  if (mime.startsWith('audio/'))  return 'bg-yellow-100 text-yellow-500';
  if (mime.includes('pdf'))       return 'bg-red-100 text-red-500';
  if (mime.includes('spreadsheet') || mime.includes('excel')) return 'bg-green-100 text-green-600';
  if (mime.includes('word') || mime.includes('document'))     return 'bg-blue-100 text-blue-500';
  if (mime.includes('zip') || mime.includes('rar'))           return 'bg-orange-100 text-orange-500';
  return 'bg-slate-100 text-slate-500';
}

function buildRow(f) {
  const row = document.createElement('div');
  row.className = 'flex items-center px-4 py-2.5 hover:bg-slate-50 transition-colors group cursor-default select-none';
  row.dataset.rowId = f.id;
  const date = f.created_at
    ? new Date(f.created_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })
    : '–';
  const colorClass = fileColorClass(f.mimetype);
  row.innerHTML = `
    <div class="w-8 shrink-0 relative">
      <div class="file-icon w-8 h-8 rounded-lg flex items-center justify-center text-base ${colorClass}">${fileIcon(f.mimetype)}</div>
      <input type="checkbox" data-select-id="${f.id}" data-mine="${f.is_mine ? '1' : '0'}"
        class="file-check absolute inset-0 w-full h-full opacity-0 group-hover:opacity-100 cursor-pointer rounded-lg"
        style="accent-color:#2563eb">
    </div>
    <div class="flex-1 min-w-0 ml-3">
      <p class="text-sm font-medium text-slate-800 truncate leading-tight">${f.original_name}</p>
      <p class="text-xs text-slate-400 leading-tight mt-0.5">${f.is_mine ? t('user.you') : '\u{1F464} ' + f.owner}</p>
    </div>
    <p class="w-24 text-xs text-slate-400 text-right hidden sm:block shrink-0">${fmtSize(f.size)}</p>
    <p class="w-32 text-xs text-slate-400 text-right hidden md:block shrink-0">${date}</p>
    <div class="w-24 ml-3 shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
      <button data-id="${f.id}" data-name="${f.original_name}" data-mime="${f.mimetype}" data-url="${f.file_url || ''}" data-action="preview"
        class="p-1.5 rounded-lg hover:bg-slate-200 text-slate-500 transition" title="${t('user.preview_btn')}">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
      </button>
      <button data-id="${f.id}" data-name="${f.original_name}" data-action="download"
        class="p-1.5 rounded-lg hover:bg-blue-100 text-blue-500 transition" title="${t('user.download_btn')}">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
      </button>
      ${f.is_mine ? `
      <button data-id="${f.id}" data-name="${f.original_name}" data-action="delete"
        class="p-1.5 rounded-lg hover:bg-red-100 text-red-500 transition" title="${t('user.delete_btn')}">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
      </button>` : ''}
    </div>`;
  return row;
}

function renderFiles(files) {
  const container = document.getElementById('fileList');
  if (!files.length) {
    container.innerHTML = `<p class="text-slate-400 text-sm text-center py-10">${t('user.no_files')}</p>`;
    selectedIds.clear();
    updateSelectionBar();
    return;
  }
  container.innerHTML = '';
  for (const f of files) container.appendChild(buildRow(f));
  // Restore checked state after re-render
  for (const id of selectedIds) {
    const cb = container.querySelector(`[data-select-id="${id}"]`);
    if (cb) { cb.checked = true; cb.closest('[data-row-id]')?.classList.add('row-selected'); }
  }
  updateSelectionBar();
  container.onchange = (e) => {
    const cb = e.target.closest('[data-select-id]');
    if (!cb) return;
    const id = cb.dataset.selectId;
    if (cb.dataset.mine !== '1') { cb.checked = false; return; }
    const row = cb.closest('[data-row-id]');
    if (cb.checked) { selectedIds.add(id);    row?.classList.add('row-selected'); }
    else            { selectedIds.delete(id); row?.classList.remove('row-selected'); }
    updateSelectionBar();
  };
  container.onclick = (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const { id, name, mime, url, action } = btn.dataset;
    if (action === 'preview')  openPreview(id, name, mime, url);
    if (action === 'download') downloadFile(id, name);
    if (action === 'delete')   deleteFile(id, name);
  };
}

// ─── Multi-select ───────────────────────────────────────────────────────────────
const selectedIds = new Set();

function updateSelectionBar() {
  const bar     = document.getElementById('selectionBar');
  const countEl = document.getElementById('selectionCount');
  const selAll  = document.getElementById('selectAllFiles');
  countEl.textContent = selectedIds.size;
  if (selectedIds.size > 0) {
    bar.classList.remove('hidden'); bar.classList.add('flex');
  } else {
    bar.classList.add('hidden');    bar.classList.remove('flex');
  }
  if (fileCache) {
    const mine = fileCache.filter(f => f.is_mine);
    selAll.checked       = mine.length > 0 && mine.every(f => selectedIds.has(String(f.id)));
    selAll.indeterminate = selectedIds.size > 0 && !selAll.checked;
  }
}

document.getElementById('selectAllFiles').addEventListener('change', (e) => {
  const container = document.getElementById('fileList');
  const cbs = container.querySelectorAll('[data-select-id][data-mine="1"]');
  for (const cb of cbs) {
    cb.checked = e.target.checked;
    const row = cb.closest('[data-row-id]');
    if (e.target.checked) { selectedIds.add(cb.dataset.selectId);    row?.classList.add('row-selected'); }
    else                  { selectedIds.delete(cb.dataset.selectId); row?.classList.remove('row-selected'); }
  }
  updateSelectionBar();
});

document.getElementById('deleteSelectedBtn').addEventListener('click', async () => {
  if (!selectedIds.size) return;
  const count = selectedIds.size;
  const ok = await showConfirm(`ลบ ${count} ไฟล์ที่เลือก?`, 'ลบทั้งหมด');
  if (!ok) return;
  const ids = [...selectedIds];
  selectedIds.clear();
  updateSelectionBar();
  const container = document.getElementById('fileList');
  for (const id of ids) {
    const row = container.querySelector(`[data-row-id="${id}"]`);
    if (row) { row.style.transition = 'opacity 0.15s'; row.style.opacity = '0'; setTimeout(() => row.remove(), 150); }
    if (fileCache) fileCache = fileCache.filter(f => String(f.id) !== String(id));
  }
  const results = await Promise.all(ids.map(id =>
    apiFetch(`${API}/user/files/${id}`, { method: 'DELETE', headers: authHeaders() })
  ));
  if (results.some(r => !r.ok)) {
    await showConfirm('ลบบางไฟล์ไม่สำเร็จ', 'OK');
    loadFiles();
  }
});

// ─── Load File List (stale-while-revalidate) ──────────────────────────────────
let fileCache = null;

async function loadFiles() {
  const container = document.getElementById('fileList');
  // show cache immediately if available
  if (fileCache) {
    renderFiles(fileCache);
  } else {
    container.innerHTML = `<p class="text-slate-400 text-sm text-center py-10">${t('user.loading')}</p>`;
  }
  // fetch fresh data in background
  try {
    const res  = await apiFetch(`${API}/user/files`, { headers: authHeaders() });
    const data = await res.json();
    if (!res.ok) {
      if (!fileCache) container.innerHTML = `<p class="text-red-500 text-sm text-center py-10">${data.message}</p>`;
      return;
    }
    const files = data.files;
    // re-render only when IDs change
    const newIds = files.map(f => f.id).join(',');
    const oldIds = (fileCache || []).map(f => f.id).join(',');
    fileCache = files;
    if (newIds !== oldIds) renderFiles(files);
  } catch (err) {
    if (!fileCache) container.innerHTML = `<p class="text-red-500 text-sm text-center py-10">โหลดไม่สำเร็จ</p>`;
  }
}

document.getElementById('refreshBtn').addEventListener('click', () => {
  selectedIds.clear();
  loadFiles();
});

// ─── Upload ───────────────────────────────────────────────────────────────────
const fileInput   = document.getElementById('fileInput');
const dropZone    = document.getElementById('dropZone');
const dropLabel   = document.getElementById('dropZoneFilename');
const uploadBtn   = document.getElementById('uploadBtn');
const uploadStatus = document.getElementById('uploadStatus');

let selectedFile = null;
let uploadPreviewURL = null;

function fmtSizeUpload(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function clearUploadPreview() {
  if (uploadPreviewURL) { URL.revokeObjectURL(uploadPreviewURL); uploadPreviewURL = null; }
  document.getElementById('uploadPreview').classList.add('hidden');
  document.getElementById('uploadPreviewContent').innerHTML = '';
  selectedFile = null;
  fileInput.value = '';
  dropLabel.classList.add('hidden');
  uploadBtn.disabled = true;
  uploadStatus.textContent = '';
}

function selectFile(file) {
  selectedFile = file;
  dropLabel.textContent = file.name;
  dropLabel.classList.remove('hidden');
  uploadBtn.disabled = false;
  uploadStatus.textContent = '';

  // ── build pre-upload preview ──
  if (uploadPreviewURL) { URL.revokeObjectURL(uploadPreviewURL); uploadPreviewURL = null; }
  uploadPreviewURL = URL.createObjectURL(file);

  const mime = file.type || '';
  document.getElementById('uploadPreviewIcon').textContent = fileIcon(mime);
  document.getElementById('uploadPreviewName').textContent = file.name;
  document.getElementById('uploadPreviewMeta').textContent = fmtSizeUpload(file.size) + (mime ? ' • ' + mime : '');

  const content = document.getElementById('uploadPreviewContent');
  if (mime.startsWith('image/')) {
    content.innerHTML = `<img src="${uploadPreviewURL}" class="max-w-full max-h-56 object-contain rounded" />`;
  } else if (mime.startsWith('video/')) {
    content.innerHTML = `<video src="${uploadPreviewURL}" controls class="max-w-full max-h-56 rounded"></video>`;
  } else if (mime.startsWith('audio/')) {
    content.innerHTML = `<audio src="${uploadPreviewURL}" controls class="w-full"></audio>`;
  } else if (mime === 'application/pdf') {
    content.innerHTML = `<iframe src="${uploadPreviewURL}" class="w-full h-56 rounded border-0"></iframe>`;
  } else {
    content.innerHTML = `<p class="text-slate-500 text-sm py-4">ไม่มี preview สำหรับไฟล์ประเภทนี้</p>`;
  }

  document.getElementById('uploadPreview').classList.remove('hidden');
}

fileInput.addEventListener('change', () => { if (fileInput.files[0]) selectFile(fileInput.files[0]); });
document.getElementById('uploadPreviewClearBtn').addEventListener('click', clearUploadPreview);

dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('border-blue-400', 'bg-blue-50'); });
dropZone.addEventListener('dragleave', () => { dropZone.classList.remove('border-blue-400', 'bg-blue-50'); });
dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('border-blue-400', 'bg-blue-50');
  if (e.dataTransfer.files[0]) selectFile(e.dataTransfer.files[0]);
});

uploadBtn.addEventListener('click', () => {
  if (!selectedFile) return;
  uploadBtn.disabled = true;
  uploadStatus.textContent = '';

  const progressWrap  = document.getElementById('uploadProgressWrap');
  const progressBar   = document.getElementById('uploadProgressBar');
  const progressPct   = document.getElementById('uploadProgressPct');
  const progressLabel = document.getElementById('uploadProgressLabel');
  progressWrap.classList.remove('hidden');
  progressBar.style.width       = '0%';
  progressPct.textContent       = '0%';
  progressLabel.textContent     = t('user.uploading') || 'ส่งไฟล์…';

  let pulseInterval = null;

  function startIndeterminate() {} // unused now

  const form = new FormData();
  form.append('file', selectedFile);

  const xhr = new XMLHttpRequest();
  xhr.open('POST', `${API}/user/files/upload`);
  xhr.setRequestHeader('Authorization', `Bearer ${getToken()}`);

  // phase 1: ติดตาม progress จริงขณะส่ง body ไป backend (0–80%)
  xhr.upload.onprogress = (e) => {
    if (!e.lengthComputable) return;
    const pct = Math.round((e.loaded / e.total) * 80); // 0-80% คือส่งไป backend
    progressBar.style.width = pct + '%';
    progressPct.textContent = pct + '%';
  };

  xhr.upload.onload = () => {
    // ส่งถึง backend แล้ว – รอ Supabase: ค้าง bar ไว้ที่ 80% พร้อม label บอกตัว
    progressBar.style.width  = '80%';
    progressPct.textContent  = '80%';
    progressLabel.textContent = 'บันทึกไฟล์…';
  };

  xhr.onload = () => {
    clearInterval(pulseInterval);
    progressBar.style.width  = '100%';
    progressPct.textContent  = '100%';
    progressLabel.textContent = '';
    setTimeout(() => { progressWrap.classList.add('hidden'); }, 400);

    let data;
    try { data = JSON.parse(xhr.responseText); } catch { data = {}; }

    if (xhr.status < 200 || xhr.status >= 300) {
      uploadStatus.textContent = data.message || t('user.upload_failed');
      uploadStatus.className   = 'text-sm text-red-500';
      uploadBtn.disabled = false;
      return;
    }

    if (uploadPreviewURL) { URL.revokeObjectURL(uploadPreviewURL); uploadPreviewURL = null; }
    document.getElementById('uploadPreview').classList.add('hidden');
    document.getElementById('uploadPreviewContent').innerHTML = '';
    selectedFile    = null;
    fileInput.value = '';
    dropLabel.classList.add('hidden');
    uploadBtn.disabled = true;
    uploadStatus.textContent = t('user.upload_ok');
    uploadStatus.className   = 'text-sm text-green-600';

    if (data.file) {
      if (fileCache) fileCache.unshift(data.file); else fileCache = [data.file];
      renderFiles(fileCache);
      loadFiles();
    } else {
      fileCache = null;
      loadFiles();
    }
  };

  xhr.onerror = () => {
    clearInterval(pulseInterval);
    progressWrap.classList.add('hidden');
    uploadStatus.textContent = t('user.upload_failed');
    uploadStatus.className   = 'text-sm text-red-500';
    uploadBtn.disabled = false;
  };

  xhr.send(form);
});

// ─── Download ─────────────────────────────────────────────────────────────────
async function downloadFile(id, name) {
  const res = await apiFetch(`${API}/user/files/${id}/download`, { headers: authHeaders() });
  if (!res.ok) { console.warn('download failed'); return; }
  const blob = await res.blob();
  const a  = document.createElement('a');
  a.href   = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

// ─── Preview ──────────────────────────────────────────────────────────────────
function openPreview(id, name, mime, fileUrl) {
  document.getElementById('previewFilename').textContent = name;
  const content = document.getElementById('previewContent');
  document.getElementById('previewModal').classList.remove('hidden');

  // Use public Supabase URL directly – instant load, no backend round-trip
  if (fileUrl) { renderPreviewContent(content, fileUrl, name, mime); return; }

  // Fallback: backend proxy (for old entries without file_url in DOM)
  content.innerHTML = `<p class="text-slate-400 text-sm">${t('preview.loading')}</p>`;
  apiFetch(`${API}/user/files/${id}/preview`, { headers: authHeaders() }).then(res => {
    if (!res.ok) { content.innerHTML = `<p class="text-red-500 text-sm">${t('preview.unavailable')}</p>`; return; }
    res.blob().then(blob => renderPreviewContent(content, URL.createObjectURL(blob), name, mime));
  });
}

function renderPreviewContent(content, url, name, mime) {
  if (mime && mime.startsWith('image/')) {
    content.innerHTML = `<img src="${url}" class="max-w-full max-h-[75vh] object-contain rounded" />`;
  } else if (mime === 'application/pdf') {
    content.innerHTML = `<iframe src="${url}" class="w-full h-[75vh] rounded border-0"></iframe>`;
  } else if (mime && mime.startsWith('video/')) {
    content.innerHTML = `<video src="${url}" controls class="max-w-full max-h-[75vh] rounded"></video>`;
  } else if (mime && mime.startsWith('audio/')) {
    content.innerHTML = `<audio src="${url}" controls class="w-full"></audio>`;
  } else {
    content.innerHTML = `<p class="text-slate-500 text-sm">${t('preview.no_preview')} <a href="${url}" download="${name}" class="text-blue-500 underline">${t('preview.download_instead')}</a></p>`;
  }
}

document.getElementById('previewCloseBtn').addEventListener('click', () => {
  document.getElementById('previewModal').classList.add('hidden');
  document.getElementById('previewContent').innerHTML = '';
});
document.getElementById('previewModal').addEventListener('click', (e) => {
  if (e.target === document.getElementById('previewModal')) document.getElementById('previewCloseBtn').click();
});

// ─── Confirm Modal ────────────────────────────────────────────────────────────
function showConfirm(message, btnLabel = 'ยืนยัน') {
  return new Promise((resolve) => {
    const modal  = document.getElementById('confirmModal');
    const msgEl  = document.getElementById('confirmMessage');
    const okBtn  = document.getElementById('confirmOkBtn');
    const cancelBtn = document.getElementById('confirmCancelBtn');
    msgEl.textContent = message;
    okBtn.textContent = btnLabel;
    modal.classList.remove('hidden');
    const cleanup = (result) => {
      modal.classList.add('hidden');
      okBtn.removeEventListener('click', onOk);
      cancelBtn.removeEventListener('click', onCancel);
      resolve(result);
    };
    const onOk     = () => cleanup(true);
    const onCancel = () => cleanup(false);
    okBtn.addEventListener('click', onOk);
    cancelBtn.addEventListener('click', onCancel);
  });
}

// ─── Delete ───────────────────────────────────────────────────────────────────
async function deleteFile(id, name) {
  const ok = await showConfirm(`ลบ “${name}” ออกจากระบบ?`, 'ลบ');
  if (!ok) return;

  // optimistic – ลบ row ออกจาก DOM ทันทีโดยไม่รอ API
  const container = document.getElementById('fileList');
  const row = container.querySelector(`[data-row-id="${id}"]`);
  if (row) { row.style.transition = 'opacity 0.15s'; row.style.opacity = '0'; }
  if (fileCache) fileCache = fileCache.filter(f => String(f.id) !== String(id));
  setTimeout(() => { if (row) row.remove(); }, 150);

  const res  = await apiFetch(`${API}/user/files/${id}`, { method: 'DELETE', headers: authHeaders() });
  const data = await res.json();
  if (!res.ok) {
    fileCache = null;
    loadFiles(); // restore state
  }
}

// ─── Share Modal ──────────────────────────────────────────────────────────────
let shareFileId = null;

async function openShare(id, name) {
  shareFileId = id;
  document.getElementById('shareFilename').textContent = name;
  document.getElementById('shareUsernameInput').value  = '';
  document.getElementById('shareMessage').classList.add('hidden');
  document.getElementById('shareModal').classList.remove('hidden');
  await loadShareList(id);
}

async function loadShareList(id) {
  const res  = await apiFetch(`${API}/user/files/${id}/shares`, { headers: authHeaders() });
  const data = await res.json();
  const el   = document.getElementById('shareCurrentList');

  if (!res.ok || !data.shares.length) {
    el.innerHTML = `<span class="text-xs text-slate-400">${t('share.none')}</span>`;
    return;
  }

  el.innerHTML = '';
  for (const s of data.shares) {
    const chip = document.createElement('span');
    chip.className = 'flex items-center gap-1 bg-blue-50 text-blue-700 text-xs font-medium px-2 py-1 rounded-full';
    chip.innerHTML = `${s.username} <button data-uid="${s.username}" class="text-blue-400 hover:text-red-500 transition font-bold leading-none">×</button>`;
    el.appendChild(chip);
  }

  el.onclick = async (e) => {
    const btn = e.target.closest('[data-uid]');
    if (!btn) return;
    const uname = btn.dataset.uid;
    await apiFetch(`${API}/user/files/${shareFileId}/unshare`, {
      method:  'POST',
      headers: authHeaders(),
      body:    JSON.stringify({ username: uname }),
    });
    await loadShareList(shareFileId);
  };
}

// Autocomplete
const shareInput    = document.getElementById('shareUsernameInput');
const shareDropdown = document.getElementById('shareDropdown');

shareInput.addEventListener('input', async () => {
  const q = shareInput.value.trim();
  if (!q) { shareDropdown.classList.add('hidden'); return; }

  const res  = await apiFetch(`${API}/user/users?q=${encodeURIComponent(q)}`, { headers: authHeaders() });
  const data = await res.json();

  if (!res.ok || !data.users.length) { shareDropdown.classList.add('hidden'); return; }

  shareDropdown.innerHTML = '';
  shareDropdown.classList.remove('hidden');

  for (const u of data.users) {
    const li = document.createElement('li');
    li.className = 'px-4 py-2 hover:bg-blue-50 cursor-pointer text-slate-700';
    li.textContent = `${u.username} (${u.full_name})`;
    li.addEventListener('click', () => {
      shareInput.value = u.username;
      shareDropdown.classList.add('hidden');
    });
    shareDropdown.appendChild(li);
  }
});

document.addEventListener('click', (e) => {
  if (!shareInput.contains(e.target)) shareDropdown.classList.add('hidden');
});

document.getElementById('shareAddBtn').addEventListener('click', async () => {
  const username = shareInput.value.trim();
  const msgEl = document.getElementById('shareMessage');
  if (!username) return;

  const res  = await apiFetch(`${API}/user/files/${shareFileId}/share`, {
    method:  'POST',
    headers: authHeaders(),
    body:    JSON.stringify({ usernames: [username] }),
  });
  const data = await res.json();

  msgEl.classList.remove('hidden');

  if (!res.ok) {
    msgEl.textContent  = data.message || 'Share failed.';
    msgEl.className    = 'text-sm mt-3 text-red-500';
    return;
  }

  if (data.notFound.length) {
    msgEl.textContent = `User "${data.notFound[0]}" not found.`;
    msgEl.className   = 'text-sm mt-3 text-red-500';
    return;
  }

  msgEl.textContent = `Shared with ${data.shared.join(', ')}.`;
  msgEl.className   = 'text-sm mt-3 text-green-600';
  shareInput.value  = '';
  await loadShareList(shareFileId);
});

document.getElementById('shareCloseBtn').addEventListener('click', () => {
  document.getElementById('shareModal').classList.add('hidden');
  shareFileId = null;
});

// ─── WebSocket – real-time sync (secure, JWT auth) ───────────────────────────
function getWsUrl() {
  const base  = (window.API_URL || 'http://localhost:5000/api').replace(/\/api$/, '');
  const proto = base.startsWith('https') ? 'wss' : 'ws';
  return `${proto}${base.slice(base.indexOf(':/'))}/ws`;
}

(function connectWS() {
  const token = getToken();
  if (!token) return; // ยังไม่ล็อกอิน – ข้ามไป

  const ws = new WebSocket(`${getWsUrl()}?token=${encodeURIComponent(token)}`);

  ws.onmessage = (e) => {
    try {
      const msg = JSON.parse(e.data);
      switch (msg.type) {
        case 'file_deleted': {
          if (fileCache) fileCache = fileCache.filter(f => String(f.id) !== String(msg.id));
          const row = document.getElementById('fileList')
            ?.querySelector(`[data-row-id="${msg.id}"]`);
          if (row) {
            row.style.transition = 'opacity 0.15s';
            row.style.opacity = '0';
            setTimeout(() => row.remove(), 150);
          }
          break;
        }
        case 'file_uploaded': {
          // อัปโหลดจากอุปกรณ์อื่น – background refresh
          if (String(msg.userId) === String(user?.id)) loadFiles();
          break;
        }
        case 'user_toggled': {
          // ถ้าบัญชีตัวเองถูก disable – logout
          if (String(msg.userId) === String(user?.id) && msg.status === 'disabled') logout();
          break;
        }
        case 'user_deleted': {
          if (String(msg.userId) === String(user?.id)) logout();
          break;
        }
      }
    } catch {}
  };

  ws.onclose = (e) => {
    if (e.code === 4001) return; // ตรวจไม่ผ่าน auth – ไม่ต้องต่อใหม่
    setTimeout(connectWS, 5000);
  };
  ws.onerror = () => ws.close();
}());
document.getElementById('shareModal').addEventListener('click', (e) => {
  if (e.target === document.getElementById('shareModal')) document.getElementById('shareCloseBtn').click();
});

// ─── Init ─────────────────────────────────────────────────────────────────────
applyI18n();
loadFiles();
