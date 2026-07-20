'use strict';
// Same drop-navigates hole the widget window closes: Chromium's default on a
// dropped file or link is to NAVIGATE, the preload bridge survives navigation,
// and THIS window owns both consent controls (statusLine replace, endpoint ToS).
// A page landing here would inherit them, so shut the door on both events.
document.addEventListener('dragover', (e) => e.preventDefault());
document.addEventListener('drop', (e) => e.preventDefault());

const api = window.claudeCount;
let locale = 'en';
// applyLabels() rewrites every [data-i18n] node from the dictionary, which would
// undo the update button's "Get the new version" state on a language change —
// leaving a button labelled "Check for updates" that actually opens a download
// page. Set while that offer stands, so the locale handler can restore it.
let relabelUpdBtn = null;

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

  // macOS: floating widget vs. menu bar text. Hidden entirely elsewhere — the
  // setting exists in state on every platform, but only darwin can honour it.
  if (data.platform === 'darwin') {
    const macSel = document.getElementById('macbar');
    const macHint = document.getElementById('macbar-hint');
    document.getElementById('macbar-field').style.display = '';
    macHint.style.display = '';
    macSel.value = s.macBar === 'menubar' ? 'menubar' : 'widget';
    macSel.addEventListener('change', (e) => api.settingsSet('macBar', e.target.value));
  }

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
  // Boot moved this install off an endpoint pin nobody had consented to. Say so
  // until they touch the control — at which point main clears the flag.
  const srcMoved = document.getElementById('source-moved');
  let movedNotice = s.endpointResetAt > 0;
  const syncSource = () => {
    const isSL = srcSel.value === 'statusline';
    const confirming = endpointConfirm.style.display !== 'none';
    srcHint.style.display = isSL ? '' : 'none';
    // standing ToS note stays up whenever endpoint is the applied source
    endpointNote.style.display = (!isSL && !confirming) ? '' : 'none';
    srcMoved.style.display = movedNotice ? '' : 'none';
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
    movedNotice = false; // they've engaged with the control; main clears it too
    api.settingsSet('source', v);
    syncSource();
  });
  document.getElementById('endpoint-yes').addEventListener('click', () => {
    endpointConfirm.style.display = 'none';
    appliedSource = 'endpoint';
    movedNotice = false;
    // third arg = "the ToS gate was answered"; main refuses the move without it
    api.settingsSet('source', 'endpoint', true);
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
  // `confirmed` is only true on the path where the user actually answered the
  // replace dialog. Passing it from the first-click path too would defeat the
  // point: main re-inspects settings.json, so a foreign statusLine that appeared
  // between our inspect and the apply still comes back as needs_confirm — and we
  // show the dialog for it rather than silently overwriting.
  const doApply = async (nodeOk, confirmed) => {
    setSl('sl_working');
    let r = {};
    try { r = await api.statuslineApply({ confirmReplace: confirmed === true }); } catch (_) {}
    if (r && r.ok) setSl(nodeOk ? 'sl_done' : 'sl_done_no_node', nodeOk ? 'ok' : 'warn');
    else if (r && r.error === 'needs_confirm') {
      // it changed under us — ask about the command that's actually there now
      setSl('');
      slConfirmCmd.textContent = r.currentCmd || '';
      slConfirm.dataset.nodeok = nodeOk ? '1' : '';
      slConfirm.style.display = '';
    }
    else if (r && r.error === 'unreadable') setSl('sl_err_unreadable', 'warn');
    else if (r && r.error === 'read_failed') setSl('sl_err_read', 'warn');
    else setSl('sl_err_write', 'warn');
  };
  slApply.addEventListener('click', async () => {
    slConfirm.style.display = 'none';
    setSl('sl_working');
    let info = {};
    try { info = await api.statuslineInspect(); } catch (_) { setSl('sl_err_write', 'warn'); return; }
    if (info.unreadable) { setSl('sl_err_unreadable', 'warn'); return; }
    // already ours, but `node` missing is precisely the silent-failure case the
    // user came here to diagnose (the command is `node "script"`) — a green
    // "✓ already configured" would send them away with no lead
    if (info.isMine) { setSl(info.nodeOk ? 'sl_already' : 'sl_already_no_node', info.nodeOk ? 'ok' : 'warn'); return; }
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
    await doApply(nodeOk, true);
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
    // macOS can check but not install (unsigned build — see the note in main.js).
    // Once a check finds something, the button stops being "check again" and
    // becomes the way out: it opens the releases page.
    let offerPage = false;
    updBtn.addEventListener('click', async () => {
      if (offerPage) { api.updatePage(); return; }
      updBtn.disabled = true;
      setStatus(window.I18N.t(locale, 'update_checking'));
      let r = { state: 'error' };
      try { r = await api.checkUpdate(); } catch (_) {}
      // runManualCheck() short-circuits without ever hitting the network when a
      // download is already running or a tray-initiated check holds the latch.
      // Those states must not fall through to "you're on the latest version" —
      // that asserted the opposite of the truth while a newer build downloaded.
      if (r.state === 'available') {
        setStatus(window.I18N.t(locale, 'update_found') + ' (v' + r.version + ')', true);
        if (data.updateManual) {
          offerPage = true;
          relabelUpdBtn = () => { updBtn.textContent = window.I18N.t(locale, 'update_get'); };
          relabelUpdBtn();
        }
      }
      else if (r.state === 'error') setStatus(window.I18N.t(locale, 'update_check_error'));
      else if (r.state === 'ready') setStatus(window.I18N.t(locale, 'update_restart'), true);
      else if (r.state === 'downloading') setStatus(window.I18N.t(locale, 'update_downloading') + (r.version ? ' (v' + r.version + ')' : ''), true);
      else if (r.state === 'checking') setStatus(window.I18N.t(locale, 'update_check_busy'));
      else if (r.state === 'uptodate') setStatus(window.I18N.t(locale, 'update_uptodate') + ' · v' + (data.appVersion || ''), true);
      else setStatus(window.I18N.t(locale, 'update_check_error')); // 'unsupported' or a state we don't know — no answer, don't invent one
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
    // main awaits shell.openExternal('mailto:…'), which rejects outright when no
    // mailto handler is registered (common on Linux). Thanking the user and
    // wiping the textarea on that path destroys a message that was never sent —
    // so only a real success is allowed to clear what they wrote.
    let sent = false;
    try { const r = await api.sendFeedback(text); sent = !r || r.ok !== false; } catch (_) {}
    if (sent) {
      fbText.value = '';
      fbStatus.textContent = window.I18N.t(locale, 'feedback_thanks');
    } else {
      fbStatus.textContent = window.I18N.t(locale, 'feedback_failed');
    }
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
  if (relabelUpdBtn) relabelUpdBtn(); // applyLabels just reset it to "Check for updates"
});

init();
