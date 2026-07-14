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

  const srcSel = document.getElementById('source');
  const srcHint = document.getElementById('source-hint');
  const srcCmd = document.getElementById('source-cmd');
  const endpointConfirm = document.getElementById('endpoint-confirm');
  const endpointNote = document.getElementById('endpoint-note');
  srcSel.value = s.source === 'endpoint' ? 'endpoint' : 'statusline';
  srcCmd.value = data.statuslineCmd || '';
  // the source currently *saved* — so we can revert the dropdown if the user
  // opens the endpoint but declines the ToS gate
  let appliedSource = srcSel.value;
  const syncSource = () => {
    const isSL = srcSel.value === 'statusline';
    const confirming = endpointConfirm.style.display !== 'none';
    srcHint.style.display = isSL ? '' : 'none';
    // standing ToS note stays up whenever endpoint is the applied source
    endpointNote.style.display = (!isSL && !confirming) ? '' : 'none';
  };
  syncSource();

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
  srcSel.addEventListener('change', (e) => {
    const v = e.target.value;
    if (v === 'endpoint' && appliedSource !== 'endpoint') {
      // don't switch yet — require explicit ToS consent first
      endpointConfirm.style.display = '';
      syncSource();
      return;
    }
    endpointConfirm.style.display = 'none';
    appliedSource = v;
    api.settingsSet('source', v);
    syncSource();
  });
  document.getElementById('endpoint-yes').addEventListener('click', () => {
    endpointConfirm.style.display = 'none';
    appliedSource = 'endpoint';
    api.settingsSet('source', 'endpoint');
    syncSource();
  });
  document.getElementById('endpoint-no').addEventListener('click', () => {
    endpointConfirm.style.display = 'none';
    srcSel.value = appliedSource; // revert the dropdown to what's actually saved
    syncSource();
  });
  // click = select + copy (the command is long; make grabbing it painless)
  srcCmd.addEventListener('click', async () => {
    srcCmd.select();
    try {
      await navigator.clipboard.writeText(srcCmd.value);
      const c = document.getElementById('source-copied');
      c.textContent = '✓';
      setTimeout(() => { c.textContent = ''; }, 1500);
    } catch (_) { /* text is selected; Ctrl+C still works */ }
  });
  // --- one-click statusLine setup: write the command into Claude Code's
  // settings.json for the user (with a confirm before replacing an existing
  // statusLine, and a warning if `node` isn't on PATH so it wouldn't run). ---
  const slApply = document.getElementById('sl-apply');
  const slStatus = document.getElementById('sl-status');
  const slConfirm = document.getElementById('sl-confirm');
  const slConfirmCmd = document.getElementById('sl-confirm-cmd');
  const setSl = (key, cls) => { slStatus.textContent = key ? window.I18N.t(locale, key) : ''; slStatus.className = 'sl-status' + (cls ? ' ' + cls : ''); };
  const doApply = async (nodeOk) => {
    setSl('sl_working');
    let r = {};
    try { r = await api.statuslineApply(); } catch (_) {}
    if (r && r.ok) setSl(nodeOk ? 'sl_done' : 'sl_done_no_node', nodeOk ? 'ok' : 'warn');
    else if (r && r.error === 'unreadable') setSl('sl_err_unreadable', 'warn');
    else setSl('sl_err_write', 'warn');
  };
  slApply.addEventListener('click', async () => {
    slConfirm.style.display = 'none';
    setSl('sl_working');
    let info = {};
    try { info = await api.statuslineInspect(); } catch (_) { setSl('sl_err_write', 'warn'); return; }
    if (info.unreadable) { setSl('sl_err_unreadable', 'warn'); return; }
    if (info.isMine) { setSl('sl_already', 'ok'); return; }
    if (info.currentCmd) {
      // an existing custom statusLine — confirm before replacing it
      setSl('');
      slConfirmCmd.textContent = info.currentCmd;
      slConfirm.dataset.nodeok = info.nodeOk ? '1' : '';
      slConfirm.style.display = '';
      return;
    }
    await doApply(info.nodeOk);
  });
  document.getElementById('sl-confirm-yes').addEventListener('click', async () => {
    const nodeOk = slConfirm.dataset.nodeok === '1';
    slConfirm.style.display = 'none';
    await doApply(nodeOk);
  });
  document.getElementById('sl-confirm-no').addEventListener('click', () => {
    slConfirm.style.display = 'none';
    setSl('');
  });

  document.getElementById('btn-close').addEventListener('click', () => api.settingsClose());
  document.getElementById('btn-donate').addEventListener('click', () => api.donate());

  // Manual "check for updates" — only meaningful on the packaged NSIS install
  if (data.updatesSupported) {
    const updField = document.getElementById('update-field');
    const updBtn = document.getElementById('upd-check');
    const updStatus = document.getElementById('upd-status');
    const setStatus = (text, ok) => { updStatus.textContent = text; updStatus.className = 'upd-status' + (ok ? ' ok' : ''); };
    updField.style.display = '';
    setStatus('v' + (data.appVersion || ''));
    updBtn.addEventListener('click', async () => {
      updBtn.disabled = true;
      setStatus(window.I18N.t(locale, 'update_checking'));
      let r = { state: 'error' };
      try { r = await api.checkUpdate(); } catch (_) {}
      if (r.state === 'available') setStatus(window.I18N.t(locale, 'update_found') + ' (v' + r.version + ')', true);
      else if (r.state === 'error') setStatus(window.I18N.t(locale, 'update_check_error'));
      else if (r.state === 'ready') setStatus(window.I18N.t(locale, 'update_restart'), true);
      else setStatus(window.I18N.t(locale, 'update_uptodate') + ' · v' + (data.appVersion || ''), true);
      updBtn.disabled = false;
    });
  }

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
