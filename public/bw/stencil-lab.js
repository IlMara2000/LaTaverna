// STENCIL LAB — client (CSP-safe, no inline scripts)
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

let state = { view: 'login', originalFile: null, originalDataUrl: null, afterBlob: null, afterUrl: null, sessionExpires: null, warnTimer: null, activityTimer: null };

function init() {
  $('#loginForm').addEventListener('submit', onLogin);
  $('#logoutBtn').addEventListener('click', onLogout);
  setupDropZone();
  $('#transformBtn').addEventListener('click', onTransform);
  $('#downloadBtn').addEventListener('click', onDownload);
  $('#regenBtn').addEventListener('click', onTransform);
  $('#newBtn').addEventListener('click', resetToUpload);
  $('#slider').addEventListener('input', onSlider);
  document.addEventListener('visibilitychange', onVisibilityChange);
  window.addEventListener('focus', onVisibilityChange);
  startSessionPoll();
}

async function onLogin(e) {
  e.preventDefault();
  const pw = $('#password').value;
  try {
    const res = await fetch('/api/bw/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: pw }), credentials: 'include' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'login_failed');
    showToast('Accesso riuscito', 'ok');
    state.sessionExpires = data.expiresAt;
    switchView('app');
    startSessionPoll();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function onLogout() {
  try {
    await fetch('/api/bw/logout', { method: 'POST', credentials: 'include' });
  } catch {}
  state = { ...state, view: 'login', originalFile: null, originalDataUrl: null, afterBlob: null, afterUrl: null, sessionExpires: null };
  $('#loginForm').reset();
  switchView('login');
  showToast('Disconnesso', 'ok');
}

function setupDropZone() {
  const dz = $('#dropZone');
  const input = $('#fileInput');
  dz.addEventListener('click', () => input.click());
  dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('drag'); });
  dz.addEventListener('dragleave', e => { e.preventDefault(); dz.classList.remove('drag'); });
  dz.addEventListener('drop', e => { e.preventDefault(); dz.classList.remove('drag'); handleFiles(e.dataTransfer.files); });
  input.addEventListener('change', e => handleFiles(e.target.files));
}

function handleFiles(files) {
  if (!files.length) return;
  const f = files[0];
  if (!/^image\/(jpeg|png|webp)$/i.test(f.type)) { showToast('Formato non supportato (JPEG, PNG, WebP)', 'error'); return; }
  if (f.size > 6 * 1024 * 1024) { showToast('File troppo grande (max 6 MB)', 'error'); return; }
  state.originalFile = f;
  const reader = new FileReader();
  reader.onload = e => {
    state.originalDataUrl = e.target.result;
    $('#preview').src = state.originalDataUrl;
    dz.classList.add('has-file');
    $('#transformBtn').disabled = false;
    $('#preview').style.display = 'block';
    $('#dropZoneText').style.display = 'none';
  };
  reader.readAsDataURL(f);
}

async function onTransform() {
  if (!state.originalFile) return;
  $('#transformBtn').disabled = true;
  $('#transformBtn').textContent = 'Elaborazione...';
  showToast('Invio al provider AI...', 'ok');
  try {
    const base64 = state.originalDataUrl.split(',')[1];
    const res = await fetch('/api/bw/stencil', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ imageBase64: base64, mimeType: state.originalFile.type }), credentials: 'include' });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) { showToast('Sessione scaduta, rieffettua login', 'error'); switchView('login'); return; }
      if (res.status === 429) { showToast('Troppi tentativi, riprova tra poco', 'error'); return; }
      if (res.status === 503) { showToast('Nessun provider AI configurato sul server', 'error'); return; }
      if (res.status === 504) { showToast('Timeout generazione, riprova', 'error'); return; }
      throw new Error(data.error || `HTTP ${res.status}`);
    }
    const blob = await res.blob();
    state.afterBlob = blob;
    if (state.afterUrl) URL.revokeObjectURL(state.afterUrl);
    state.afterUrl = URL.createObjectURL(blob);
    $('#afterImg').src = state.afterUrl;
    $('#slider').value = 50;
    onSlider();
    switchView('result');
    showToast('Stencil pronto', 'ok');
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    $('#transformBtn').disabled = false;
    $('#transformBtn').textContent = 'TRASFORMA';
  }
}

function onSlider() {
  const v = $('#slider').value;
  $('#afterImg').style.clipPath = `inset(0 ${100 - v}% 0 0)`;
}

function onDownload() {
  if (!state.afterBlob || !state.afterUrl) return;
  const a = document.createElement('a');
  a.href = state.afterUrl;
  a.download = `stencil-${Date.now()}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function resetToUpload() {
  if (state.afterUrl) { URL.revokeObjectURL(state.afterUrl); state.afterUrl = null; }
  state.afterBlob = null;
  state.originalFile = null;
  state.originalDataUrl = null;
  $('#preview').src = '';
  $('#preview').style.display = 'none';
  $('#dropZoneText').style.display = 'block';
  $('#dropZone').classList.remove('has-file');
  $('#transformBtn').disabled = true;
  $('#fileInput').value = '';
  switchView('app');
}

function switchView(view) {
  state.view = view;
  $$('[data-view]').forEach(el => el.classList.toggle('hidden', el.dataset.view !== view));
  if (view === 'app' || view === 'result') startActivityTimer(); else stopActivityTimer();
}

// Session polling & auto-renew
async function pollSession() {
  try {
    const res = await fetch('/api/bw/session', { credentials: 'include' });
    const data = await res.json();
    if (!data.authenticated) {
      if (state.view !== 'login') { showToast('Sessione scaduta', 'warning'); switchView('login'); }
      return;
    }
    state.sessionExpires = data.expiresAt;
    updateTimerUI(data.remainingMs, data.warning);
    if (data.warning && state.view !== 'login') {
      try { await fetch('/api/bw/session', { method: 'POST', credentials: 'include' }); }
      catch {}
    }
  } catch {}
}

function startSessionPoll() { clearInterval(state.sessionTimer); state.sessionTimer = setInterval(pollSession, 30000); pollSession(); }
function stopSessionPoll() { clearInterval(state.sessionTimer); }

function updateTimerUI(ms, warning) {
  const el = $('#sessionTimer');
  if (!el || ms == null) return;
  if (ms <= 0) { el.textContent = 'Scaduta'; el.style.color = 'var(--danger)'; return; }
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  el.textContent = `${m}:${s.toString().padStart(2, '0')}`;
  el.style.color = warning ? 'var(--warn)' : 'var(--muted)';
}

function startActivityTimer() { stopActivityTimer(); state.activityTimer = setTimeout(() => { if (state.view !== 'login') fetch('/api/bw/session', { method: 'POST', credentials: 'include' }).catch(() => {}); }, 4 * 60 * 1000); }
function stopActivityTimer() { clearTimeout(state.activityTimer); }
function onVisibilityChange() { if (document.visibilityState === 'visible' || document.hasFocus()) startActivityTimer(); }

function showToast(msg, type = 'ok') {
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 4000);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
