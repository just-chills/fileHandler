const API = window.API_URL || 'http://localhost:5000/api';

// ─── Auth helpers ─────────────────────────────────────────────────────────────

function getToken() { return sessionStorage.getItem('accessToken'); }

function authHeaders(extra = {}) {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}`, ...extra };
}

async function apiFetch(url, opts = {}) {
  const res = await fetch(url, opts);
  if (res.status === 401) {
    const rr = await fetch(`${API}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: sessionStorage.getItem('refreshToken') }),
    });
    if (rr.ok) {
      const d = await rr.json();
      sessionStorage.setItem('accessToken', d.accessToken);
      sessionStorage.setItem('refreshToken', d.refreshToken);
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
if (!user || user.role !== 'admin') {
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

// ─── Tabs ─────────────────────────────────────────────────────────────────────
let activeTab = 'files';

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    activeTab = btn.dataset.tab;
    document.querySelectorAll('.tab-btn').forEach(b => {
      b.className = b.dataset.tab === activeTab
        ? 'tab-btn px-5 py-2 rounded-xl text-sm font-semibold bg-blue-600 text-white transition'
        : 'tab-btn px-5 py-2 rounded-xl text-sm font-semibold bg-white text-slate-500 hover:bg-slate-200 transition';
    });
    document.getElementById('panelFiles').classList.toggle('hidden', activeTab !== 'files');
    document.getElementById('panelUsers').classList.toggle('hidden', activeTab !== 'users');
    if (activeTab === 'files') loadAdminFiles();
    if (activeTab === 'users') loadAdminUsers();
  });
});

// ─── Helpers ─────────────────────────────────────────────────────────────────
function fmtSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
function fileIcon(mime) {
  if (!mime) return '📎';
  if (mime.startsWith('image/'))  return '🖼️';
  if (mime.startsWith('video/'))  return '🎬';
  if (mime.startsWith('audio/'))  return '🎵';
  if (mime.includes('pdf'))       return '📄';
  if (mime.includes('spreadsheet') || mime.includes('excel')) return '📊';
  if (mime.includes('word') || mime.includes('document'))     return '📝';
  if (mime.includes('zip') || mime.includes('rar'))           return '🗜️';
  return '📎';
}

// ─── Files ────────────────────────────────────────────────────────────────────
async function loadAdminFiles() {
  const container = document.getElementById('adminFileList');
  container.innerHTML = `<p class="text-slate-400 text-sm text-center py-6">${t('admin.loading')}</p>`;

  const res  = await apiFetch(`${API}/admin/files`, { headers: authHeaders() });
  const data = await res.json();

  if (!res.ok) {
    container.innerHTML = `<p class="text-red-500 text-sm text-center py-6">${data.message}</p>`;
    return;
  }

  const files = data.files;
  if (!files.length) {
    container.innerHTML = `<p class="text-slate-400 text-sm text-center py-6">${t('admin.no_files')}</p>`;
    return;
  }

  // Group by owner
  const byOwner = {};
  for (const f of files) {
    if (!byOwner[f.owner]) byOwner[f.owner] = [];
    byOwner[f.owner].push(f);
  }

  container.innerHTML = '';
  for (const [owner, ownerFiles] of Object.entries(byOwner)) {
    const section = document.createElement('div');
    section.className = 'mb-4';
    section.innerHTML = `<p class="text-xs font-bold text-slate-500 uppercase mb-2 flex items-center gap-1">👤 ${owner} <span class="text-slate-300 font-normal">(${ownerFiles.length} ${t('admin.file_count')}${ownerFiles.length > 1 && window._lang === 'en' ? 's' : ''})</span></p>`;

    for (const f of ownerFiles) {
      const row = document.createElement('div');
      row.className = 'flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition border border-transparent hover:border-slate-200 group ml-4';
      row.innerHTML = `
        <span class="text-xl">${fileIcon(f.mimetype)}</span>
        <div class="flex-1 min-w-0">
          <p class="text-sm font-medium text-slate-800 truncate">${f.original_name}</p>
          <p class="text-xs text-slate-400">${fmtSize(f.size)} &bull; ${f.created_at ? new Date(f.created_at).toLocaleDateString() : '—'}</p>
        </div>
        <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
          <button data-id="${f.id}" data-name="${f.original_name}" data-mime="${f.mimetype}" data-action="preview"
            class="px-2 py-1 text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg">${t('admin.preview_btn')}</button>
          <button data-id="${f.id}" data-name="${f.original_name}" data-action="download"
            class="px-2 py-1 text-xs bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg">${t('admin.download_btn')}</button>
          <button data-id="${f.id}" data-name="${f.original_name}" data-action="delete"
            class="px-2 py-1 text-xs bg-red-50 hover:bg-red-100 text-red-600 rounded-lg">${t('admin.delete_btn')}</button>
        </div>`;
      section.appendChild(row);
    }
    container.appendChild(section);
  }

  container.onclick = async (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const { id, name, mime, action } = btn.dataset;
    if (action === 'preview')  openPreview(id, name, mime);
    if (action === 'download') adminDownload(id, name);
    if (action === 'delete')   adminDeleteFile(id, name);
  };
}

document.getElementById('refreshFilesBtn').addEventListener('click', loadAdminFiles);

async function adminDownload(id, name) {
  const res = await apiFetch(`${API}/admin/files/${id}/download`, { headers: authHeaders() });
  if (!res.ok) { alert('Download failed.'); return; }
  const blob = await res.blob();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

async function adminDeleteFile(id, name) {
  if (!confirm(t('admin.delete_file_confirm').replace('{name}', name))) return;
  const res  = await apiFetch(`${API}/admin/files/${id}`, { method: 'DELETE', headers: authHeaders() });
  const data = await res.json();
  if (!res.ok) { alert(data.message || 'Delete failed.'); return; }
  loadAdminFiles();
}

// ─── Users ────────────────────────────────────────────────────────────────────
async function loadAdminUsers() {
  const container = document.getElementById('adminUserList');
  container.innerHTML = `<p class="text-slate-400 text-sm text-center py-6">${t('admin.loading')}</p>`;

  const res  = await apiFetch(`${API}/admin/users`, { headers: authHeaders() });
  const data = await res.json();

  if (!res.ok) {
    container.innerHTML = `<p class="text-red-500 text-sm text-center py-6">${data.message}</p>`;
    return;
  }

  const users = data.users;
  if (!users.length) {
    container.innerHTML = `<p class="text-slate-400 text-sm text-center py-6">${t('admin.no_users')}</p>`;
    return;
  }

  container.innerHTML = '';
  for (const u of users) {
    const isMe   = u.id === user.id;
    const locked = u.locked_until && new Date(u.locked_until) > new Date();

    const card = document.createElement('div');
    card.className = `flex flex-wrap items-center gap-3 p-4 rounded-xl border ${u.is_active ? 'border-slate-200 bg-white' : 'border-red-100 bg-red-50'} transition`;
    card.innerHTML = `
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2 flex-wrap">
          <p class="font-semibold text-slate-800 text-sm">${u.username}</p>
          <span class="text-xs px-2 py-0.5 rounded-full font-medium ${u.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-blue-50 text-blue-600'}">${u.role}</span>
          ${!u.is_active ? `<span class="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-600 font-medium">${t('admin.badge_disabled')}</span>` : ''}
          ${locked ? `<span class="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-600 font-medium">${t('admin.badge_locked')}</span>` : ''}
          ${isMe ? `<span class="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">${t('admin.badge_you')}</span>` : ''}
        </div>
        <p class="text-xs text-slate-400 mt-0.5">${u.full_name} &bull; ${t('admin.joined')} ${new Date(u.created_at).toLocaleDateString()}</p>
      </div>
      ${!isMe ? `
      <div class="flex items-center gap-2 flex-wrap">
        <button data-uid="${u.id}" data-uname="${u.username}" data-action="toggle"
          class="px-3 py-1.5 text-xs font-semibold rounded-lg transition ${u.is_active ? 'bg-orange-50 hover:bg-orange-100 text-orange-600' : 'bg-green-50 hover:bg-green-100 text-green-600'}">
          ${u.is_active ? t('admin.disable_btn') : t('admin.enable_btn')}
        </button>
        ${locked ? `<button data-uid="${u.id}" data-action="unlock"
          class="px-3 py-1.5 text-xs font-semibold bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg transition">${t('admin.unlock_btn')}</button>` : ''}
        <button data-uid="${u.id}" data-uname="${u.username}" data-action="delete"
          class="px-3 py-1.5 text-xs font-semibold bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition">${t('admin.delete_user_btn')}</button>
      </div>` : ''}`;
    container.appendChild(card);
  }

  container.onclick = async (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const { uid, uname, action, role } = btn.dataset;
    if (action === 'toggle') await adminToggleUser(uid, uname);
    if (action === 'unlock') await adminUnlockUser(uid);
    if (action === 'delete') await adminDeleteUser(uid, uname);
  };
}

document.getElementById('refreshUsersBtn').addEventListener('click', loadAdminUsers);

async function adminToggleUser(id, uname) {
  if (!confirm(t('admin.toggle_confirm').replace('{uname}', uname))) return;
  const res  = await apiFetch(`${API}/admin/users/${id}/toggle`, { method: 'PATCH', headers: authHeaders() });
  const data = await res.json();
  if (!res.ok) { alert(data.message || 'Failed.'); return; }
  loadAdminUsers();
}

async function adminUnlockUser(id) {
  const res  = await apiFetch(`${API}/admin/users/${id}/unlock`, { method: 'PATCH', headers: authHeaders() });
  const data = await res.json();
  if (!res.ok) { alert(data.message || 'Failed.'); return; }
  loadAdminUsers();
}

async function adminDeleteUser(id, uname) {
  if (!confirm(t('admin.delete_user_confirm').replace('{uname}', uname))) return;
  const res  = await apiFetch(`${API}/admin/users/${id}`, { method: 'DELETE', headers: authHeaders() });
  const data = await res.json();
  if (!res.ok) { alert(data.message || 'Failed.'); return; }
  loadAdminUsers();
}

// ─── Preview ──────────────────────────────────────────────────────────────────
async function openPreview(id, name, mime) {
  document.getElementById('previewFilename').textContent = name;
  const content = document.getElementById('previewContent');
  content.innerHTML = `<p class="text-slate-400 text-sm">${t('preview.loading')}</p>`;
  document.getElementById('previewModal').classList.remove('hidden');

  const res = await apiFetch(`${API}/admin/files/${id}/preview`, { headers: authHeaders() });
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

// ─── Init ─────────────────────────────────────────────────────────────────────
applyI18n();
loadAdminFiles();

