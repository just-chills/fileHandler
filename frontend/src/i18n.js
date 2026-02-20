// ─── Internationalization ─────────────────────────────────────────────────────
// Supports 'en' and 'th'. Change window._lang to switch language.
// Usage: t('key.name')

const _i18n = {
  en: {
    // Login / Signup page
    'login.btn':   'Log In',
    'signup.btn':  'Sign Up',

    // Messages
    'msg.fill_all':          'Please fill in all fields.',
    'msg.server_error':      'Server error. Please try again.',
    'msg.email_invalid':     'Please enter a valid email address.',
    'msg.passwords_mismatch':'Passwords do not match.',
    'msg.password_weak':     'Password is too weak. Please follow the strength requirements.',
    'msg.register_success':  'Registration successful! Redi…ting to login…',
    'msg.enter_email':       'Please enter your email address.',
    'msg.enter_valid_email': 'Please enter a valid email address.',
    'msg.enter_otp':         'Please enter the 6-digit OTP code.',
    'msg.session_expired':   'Session expired. Please start again.',
    'msg.reset_success':     'Password reset successfully! You can now log in.',

    // Password strength
    'strength.prefix':       'Strength: ',
    'strength.very_weak':    'Very Weak',
    'strength.weak':         'Weak',
    'strength.fair':         'Fair',
    'strength.strong':       'Strong',
    'strength.very_strong':  'Very Strong',
    'strength.hint_length':  'At least 8 characters',
    'strength.hint_upper':   'At least one uppercase letter',
    'strength.hint_lower':   'At least one lowercase letter',
    'strength.hint_number':  'At least one number',
    'strength.hint_special': 'At least one special character',

    // Forgot password
    'forgot.send_otp_btn':   'Send OTP',
    'forgot.verify_otp_btn': 'Verify OTP',
    'forgot.reset_btn':      'Reset Password',

    // User page
    'user.loading':         'Loading files…',
    'user.no_files':        'No files yet. Upload your first file!',
    'user.you':             'You',
    'user.preview_btn':     'Preview',
    'user.download_btn':    'Download',
    'user.share_btn':       'Share',
    'user.delete_btn':      …lete',
    'user.uploading':       'Uploading…',
    'user.upload_failed':   'Upload failed. Please try again.',
    'user.upload_ok':       'File uploaded successfully!',
    'user.download_failed': 'Download failed.',
    'user.delete_confirm':  'Are you sure you want to delete "{name}"?',

    // Nav
    'nav.logout': 'Log Out',

    // Admin page
    'admin.tab_files':    '📂 All Files',
    'admin.tab_users':    '👥 Users',
    'admin.files_title':  'All Files in System',
    'admin.refresh':      '↻ Refresh',
    'admin.users_title':  'Manage Users',
    'admin.refresh_users':'↻ Refresh',
    'admin.loading':              'Loading…',
    'admin.no_files':             'No files found.',
    'admin.file_count':           'file',
    'admin.preview_btn':          'Preview',
    'admin.download_btn':         'Download',
    'admin.delete_btn':           'Delete',
    'admin.no_users':             'No users found.',
    'admin.badge_disabled':       'Disabled',
    'admin.badge_locked':         'Locked',
    'admin.badge_you':            'You',
    'admin.joined':               'Joined',
    'admin.disable_btn':          'Disable',
    'admin.enable_btn':           'Enable',
    'admin.unlock_btn':           'Unlock',
    'admin.delete_user_btn':      'Delete',
    'admin.delete_file_confirm':  'Delete file "{name}"? This cannot be undone.',
    'admin.toggle_confirm':       'Toggle active status for "{uname}"?',
    'admin.delete_user_confirm':  'Permanently delete user "{uname}" and all thei…iles?',

    // Preview modal
    'preview.loading':          'Loading preview…',
    'preview.unavailable':      'Preview is not available for this file.',
    'preview.no_preview':       'Preview not available for this file type.',
    'preview.download_instead': 'Download instead',

    // Share modal
    'share.none': 'Not shared with anyone yet.',
  },

  th: {
    // Login / Signup page
    'login.btn':   'เข้าสู่ระบบ',
    'signup.btn':  'สมัครสมาชิก',

    // Messages
    'msg.fill_all':          'กรุณากรอกข้อมูลให้ครบทุกช่อง',
    'msg.server_error':      'เกิดข้อผิดพลาดของเซิร์ฟเวอร์ กรุณาลองใหม่อีกครั้ง',
    'msg.email_invalid':     'กรุณากรอกอีเมลให้ถูกต้อง',
    'msg.passwords_mismatch':'รหัสผ่านไม่ตรงกัน',
    'msg.password_weak':     'รหัสผ่านไม่แข็งแรงพอ กรุณาปรับตามข้อกำหนด',
    'msg.register_success':  'สมัครสมาชิกสำเร็จ! กำลังนำไปหน้าเข้าสู่ระบบ…',
    'msg.enter_email':       'กรุณากรอกอีเมลของคุณ',
    'msg.enter_valid_email': 'กรุณากรอกอีเมลที่ถูกต้อง',
    'msg.enter_otp':         'กรุณากรอกรหัส OTP 6 หลัก',
    'msg.session_expired':   'หมดเวลาเซสชัน กรุณาเริ่มใหม่อีกครั้ง',
    'msg.reset_success':     'รีเซ็ตรหัสผ่านสำเร็จ! คุณสามารถเข้าสู่ระบบได้แล้ว',

    // Password strength
    'strength.prefix':       'ความแข็งแรง: ',
    'strength.very_weak':    'อ่อนมาก',
    'strength.weak':         'อ่อน',
    'strength.fair':         'ปานกลาง',
    'strength.strong':       'แข็งแรง',
    'strength.very_strong':  'แข็งแรงมาก',
    'strength.hint_length':  'อย่างน้อย 8 ตัวอักษร',
    'strength.hint_upper':   'ตัวพิมพ์ใหญ่อย่างน้อย 1 ตัว',
    'strength.hint_lower':   'ตัวพิมพ์เล็กอย่างน้อย 1 ตัว',
    'strength.hint_number':  'ตัวเลขอย่างน้อย 1 ตัว',
    'strength.hint_special':  'อักขระพิเศษอย่างน้อย 1 ตัว',

    // Forgot password
    'forgot.send_otp_btn':   'ส่ง OTP',
    'forgot.verify_otp_btn': 'ยืนยัน OTP',
    'forgot.reset_btn':      'รีเซ็ตรหัสผ่าน',

    // User page
    'user.loading':         'กำลังโหลดไฟล์…',
    'user.no_files':        'ยังไม่มีไฟล์ อัปโหลดไฟล์แรกของคุณ!',
    'user.you':             'คุณ',
    'user.preview_btn':     'ดูตัวอย่าง',
    'user.download_btn':    'ดาวน์โหลด',
    'user.share_btn':       'แชร์',
    'user.delete_btn':      'ลบ',
    'user.uploading':       'กำลังอัปโหลด…',
    'user.upload_failed':   'อัปโหลดล้มเหลว กรุณาลองใหม่อีกครั้ง',
    'user.upload_ok':       'อัปโหลดไฟล์สำเร็จ!',
    'user.download_failed': 'ดาวน์โหลดล้มเหลว',
    'user.delete_confirm':  'คุณแน่ใจหรือไม่ว่าต้องการลบ "{name}"?',

    // Nav
    'nav.logout': 'ออกจากระบบ',

    // Admin page
    'admin.tab_files':    '📂 ไฟล์ทั้งหมด',
    'admin.tab_users':    '👥 ผู้ใช้',
    'admin.files_title':  'ไฟล์ทั้งหมดในระบบ',
    'admin.refresh':      '↻ รีเฟรช',
    'admin.users_title':  'จัดการผู้ใช้',
    'admin.refresh_users':'↻ รีเฟรช',
    'admin.loading':              'กำลังโหลด…',
    'admin.no_files':             'ไม่พบไฟล์',
    'admin.file_count':           'ไฟล์',
    'admin.preview_btn':          'ดูตัวอย่าง',
    'admin.download_btn':         'ดาวน์โหลด',
    'admin.delete_btn':           'ลบ',
    'admin.no_users':             'ไม่พบผู้ใช้',
    'admin.badge_disabled':       'ปิดใช้งาน',
    'admin.badge_locked':         'ถูกล็อก',
    'admin.badge_you':            'คุณ',
    'admin.joined':               'เข้าร่วมเมื่อ',
    'admin.disable_btn':          'ปิดใช้งาน',
    'admin.enable_btn':           'เปิดใช้งาน',
    'admin.unlock_btn':           'ปลดล็อก',
    'admin.delete_user_btn':      'ลบ',
    'admin.delete_file_confirm':  'ลบไฟล์ "{name}"? ไม่สามารถยกเลิกได้',
    'admin.toggle_confirm':       'เปลี่ยนสถานะการใช้งานของ "{uname}"?',
    'admin.delete_user_confirm':  'ลบผู้ใช้ "{uname}" และไฟล์ทั้งหมดอย่างถาวร?',

    // Preview modal
    'preview.loading':          'กำลังโหลดตัวอย่าง…',
    'preview.unavailable':      'ไม่สามารถ–ดูตัวอย่างไฟล์นี้ได้',
    'preview.no_preview':       'ไม่รองรับการดูตัวอย่างประเภทไฟล์นี้',
    'preview.download_instead': 'ดาวน์โหลดแทน',

    // Share modal
    'share.none': 'ยังไม่ได้แชร์กับใคร',
  }
};

// Default language – can be overridden by setting window._lang before loading this file
window._lang = window._lang || localStorage.getItem('lang') || 'th';

function t(key) {
  const lang  = window._lang in _i18n ? window._lang : 'en';
  const value = _i18n[lang][key] ?? _i18n['en'][key] ?? key;
  return value;
}

// Apply i18n translations to all elements with data-i18n attribute
function applyI18n() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    const val = t(key);
    if (val !== key) el.textContent = val;
  });
}

// Toggle between Thai and English
function toggleLang() {
  window._lang = window._lang === 'th' ? 'en' : 'th';
  localStorage.setItem('lang', window._lang);
  const label = document.getElementById('langLabel');
  if (label) label.textContent = window._lang === 'th' ? 'EN' : 'TH';
  applyI18n();
}
