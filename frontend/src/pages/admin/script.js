const API = window.API_URL || 'http://localhost:5000/api';

// ─── Auth helpers ─────────────────────────────────────────────────────────────

function getToken() { return sessionStorage.getItem('accessToken'); }

function authHeaders(extra = {}) {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}`, ...extra };
}

async function apiFetch(url, opts = {}, timeoutMs = 20000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  let res;
  try {
    res = await fetch(url, { ...opts, signal: ctrl.signal });
  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') throw Object.assign(new Error('Request timed out'), { isTimeout: true });
    throw err;
  }
  clearTimeout(timer);
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

// ─── Confirm Modal ────────────────────────────────────────────────────────────
function showConfirm(message, btnLabel = 'ยืนยัน') {
  return new Promise((resolve) => {
    const modal     = document.getElementById('confirmModal');
    const msgEl     = document.getElementById('confirmMessage');
    const okBtn     = document.getElementById('confirmOkBtn');
    const cancelBtn = document.getElementById('confirmCancelBtn');
    msgEl.textContent  = message;
    okBtn.textContent  = btnLabel;
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

// ─── Files ────────────────────────────────────────────────────────────────────
const PAGE_SIZE = 10;
const ownerPages = {};
let adminByOwner = {};  // module-scope cache – accessible by SSE handler

function renderOwnerSection(container, owner, ownerFiles, allFiles) {
  const PAGE = ownerPages[owner] || 0;
  const totalPages = Math.ceil(ownerFiles.length / PAGE_SIZE);
  const slice = ownerFiles.slice(PAGE * PAGE_SIZE, (PAGE + 1) * PAGE_SIZE);

  // Find or create section
  let section = container.querySelector(`[data-owner-section="${CSS.escape(owner)}"]`);
  const isNew = !section;
  if (isNew) {
    section = document.createElement('div');
    section.className = 'border border-slate-100 rounded-xl overflow-hidden';
    section.dataset.ownerSection = owner;
    container.appendChild(section);
  }

  // Determine if expanded (default: collapsed)
  const wasExpanded = section.querySelector('[data-rows-wrap]') &&
    !section.querySelector('[data-rows-wrap]').classList.contains('hidden');
  const expanded = isNew ? false : wasExpanded;

  section.innerHTML = '';

  // ── Accordion header ──
  const header = document.createElement('button');
  header.type = 'button';
  header.className = 'w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition text-left';
  header.innerHTML = `
    <span class="flex items-center gap-2 text-sm font-semibold text-slate-700">
      <span>👤</span>
      <span>${owner}</span>
      <span class="text-xs font-normal text-slate-400">(${ownerFiles.length} ไฟล์)</span>
    </span>
    <svg class="chevron w-4 h-4 text-slate-400 transition-transform duration-200${expanded ? ' rotate-180' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
    </svg>`;
  section.appendChild(header);

  // ── Rows wrap ──
  const rowsWrap = document.createElement('div');
  rowsWrap.dataset.rowsWrap = owner;
  if (!expanded) rowsWrap.classList.add('hidden');

  // Column header
  const colHead = document.createElement('div');
  colHead.className = 'flex items-center px-4 py-1.5 border-b border-slate-100 bg-white';
  colHead.innerHTML = `
    <div class="w-7 shrink-0 flex items-center justify-center">
      <input type="checkbox" data-section-select="${owner}" class="w-4 h-4 cursor-pointer rounded" style="accent-color:#2563eb" title="เลือกทั้งหมด">
    </div>
    <p class="flex-1 text-xs font-semibold text-slate-400 uppercase tracking-wide ml-2">ชื่อไฟล์</p>
    <p class="w-24 text-xs font-semibold text-slate-400 uppercase tracking-wide text-right hidden sm:block">ขนาด</p>
    <p class="w-32 text-xs font-semibold text-slate-400 uppercase tracking-wide text-right hidden md:block">วันที่</p>
    <div class="w-20 shrink-0"></div>`;
  rowsWrap.appendChild(colHead);

  // File rows
  for (const f of slice) {
    const date = f.created_at
      ? new Date(f.created_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })
      : '–';
    const row = document.createElement('div');
    row.className = 'flex items-center px-4 py-2.5 hover:bg-slate-50 transition-colors group border-b border-slate-50 last:border-0';
    row.innerHTML = `
      <div class="w-7 shrink-0 relative flex items-center justify-center">
        <div class="file-icon text-lg leading-none">${fileIcon(f.mimetype)}</div>
        <input type="checkbox" data-select-id="${f.id}"
          class="file-check absolute inset-0 w-full h-full opacity-0 group-hover:opacity-100 cursor-pointer rounded"
          style="accent-color:#2563eb">
      </div>
      <div class="flex-1 min-w-0 ml-2">
        <p class="text-sm font-medium text-slate-800 truncate leading-tight">${f.original_name}</p>
      </div>
      <p class="w-24 text-xs text-slate-400 text-right hidden sm:block shrink-0">${fmtSize(f.size)}</p>
      <p class="w-32 text-xs text-slate-400 text-right hidden md:block shrink-0">${date}</p>
      <div class="w-20 ml-2 shrink-0 flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button data-id="${f.id}" data-name="${f.original_name}" data-mime="${f.mimetype}" data-url="${f.file_url || ''}" data-action="preview"
          class="p-1.5 rounded-lg hover:bg-slate-200 text-slate-500 transition">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
        </button>
        <button data-id="${f.id}" data-name="${f.original_name}" data-action="download"
          class="p-1.5 rounded-lg hover:bg-blue-100 text-blue-500 transition">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
        </button>
        <button data-id="${f.id}" data-name="${f.original_name}" data-action="delete"
          class="p-1.5 rounded-lg hover:bg-red-100 text-red-500 transition">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
        </button>
      </div>`;
    rowsWrap.appendChild(row);
  }

  // ── Pagination bar (bottom-right) ──
  if (totalPages > 1) {
    const pagebar = document.createElement('div');
    pagebar.className = 'flex items-center justify-end gap-2 px-4 py-2 bg-white border-t border-slate-100';
    pagebar.innerHTML = `
      <span class="text-xs text-slate-400">หน้า ${PAGE + 1} / ${totalPages}</span>
      <button data-pg-owner="${owner}" data-pg-dir="-1"
        class="p-1.5 rounded-lg text-slate-500 transition ${PAGE === 0 ? 'opacity-0 pointer-events-none' : 'hover:bg-slate-100'}">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
      </button>
      <button data-pg-owner="${owner}" data-pg-dir="1"
        class="p-1.5 rounded-lg text-slate-500 transition ${PAGE >= totalPages - 1 ? 'opacity-0 pointer-events-none' : 'hover:bg-slate-100'}">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
      </button>`;
    rowsWrap.appendChild(pagebar);
  }

  section.appendChild(rowsWrap);

  // Toggle handler
  header.addEventListener('click', () => {
    rowsWrap.classList.toggle('hidden');
    header.querySelector('.chevron').classList.toggle('rotate-180');
  });
}

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

  adminByOwner = {};
  for (const f of files) {
    if (!adminByOwner[f.owner]) adminByOwner[f.owner] = [];
    adminByOwner[f.owner].push(f);
  }

  // Reset pages on full reload
  for (const owner of Object.keys(adminByOwner)) {
    if (ownerPages[owner] === undefined) ownerPages[owner] = 0;
  }

  container.innerHTML = '';
  for (const [owner, ownerFiles] of Object.entries(adminByOwner)) {
    renderOwnerSection(container, owner, ownerFiles, files);
  }

  // ── Delegate all clicks inside container ──
  container.onclick = async (e) => {
    // Pagination arrow
    const pgBtn = e.target.closest('[data-pg-owner]');
    if (pgBtn) {
      const owner = pgBtn.dataset.pgOwner;
      const dir   = parseInt(pgBtn.dataset.pgDir, 10);
      const ownerFiles = adminByOwner[owner];
      const totalPages = Math.ceil(ownerFiles.length / PAGE_SIZE);
      ownerPages[owner] = Math.max(0, Math.min(totalPages - 1, (ownerPages[owner] || 0) + dir));
      renderOwnerSection(container, owner, ownerFiles);
      // Keep expanded
      const sec = container.querySelector(`[data-owner-section="${CSS.escape(owner)}"]`);
      if (sec) {
        const wrap = sec.querySelector('[data-rows-wrap]');
        if (wrap) wrap.classList.remove('hidden');
        const chev = sec.querySelector('.chevron');
        if (chev) chev.classList.add('rotate-180');
      }
      return;
    }
    // File action buttons
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const { id, name, mime, url, action } = btn.dataset;
    if (action === 'preview')  openPreview(id, name, mime, url);
    if (action === 'download') adminDownload(id, name);
    if (action === 'delete')   adminDeleteFile(id, name);
  };

  // Checkbox change delegation
  container.onchange = (e) => {
    // Per-file checkbox
    const cb = e.target.closest('[data-select-id]');
    if (cb) {
      if (cb.checked) adminSelectedIds.add(cb.dataset.selectId);
      else            adminSelectedIds.delete(cb.dataset.selectId);
      updateAdminSelectionBar();
      return;
    }
    // Section select-all checkbox
    const scb = e.target.closest('[data-section-select]');
    if (scb) {
      const wrap = scb.closest('[data-rows-wrap]');
      const cbs  = wrap?.querySelectorAll('[data-select-id]') || [];
      for (const c of cbs) {
        c.checked = scb.checked;
        if (scb.checked) adminSelectedIds.add(c.dataset.selectId);
        else             adminSelectedIds.delete(c.dataset.selectId);
      }
      updateAdminSelectionBar();
    }
  };
}

// Optimistic remove a file from in-memory cache + DOM (used by delete button & SSE)
function adminRemoveFileFromDOM(id) {
  adminSelectedIds.delete(String(id));
  updateAdminSelectionBar();
  const container = document.getElementById('adminFileList');
  // Remove from adminByOwner cache
  for (const owner of Object.keys(adminByOwner)) {
    const before = adminByOwner[owner].length;
    adminByOwner[owner] = adminByOwner[owner].filter(f => String(f.id) !== String(id));
    if (adminByOwner[owner].length !== before) {
      // Re-render section or remove it if empty
      if (adminByOwner[owner].length === 0) {
        delete adminByOwner[owner];
        const sec = container.querySelector(`[data-owner-section="${CSS.escape(owner)}"]`);
        if (sec) {
          sec.style.transition = 'opacity 0.15s';
          sec.style.opacity = '0';
          setTimeout(() => sec.remove(), 150);
        }
      } else {
        // Clamp page if needed
        const total = Math.ceil(adminByOwner[owner].length / PAGE_SIZE);
        if ((ownerPages[owner] || 0) >= total) ownerPages[owner] = total - 1;
        // Check if section is currently expanded
        const sec = container.querySelector(`[data-owner-section="${CSS.escape(owner)}"]`);
        const wasExpanded = sec && sec.querySelector('[data-rows-wrap]') &&
          !sec.querySelector('[data-rows-wrap]').classList.contains('hidden');
        renderOwnerSection(container, owner, adminByOwner[owner]);
        if (wasExpanded) {
          const newSec = container.querySelector(`[data-owner-section="${CSS.escape(owner)}"]`);
          if (newSec) {
            const wrap = newSec.querySelector('[data-rows-wrap]');
            if (wrap) wrap.classList.remove('hidden');
            const chev = newSec.querySelector('.chevron');
            if (chev) chev.classList.add('rotate-180');
          }
        }
      }
      break;
    }
  }
}

document.getElementById('refreshFilesBtn').addEventListener('click', loadAdminFiles);

async function adminDownload(id, name) {
  const res = await apiFetch(`${API}/admin/files/${id}/download`, { headers: authHeaders() });
  if (!res.ok) { console.warn('download failed'); return; }
  const blob = await res.blob();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

async function adminDeleteFile(id, name) {
  const ok = await showConfirm(`ลบไฟล์ “${name}”?`, 'ลบ');
  if (!ok) return;
  // Optimistic: remove immediately
  adminRemoveFileFromDOM(id);
  const res  = await apiFetch(`${API}/admin/files/${id}`, { method: 'DELETE', headers: authHeaders() });
  const data = await res.json();
  if (!res.ok) {
    await showConfirm(data.message || 'Delete failed.', 'OK');
    loadAdminFiles(); // rollback by reloading
  }
}
// ─── Multi-select (admin) ────────────────────────────────────────────────────────────
const adminSelectedIds = new Set();

function updateAdminSelectionBar() {
  const bar     = document.getElementById('adminSelectionBar');
  const countEl = document.getElementById('adminSelectionCount');
  if (!bar) return;
  countEl.textContent = adminSelectedIds.size;
  if (adminSelectedIds.size > 0) {
    bar.classList.remove('hidden'); bar.classList.add('flex');
  } else {
    bar.classList.add('hidden');    bar.classList.remove('flex');
  }
}

document.getElementById('adminDeleteSelectedBtn').addEventListener('click', async () => {
  if (!adminSelectedIds.size) return;
  const count = adminSelectedIds.size;
  const ok = await showConfirm(`ลบ ${count} ไฟล์ที่เลือก?`, 'ลบทั้งหมด');
  if (!ok) return;
  const ids = [...adminSelectedIds];
  adminSelectedIds.clear();
  updateAdminSelectionBar();
  for (const id of ids) adminRemoveFileFromDOM(id);
  const results = await Promise.all(ids.map(id =>
    apiFetch(`${API}/admin/files/${id}`, { method: 'DELETE', headers: authHeaders() })
  ));
  if (results.some(r => !r.ok)) {
    await showConfirm('ลบบางไฟล์ไม่สำเร็จ', 'OK');
    loadAdminFiles();
  }
});
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
  const ok = await showConfirm(t('admin.toggle_confirm').replace('{uname}', uname), 'ยืนยัน');
  if (!ok) return;
  const res  = await apiFetch(`${API}/admin/users/${id}/toggle`, { method: 'PATCH', headers: authHeaders() });
  const data = await res.json();
  if (!res.ok) { await showConfirm(data.message || 'Failed.', 'OK'); return; }
  loadAdminUsers();
}

async function adminUnlockUser(id) {
  const res  = await apiFetch(`${API}/admin/users/${id}/unlock`, { method: 'PATCH', headers: authHeaders() });
  const data = await res.json();
  if (!res.ok) { await showConfirm(data.message || 'Failed.', 'OK'); return; }
  loadAdminUsers();
}

async function adminDeleteUser(id, uname) {
  const ok = await showConfirm(t('admin.delete_user_confirm').replace('{uname}', uname), 'ลบ');
  if (!ok) return;
  const res  = await apiFetch(`${API}/admin/users/${id}`, { method: 'DELETE', headers: authHeaders() });
  const data = await res.json();
  if (!res.ok) { await showConfirm(data.message || 'Failed.', 'OK'); return; }
  loadAdminUsers();
}

// ─── Preview ──────────────────────────────────────────────────────────────────
function openPreview(id, name, mime, fileUrl) {
  document.getElementById('previewFilename').textContent = name;
  const content = document.getElementById('previewContent');
  document.getElementById('previewModal').classList.remove('hidden');

  if (fileUrl) { renderPreviewContent(content, fileUrl, name, mime); return; }

  content.innerHTML = `<p class="text-slate-400 text-sm">${t('preview.loading')}</p>`;
  apiFetch(`${API}/admin/files/${id}/preview`, { headers: authHeaders() }).then(res => {
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

// ─── Init ─────────────────────────────────────────────────────────────────────
applyI18n();
loadAdminFiles();

// ─── WebSocket – real-time sync (secure, JWT auth) ─────────────────────────────
function getWsUrl() {
  const base  = (window.API_URL || 'http://localhost:5000/api').replace(/\/api$/, '');
  const proto = base.startsWith('https') ? 'wss' : 'ws';
  return `${proto}${base.slice(base.indexOf(':/'))}/ws`;
}

(function connectWS() {
  const token = getToken();
  if (!token) return;

  const ws = new WebSocket(`${getWsUrl()}?token=${encodeURIComponent(token)}`);

  ws.onmessage = (e) => {
    try {
      const msg = JSON.parse(e.data);
      switch (msg.type) {
        case 'file_deleted':
          adminRemoveFileFromDOM(msg.id);
          break;
        case 'file_uploaded':
          loadAdminFiles();
          break;
        case 'user_toggled':
        case 'user_unlocked':
        case 'user_deleted':
          // refresh user list silently if it was ever loaded
          if (document.getElementById('adminUserList')?.children.length > 0) loadAdminUsers();
          break;
      }
    } catch {}
  };

  ws.onclose = (e) => {
    if (e.code === 4001) return; // auth failed – don't retry
    setTimeout(connectWS, 5000);
  };
  ws.onerror = () => ws.close();
}());

// ─── Keep-alive ping ──────────────────────────────────────────────────────────────
(function keepAlive() {
  const isLocal = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  if (isLocal) return;
  const HEALTH = API.replace(/\/api$/, '') + '/api/health';
  setInterval(() => fetch(HEALTH).catch(() => {}), 14 * 60 * 1000);
}());

