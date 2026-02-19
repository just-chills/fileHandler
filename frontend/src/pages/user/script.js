const API = 'http://localhost:5000/api';

// ─── Auth helpers ─────────────────────────────────────────────────────────────

function getToken() { return localStorage.getItem('accessToken'); }

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
      body: JSON.stringify({ refreshToken: localStorage.getItem('refreshToken') }),
    });
    if (rr.ok) {
      const d = await rr.json();
      localStorage.setItem('accessToken', d.accessToken);
      localStorage.setItem('refreshToken', d.refreshToken);
      // Retry original with new token
      opts.headers = { ...opts.headers, Authorization: `Bearer ${d.accessToken}` };
      return fetch(url, opts);
    } else {
      localStorage.clear();
      window.location.href = '../../index.html';
    }
  }
  return res;
}

// ─── Guard (primary check is the inline script in <head>; this is a fallback) ──
const user = (() => { try { return JSON.parse(localStorage.getItem('user')); } catch { return null; } })();
if (!user || user.role !== 'user') {
  localStorage.clear();
  window.location.replace('../../index.html');
}

document.getElementById('navUsername').textContent = user.full_name || user.username;

document.getElementById('logoutBtn').addEventListener('click', async () => {
  await fetch(`${API}/auth/logout`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ refreshToken: localStorage.getItem('refreshToken') }),
  }).catch(() => {});
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('user');
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

// ─── Load File List ───────────────────────────────────────────────────────────
async function loadFiles() {
  const container = document.getElementById('fileList');
  container.innerHTML = `<p class="text-slate-400 text-sm text-center py-6">${t('user.loading')}</p>`;

  const res  = await apiFetch(`${API}/user/files`, { headers: authHeaders() });
  const data = await res.json();

  if (!res.ok) {
    container.innerHTML = `<p class="text-red-500 text-sm text-center py-6">${data.message}</p>`;
    return;
  }

  const files = data.files;
  if (!files.length) {
    container.innerHTML = `<p class="text-slate-400 text-sm text-center py-6">${t('user.no_files')}</p>`;
    return;
  }

  container.innerHTML = '';
  for (const f of files) {
    const row = document.createElement('div');
    row.className = 'flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition border border-transparent hover:border-slate-200 group';
    row.innerHTML = `
      <span class="text-2xl">${fileIcon(f.mimetype)}</span>
      <div class="flex-1 min-w-0">
        <p class="text-sm font-medium text-slate-800 truncate">${f.original_name}</p>
        <p class="text-xs text-slate-400">${fmtSize(f.size)} &bull; ${f.is_mine ? t('user.you') : '👤 ' + f.owner} &bull; ${new Date(f.created_at).toLocaleDateString()}</p>
      </div>
      <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
        <button data-id="${f.id}" data-name="${f.original_name}" data-mime="${f.mimetype}"
          data-action="preview"
          class="px-2 py-1 text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition">${t('user.preview_btn')}</button>
        <button data-id="${f.id}" data-name="${f.original_name}"
          data-action="download"
          class="px-2 py-1 text-xs bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg transition">${t('user.download_btn')}</button>
        ${f.is_mine ? `
        <button data-id="${f.id}" data-name="${f.original_name}"
          data-action="share"
          class="px-2 py-1 text-xs bg-green-50 hover:bg-green-100 text-green-600 rounded-lg transition">${t('user.share_btn')}</button>
        <button data-id="${f.id}" data-name="${f.original_name}"
          data-action="delete"
          class="px-2 py-1 text-xs bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition">${t('user.delete_btn')}</button>
        ` : ''}
      </div>`;
    container.appendChild(row);
  }

  // delegate events
  container.onclick = (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const { id, name, mime, action } = btn.dataset;
    if (action === 'preview')  openPreview(id, name, mime);
    if (action === 'download') downloadFile(id, name);
    if (action === 'share')    openShare(id, name);
    if (action === 'delete')   deleteFile(id, name);
  };
}

document.getElementById('refreshBtn').addEventListener('click', loadFiles);

// ─── Upload ───────────────────────────────────────────────────────────────────
const fileInput   = document.getElementById('fileInput');
const dropZone    = document.getElementById('dropZone');
const dropLabel   = document.getElementById('dropZoneFilename');
const uploadBtn   = document.getElementById('uploadBtn');
const uploadStatus = document.getElementById('uploadStatus');

let selectedFile = null;

function selectFile(file) {
  selectedFile = file;
  dropLabel.textContent = file.name;
  dropLabel.classList.remove('hidden');
  uploadBtn.disabled = false;
  uploadStatus.textContent = '';
}

fileInput.addEventListener('change', () => { if (fileInput.files[0]) selectFile(fileInput.files[0]); });

dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('border-blue-400', 'bg-blue-50'); });
dropZone.addEventListener('dragleave', () => { dropZone.classList.remove('border-blue-400', 'bg-blue-50'); });
dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('border-blue-400', 'bg-blue-50');
  if (e.dataTransfer.files[0]) selectFile(e.dataTransfer.files[0]);
});

uploadBtn.addEventListener('click', async () => {
  if (!selectedFile) return;
  uploadBtn.disabled = true;
  uploadStatus.textContent = t('user.uploading');
  uploadStatus.className   = 'text-sm text-slate-500';

  const form = new FormData();
  form.append('file', selectedFile);

  const res  = await apiFetch(`${API}/user/files/upload`, {
    method:  'POST',
    headers: { Authorization: `Bearer ${getToken()}` },
    body:    form,
  });
  const data = await res.json();

  if (!res.ok) {
    uploadStatus.textContent = data.message || t('user.upload_failed');
    uploadStatus.className   = 'text-sm text-red-500';
    uploadBtn.disabled = false;
    return;
  }

  uploadStatus.textContent = t('user.upload_ok');
  uploadStatus.className   = 'text-sm text-green-600';
  selectedFile  = null;
  fileInput.value = '';
  dropLabel.classList.add('hidden');
  uploadBtn.disabled = true;
  loadFiles();
});

// ─── Download ─────────────────────────────────────────────────────────────────
async function downloadFile(id, name) {
  const res = await apiFetch(`${API}/user/files/${id}/download`, { headers: authHeaders() });
  if (!res.ok) { alert(t('user.download_failed')); return; }
  const blob = await res.blob();
  const a  = document.createElement('a');
  a.href   = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

// ─── Preview ──────────────────────────────────────────────────────────────────
async function openPreview(id, name, mime) {
  document.getElementById('previewFilename').textContent  = name;
  const content = document.getElementById('previewContent');
  content.innerHTML = `<p class="text-slate-400 text-sm">${t('preview.loading')}</p>`;
  document.getElementById('previewModal').classList.remove('hidden');

  const res = await apiFetch(`${API}/user/files/${id}/preview`, { headers: authHeaders() });
  if (!res.ok) { content.innerHTML = `<p class="text-red-500 text-sm">${t('preview.unavailable')}</p>`; return; }
  const blob = await res.blob();
  const url  = URL.createObjectURL(blob);

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

// ─── Delete ───────────────────────────────────────────────────────────────────
async function deleteFile(id, name) {
  if (!confirm(t('user.delete_confirm').replace('{name}', name))) return;
  const res  = await apiFetch(`${API}/user/files/${id}`, { method: 'DELETE', headers: authHeaders() });
  const data = await res.json();
  if (!res.ok) { alert(data.message || 'Delete failed.'); return; }
  loadFiles();
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
document.getElementById('shareModal').addEventListener('click', (e) => {
  if (e.target === document.getElementById('shareModal')) document.getElementById('shareCloseBtn').click();
});

// ─── Init ─────────────────────────────────────────────────────────────────────
loadFiles();
