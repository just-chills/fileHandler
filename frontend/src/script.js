const API_URL = 'http://localhost:5000/api';

// ─── Token helpers ────────────────────────────────────────────────────────────

function saveSession(data) {
  sessionStorage.setItem('accessToken', data.accessToken);
  sessionStorage.setItem('refreshToken', data.refreshToken);
  sessionStorage.setItem('user', JSON.stringify(data.user));
}

function getUser() {
  try { return JSON.parse(sessionStorage.getItem('user')); } catch { return null; }
}

// ─── UI helpers ───────────────────────────────────────────────────────────────

function showMessage(elementId, message, isError = true) {
  const el = document.getElementById(elementId);
  if (!el) return;
  el.textContent = message;
  el.className = `text-sm mt-3 px-3 py-2 rounded-lg text-center ${
    isError
      ? 'bg-red-50 text-red-600 border border-red-200'
      : 'bg-green-50 text-green-600 border border-green-200'
  }`;
  el.classList.remove('hidden');
}

function clearMessage(elementId) {
  const el = document.getElementById(elementId);
  if (el) { el.textContent = ''; el.classList.add('hidden'); }
}

function setButtonLoading(btnId, loading, label) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  btn.disabled = loading;
  if (loading) {
    btn.innerHTML = `<svg class="animate-spin inline w-4 h-4 mr-2 -mt-0.5" fill="none" viewBox="0 0 24 24">
      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
    </svg>Please wait…`;
  } else {
    btn.textContent = label;
  }
}

// ─── Section toggle ───────────────────────────────────────────────────────────

const loginFormSection  = document.getElementById('loginFormSection');
const signupFormSection = document.getElementById('signupFormSection');

document.getElementById('goToSignUp').addEventListener('click', () => {
  clearMessage('loginMessage');
  loginFormSection.classList.add('hidden');
  signupFormSection.classList.remove('hidden');
});

document.getElementById('goToLogin').addEventListener('click', () => {
  clearMessage('signupMessage');
  signupFormSection.classList.add('hidden');
  loginFormSection.classList.remove('hidden');
});

// ─── Password Strength ────────────────────────────────────────────────────────

function evaluatePasswordStrength(password) {
  const checks = [
    { regex: /.{8,}/,         key: 'strength.hint_length' },
    { regex: /[A-Z]/,         key: 'strength.hint_upper' },
    { regex: /[a-z]/,         key: 'strength.hint_lower' },
    { regex: /[0-9]/,         key: 'strength.hint_number' },
    { regex: /[^A-Za-z0-9]/, key: 'strength.hint_special' },
  ];

  const passed = checks.filter(c => c.regex.test(password));
  const failed = checks.filter(c => !c.regex.test(password));
  return { score: passed.length, failed };
}

const STRENGTH_CONFIG = [
  { key: 'strength.very_weak',  color: 'bg-red-500',    textColor: 'text-red-500',    bars: 1 },
  { key: 'strength.weak',       color: 'bg-orange-400',  textColor: 'text-orange-400', bars: 2 },
  { key: 'strength.fair',       color: 'bg-yellow-400',  textColor: 'text-yellow-500', bars: 3 },
  { key: 'strength.strong',     color: 'bg-blue-500',    textColor: 'text-blue-500',   bars: 4 },
  { key: 'strength.very_strong',color: 'bg-green-500',   textColor: 'text-green-500',  bars: 4 },
];

function updateStrengthMeter(password) {
  const meter  = document.getElementById('strengthMeter');
  const label  = document.getElementById('strengthLabel');
  const hints  = document.getElementById('strengthHints');
  const bars   = [1, 2, 3, 4].map(i => document.getElementById(`bar${i}`));

  if (!password) {
    meter.classList.add('hidden');
    return;
  }

  meter.classList.remove('hidden');
  const { score, failed } = evaluatePasswordStrength(password);

  // score 1–5, index 0–4
  const idx    = Math.max(0, Math.min(score - 1, 4));
  const config = STRENGTH_CONFIG[idx];

  label.textContent = t('strength.prefix') + t(config.key);
  label.className   = `text-xs font-semibold ${config.textColor}`;

  bars.forEach((bar, i) => {
    bar.className = `h-1.5 flex-1 rounded-full transition-colors duration-300 ${
      i < config.bars ? config.color : 'bg-slate-200'
    }`;
  });

  hints.innerHTML = failed.map(f =>
    `<li class="flex items-center gap-1"><span class="text-slate-400">✕</span>${t(f.key)}</li>`
  ).join('');
}

document.getElementById('signupPasswordInput').addEventListener('input', (e) => {
  updateStrengthMeter(e.target.value);
});

// ─── Remember Me ─────────────────────────────────────────────────────────────

(function loadRememberedUser() {
  const saved = localStorage.getItem('rememberedUsername');
  if (saved) {
    document.getElementById('loginUsernameInput').value = saved;
    document.getElementById('rememberMeCheckbox').checked = true;
  }
})();

// ─── Login ────────────────────────────────────────────────────────────────────

document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  clearMessage('loginMessage');
  setButtonLoading('loginBtn', true, t('login.btn'));

  const username = document.getElementById('loginUsernameInput').value.trim();
  const password = document.getElementById('passwordInput').value;
  const rememberMe = document.getElementById('rememberMeCheckbox').checked;

  if (!username || !password) {
    setButtonLoading('loginBtn', false, t('login.btn'));
    return showMessage('loginMessage', t('msg.fill_all'));
  }

  try {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    const data = await res.json();

    if (!res.ok) {
      setButtonLoading('loginBtn', false, t('login.btn'));
      return showMessage('loginMessage', data.message || t('msg.server_error'));
    }

    // Save or clear remembered username
    if (rememberMe) {
      localStorage.setItem('rememberedUsername', username);
    } else {
      localStorage.removeItem('rememberedUsername');
    }

    saveSession(data);

    // Redirect based on role
    if (data.user.role === 'admin') {
      window.location.href = './pages/admin/admin.html';
    } else {
      window.location.href = './pages/user/user.html';
    }
  } catch (err) {
    setButtonLoading('loginBtn', false, t('login.btn'));
    showMessage('loginMessage', t('msg.server_error'));
  }
});

// ─── Register ────────────────────────────────────────────────────────────────

document.getElementById('signupForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  clearMessage('signupMessage');
  setButtonLoading('signupBtn', true, t('signup.btn'));

  const full_name = document.getElementById('signupFullNameInput').value.trim();
  const email     = document.getElementById('signupEmailInput').value.trim();
  const username  = document.getElementById('signupUsernameInput').value.trim();
  const password  = document.getElementById('signupPasswordInput').value;
  const confirm   = document.getElementById('signupConfirmPasswordInput').value;

  if (!full_name || !email || !username || !password || !confirm) {
    setButtonLoading('signupBtn', false, t('signup.btn'));
    return showMessage('signupMessage', t('msg.fill_all'));
  }

  // Simple email format check
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    setButtonLoading('signupBtn', false, t('signup.btn'));
    return showMessage('signupMessage', t('msg.email_invalid'));
  }

  if (password !== confirm) {
    setButtonLoading('signupBtn', false, t('signup.btn'));
    return showMessage('signupMessage', t('msg.passwords_mismatch'));
  }

  // Client-side strength check (mirrors backend rules)
  const { score } = evaluatePasswordStrength(password);
  if (score < 3) {
    setButtonLoading('signupBtn', false, t('signup.btn'));
    return showMessage('signupMessage', t('msg.password_weak'));
  }

  try {
    const res = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, full_name, email }),
    });

    const data = await res.json();
    setButtonLoading('signupBtn', false, t('signup.btn'));

    if (!res.ok) {
      if (data.errors) {
        const msgs = data.errors.map(err => err.msg).join(' · ');
        return showMessage('signupMessage', msgs);
      }
      return showMessage('signupMessage', data.message || t('msg.server_error'));
    }

    showMessage('signupMessage', t('msg.register_success'), false);

    setTimeout(() => {
      signupFormSection.classList.add('hidden');
      loginFormSection.classList.remove('hidden');
      document.getElementById('loginUsernameInput').value = username;
      clearMessage('signupMessage');
    }, 1500);

  } catch (err) {
    setButtonLoading('signupBtn', false, t('signup.btn'));
    showMessage('signupMessage', t('msg.server_error'));
  }
});

// ─── Toggle Password Visibility ───────────────────────────────────────────────

function togglePasswordVisibility(inputId, openIconId, closedIconId) {
  const passwordInput = document.getElementById(inputId);
  const eyeOpenIcon   = document.getElementById(openIconId);
  const eyeClosedIcon = document.getElementById(closedIconId);

  if (passwordInput.type === 'password') {
    passwordInput.type = 'text';
    eyeOpenIcon.classList.remove('hidden');
    eyeClosedIcon.classList.add('hidden');
  } else {
    passwordInput.type = 'password';
    eyeOpenIcon.classList.add('hidden');
    eyeClosedIcon.classList.remove('hidden');
  }
}

// ─── Forgot Password (3-step OTP flow) ──────────────────────────────────────

const forgotModal    = document.getElementById('forgotModal');
const forgotCloseBtn = document.getElementById('forgotCloseBtn');
const forgotForm     = document.getElementById('forgotForm');

let forgotEmail      = null;
let forgotResetToken = null;

function forgotSetStep(step) {
  // Dots
  const dots = [
    document.getElementById('forgotStep1Dot'),
    document.getElementById('forgotStep2Dot'),
    document.getElementById('forgotStep3Dot'),
  ];
  const panels = [
    document.getElementById('forgotStep1'),
    document.getElementById('forgotStep2'),
    document.getElementById('forgotStep3'),
  ];
  const bars = [
    document.getElementById('forgotStepBar1'),
    document.getElementById('forgotStepBar2'),
  ];

  dots.forEach((dot, i) => {
    if (i + 1 < step) {
      dot.className = 'w-7 h-7 rounded-full bg-green-500 text-white text-xs font-bold flex items-center justify-center transition-colors shrink-0';
      dot.textContent = '✓';
    } else if (i + 1 === step) {
      dot.className = 'w-7 h-7 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center transition-colors shrink-0';
      dot.textContent = String(i + 1);
    } else {
      dot.className = 'w-7 h-7 rounded-full bg-slate-200 text-slate-400 text-xs font-bold flex items-center justify-center transition-colors shrink-0';
      dot.textContent = String(i + 1);
    }
  });

  panels.forEach((p, i) => p.classList.toggle('hidden', i + 1 !== step));

  // Fill progress bars based on step
  bars[0].style.width = step > 1 ? '100%' : '0%';
  bars[1].style.width = step > 2 ? '100%' : '0%';
}

function forgotResetToStep1() {
  forgotEmail      = null;
  forgotResetToken = null;
  clearMessage('forgotMessage');
  document.getElementById('forgotEmailInput').value = '';
  document.getElementById('forgotOtpInput').value = '';
  if (forgotForm) forgotForm.reset();
  forgotSetStep(1);
}

document.getElementById('forgotPasswordLink').addEventListener('click', (e) => {
  e.preventDefault();
  forgotResetToStep1();
  forgotModal.classList.remove('hidden');
  forgotModal.classList.add('flex');
});

forgotCloseBtn.addEventListener('click', () => {
  forgotModal.classList.add('hidden');
  forgotModal.classList.remove('flex');
  forgotResetToStep1();
});

forgotModal.addEventListener('click', (e) => {
  if (e.target === forgotModal) forgotCloseBtn.click();
});

// Back buttons
document.getElementById('forgotBackBtn1').addEventListener('click', () => {
  clearMessage('forgotMessage');
  forgotSetStep(1);
});
document.getElementById('forgotBackBtn').addEventListener('click', () => {
  clearMessage('forgotMessage');
  forgotSetStep(2);
});

// Step 1 — Send OTP
document.getElementById('forgotVerifyBtn').addEventListener('click', async () => {
  clearMessage('forgotMessage');
  const email = document.getElementById('forgotEmailInput').value.trim();

  if (!email) {
    return showMessage('forgotMessage', t('msg.enter_email'));
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return showMessage('forgotMessage', t('msg.enter_valid_email'));
  }

  setButtonLoading('forgotVerifyBtn', true, t('forgot.send_otp_btn'));

  try {
    const res = await fetch(`${API_URL}/auth/check-username`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });

    const data = await res.json();
    setButtonLoading('forgotVerifyBtn', false, t('forgot.send_otp_btn'));

    if (!res.ok) {
      return showMessage('forgotMessage', data.message || t('msg.server_error'));
    }

    forgotEmail = email;
    document.getElementById('forgotOtpLabel').textContent = data.message; // "OTP sent to ab***@gmail.com"
    clearMessage('forgotMessage');
    forgotSetStep(2);

  } catch (err) {
    setButtonLoading('forgotVerifyBtn', false, t('forgot.send_otp_btn'));
    showMessage('forgotMessage', t('msg.server_error'));
  }
});

document.getElementById('forgotEmailInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); document.getElementById('forgotVerifyBtn').click(); }
});

// Step 2 — Verify OTP
document.getElementById('forgotVerifyOtpBtn').addEventListener('click', async () => {
  clearMessage('forgotMessage');
  const otp = document.getElementById('forgotOtpInput').value.trim();

  if (!otp || otp.length !== 6 || !/^\d{6}$/.test(otp)) {
    return showMessage('forgotMessage', t('msg.enter_otp'));
  }

  setButtonLoading('forgotVerifyOtpBtn', true, t('forgot.verify_otp_btn'));

  try {
    const res = await fetch(`${API_URL}/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: forgotEmail, otp }),
    });

    const data = await res.json();
    setButtonLoading('forgotVerifyOtpBtn', false, t('forgot.verify_otp_btn'));

    if (!res.ok) {
      return showMessage('forgotMessage', data.message || t('msg.server_error'));
    }

    forgotResetToken = data.resetToken;
    document.querySelector('#forgotVerifiedLabel span').textContent = forgotEmail;
    clearMessage('forgotMessage');
    forgotSetStep(3);

  } catch (err) {
    setButtonLoading('forgotVerifyOtpBtn', false, t('forgot.verify_otp_btn'));
    showMessage('forgotMessage', t('msg.server_error'));
  }
});

document.getElementById('forgotOtpInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); document.getElementById('forgotVerifyOtpBtn').click(); }
});

// Step 3 — Reset password
forgotForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearMessage('forgotMessage');

  if (!forgotResetToken) {
    return showMessage('forgotMessage', t('msg.session_expired'));
  }

  const newPassword = document.getElementById('forgotNewPasswordInput').value;
  const confirm     = document.getElementById('forgotConfirmPasswordInput').value;

  if (!newPassword || !confirm) {
    return showMessage('forgotMessage', t('msg.fill_all'));
  }

  if (newPassword !== confirm) {
    return showMessage('forgotMessage', t('msg.passwords_mismatch'));
  }

  const { score } = evaluatePasswordStrength(newPassword);
  if (score < 3) {
    return showMessage('forgotMessage', t('msg.password_weak'));
  }

  setButtonLoading('forgotBtn', true, t('forgot.reset_btn'));

  try {
    const res = await fetch(`${API_URL}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resetToken: forgotResetToken, newPassword }),
    });

    const data = await res.json();
    setButtonLoading('forgotBtn', false, t('forgot.reset_btn'));

    if (!res.ok) {
      return showMessage('forgotMessage', data.message || t('msg.server_error'));
    }

    showMessage('forgotMessage', t('msg.reset_success'), false);
    setTimeout(() => forgotCloseBtn.click(), 2000);

  } catch (err) {
    setButtonLoading('forgotBtn', false, t('forgot.reset_btn'));
    showMessage('forgotMessage', t('msg.server_error'));
  }
});
