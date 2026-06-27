'use strict';
const api = window.claudeCount;
let locale = 'en';

function applyLabels() {
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = window.I18N.t(locale, el.getAttribute('data-i18n'));
  });
  document.querySelectorAll('[data-i18n-ph]').forEach((el) => {
    el.placeholder = window.I18N.t(locale, el.getAttribute('data-i18n-ph'));
  });
  document.documentElement.lang = locale;
  document.documentElement.dir = window.I18N.isRTL(locale) ? 'rtl' : 'ltr';
}

const THEMES = [
  { v: 'classic', n: 'Classic' },
  { v: 'bloodthirsty', n: 'Bloodthirsty' },
  { v: 'zombie', n: 'Zombie' },
];
function applyTheme(theme) {
  const t = (theme === 'bloodthirsty' || theme === 'zombie') ? theme : 'classic';
  document.documentElement.setAttribute('data-theme', t);
}
function buildThemeOptions(current) {
  const sel = document.getElementById('theme');
  sel.innerHTML = '';
  for (const th of THEMES) {
    const o = document.createElement('option');
    o.value = th.v;
    o.textContent = th.n;
    sel.appendChild(o);
  }
  sel.value = current || 'classic';
}

function buildLangOptions(langs, current) {
  const sel = document.getElementById('lang');
  sel.innerHTML = '';
  const auto = document.createElement('option');
  auto.value = 'auto';
  auto.textContent = window.I18N.t(locale, 'set_lang_auto');
  sel.appendChild(auto);
  for (const l of langs) {
    const o = document.createElement('option');
    o.value = l.code;
    o.textContent = l.name;
    sel.appendChild(o);
  }
  sel.value = current || 'auto';
}

async function init() {
  const data = await api.settingsGet();
  const s = data.settings || {};
  locale = data.locale || 'en';
  buildLangOptions(data.langs || [], s.language || 'auto');
  applyTheme(s.theme);
  buildThemeOptions(s.theme || 'classic');
  document.getElementById('start').checked = s.startWithOS !== false;
  applyLabels();

  document.getElementById('lang').addEventListener('change', (e) => {
    api.settingsSet('language', e.target.value);
  });
  document.getElementById('theme').addEventListener('change', (e) => {
    applyTheme(e.target.value);            // instant preview in this window
    api.settingsSet('theme', e.target.value);
  });
  document.getElementById('start').addEventListener('change', (e) => {
    api.settingsSet('startWithOS', e.target.checked);
  });
  document.getElementById('btn-close').addEventListener('click', () => api.settingsClose());
  document.getElementById('btn-donate').addEventListener('click', () => api.donate());

  const fbText = document.getElementById('fb-text');
  const fbSend = document.getElementById('fb-send');
  const fbStatus = document.getElementById('fb-status');
  fbSend.addEventListener('click', async () => {
    const text = fbText.value.trim();
    if (!text) { fbText.focus(); return; }
    fbSend.disabled = true;
    try { await api.sendFeedback(text); } catch (_) {}
    fbText.value = '';
    fbStatus.textContent = window.I18N.t(locale, 'feedback_thanks');
    fbSend.disabled = false;
    setTimeout(() => { fbStatus.textContent = ''; }, 4000);
  });
}

api.onTheme((th) => applyTheme(th));

// When the language changes, main re-sends the effective locale to re-translate this window.
api.onLocale((loc) => {
  locale = loc;
  // keep the "auto" option relabeled
  const sel = document.getElementById('lang');
  const cur = sel.value;
  buildLangOptions(window.I18N.LANGS, cur);
  applyLabels();
});

init();
