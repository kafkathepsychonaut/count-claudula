'use strict';
const { app, BrowserWindow, Tray, Menu, ipcMain, powerMonitor, screen, shell } = require('electron');
const fs = require('fs');
const path = require('path');
const { fetchUsage, credPath } = require('./usage');
const { todayUsage } = require('./usage-jsonl');
const { readStatusline, ensureCaptureScript, captureCommand } = require('./usage-statusline');
const { makeTrayIcon } = require('./icon');
const i18n = require('./renderer/i18n');
const { autoUpdater } = require('electron-updater');

// ---- Config ----
const WIN_W = 268;
const H_SIMPLE = 218;     // simple mode (2 bars)
// Extended mode is content-driven: the renderer measures its content (limit
// rows, per-model rows and label lengths all vary) and reports the height over
// IPC. These are only the fallbacks used before the first report arrives.
const H_EXTENDED = 380;   // fallback: fine-detail pane closed
const H_EXT_MORE = 600;   // fallback: fine-detail pane open
const H_EXT_MAX = 760;    // sanity cap for renderer-reported heights
const H_COLLAPSED = 60;
const POLL_ACTIVE_MS = 180 * 1000;  // 3 min — the data changes slowly; gentle on the endpoint's rate limit
const POLL_ERROR_MS = 90 * 1000;    // 90s for NETWORK error (429 uses its own exponential backoff)
// Circuit breaker: this many consecutive server 4xx rejections (other than 429)
// and we stop hitting the endpoint instead of hammering one that said no — if
// Anthropic ever closes or changes it, the widget must go quiet, not loud.
// A manual refresh, a credential rewrite by Claude Code, or unlock/resume allows
// ONE new attempt; a 429/529 means the endpoint is alive (just throttling), so
// it fully re-arms the breaker. While tripped, extended mode keeps ticking
// locally (JSONL) without touching the network.
const BREAKER_TRIP = 3;
const STATE_FILE = path.join(app.getPath('userData'), 'state.json');

// Feedback opens the user's own email client (mailto) — the app never sends
// anything on its own.
const FEEDBACK_EMAIL = 'kafkathepsychonaut@gmail.com';
const DONATE_URL = 'https://ko-fi.com/kafkathepsychonaut';
const THEME_BG = { classic: '#F4F1EA', bloodthirsty: '#1B1113', zombie: '#141017' };

let win = null;
let tray = null;
let pollTimer = null;
let paused = false;          // screen locked / suspended
let collapsed = false;
let mode = 'simple';         // 'simple' | 'extended'
let extMore = false;         // extended mode: fine-detail pane open (arrow toggle)
let extHeight = 0;           // renderer-measured content height for extended mode
let lastGood = null;         // last usage that succeeded (to show stale)
let lastTokens = null;       // last aggregate of Claude Code tokens
let settingsWin = null;
let updateAvailable = false; // a newer release exists (metadata only, nothing downloaded)
let updateDownloading = false;
let updateReady = false;     // downloaded; "update & restart" shows in tray + widget banner
let updateVersion = '';      // version string of the offered update
let updateProgress = 0;      // download % for the widget banner
let rlBackoff = 0;           // growing backoff when the endpoint returns 429
let rejected4xx = 0;         // consecutive server 4xx (non-429) — trips the breaker
let breakerRetry = false;    // pollNow() sets it: allow one network attempt while tripped
let polling = false;         // a poll is in flight (avoid overlapping requests)
let pollQueued = false;      // a refresh arrived mid-poll; run once more after
let quitting = false;

// ---- Position/state persistence ----
// v1.0.1 had no top-level productName, so Electron derived the userData dir
// from the old package name ("claude-count"). Carry state.json over once so
// updating doesn't reset position/theme/language/start-with-OS.
function migrateLegacyState() {
  try {
    if (fs.existsSync(STATE_FILE)) return; // already migrated or fresh state exists
    const legacy = path.join(app.getPath('appData'), 'claude-count', 'state.json');
    if (!fs.existsSync(legacy)) return;
    fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
    fs.copyFileSync(legacy, STATE_FILE);
  } catch (_) { /* fresh defaults are an acceptable fallback */ }
}

function loadState() {
  try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); } catch (_) { return {}; }
}
function saveState(patch) {
  let s = loadState();
  s = { ...s, ...patch };
  try { fs.writeFileSync(STATE_FILE, JSON.stringify(s)); } catch (_) {}
}

function defaultPosition() {
  const { workArea } = screen.getPrimaryDisplay();
  return {
    x: workArea.x + workArea.width - WIN_W - 24,
    y: workArea.y + 24,
  };
}

// Keep a saved position on a visible monitor — a display/DPI change can leave
// x/y outside every screen, hiding the window.
function clampPosition(x, y) {
  const a = screen.getDisplayNearestPoint({ x, y }).workArea;
  return {
    x: Math.min(Math.max(x, a.x), a.x + a.width - WIN_W),
    y: Math.min(Math.max(y, a.y), a.y + a.height - targetHeight()),
  };
}

// ---- Settings + language ----
function getSettings() {
  const s = loadState().settings || {};
  return {
    language: s.language || 'auto',
    startWithOS: s.startWithOS === true, // off by default: it reads a credential + hits Anthropic at boot
    theme: (s.theme === 'bloodthirsty' || s.theme === 'zombie') ? s.theme : 'classic',
    // 'endpoint' (live, all surfaces) | 'statusline' (Claude Code only, no endpoint)
    source: s.source === 'statusline' ? 'statusline' : 'endpoint',
  };
}
function setSetting(key, val) {
  const s = getSettings();
  s[key] = val;
  saveState({ settings: s });
}
const ALLOWED_THEMES = ['classic', 'bloodthirsty', 'zombie'];
// Whitelist + value check for settings written over IPC (the app reads a
// credential, so don't trust an arbitrary key/value from the renderer).
function validSetting(k, v) {
  if (k === 'startWithOS') return typeof v === 'boolean';
  if (k === 'theme') return ALLOWED_THEMES.includes(v);
  if (k === 'language') return v === 'auto' || (typeof v === 'string' && i18n.LANGS.some((l) => l.code === v));
  if (k === 'source') return v === 'endpoint' || v === 'statusline';
  return false;
}
function effectiveLocale() {
  const s = getSettings();
  const pref = (s.language && s.language !== 'auto') ? s.language : app.getLocale();
  return i18n.normalize(pref);
}
function applyStartup() {
  try { app.setLoginItemSettings({ openAtLogin: getSettings().startWithOS, name: 'Count Claudula' }); }
  catch (_) {}
}

// ---- Window ----
function createWindow() {
  const st = loadState();
  collapsed = !!st.collapsed;
  mode = st.mode === 'extended' ? 'extended' : 'simple';
  extMore = !!st.extMore;
  const pos = (Number.isFinite(st.x) && Number.isFinite(st.y)) ? clampPosition(st.x, st.y) : defaultPosition();

  win = new BrowserWindow({
    width: WIN_W,
    height: targetHeight(),
    x: pos.x,
    y: pos.y,
    frame: false,
    transparent: true,
    resizable: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    hasShadow: false,
    alwaysOnTop: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // Stays above even fullscreen apps, on every virtual desktop.
  win.setAlwaysOnTop(true, 'screen-saver');
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  win.once('ready-to-show', () => {
    win.show();
    win.webContents.send('ui:init', { collapsed, mode, extMore, locale: effectiveLocale(), theme: getSettings().theme });
    if (lastGood) win.webContents.send('usage:update', lastGood);
    if (lastTokens) win.webContents.send('tokens:update', lastTokens);
    win.webContents.send('update:state', updateUiState());
  });

  // Persist position when dragged.
  const persistPos = () => {
    if (!win) return;
    const [x, y] = win.getPosition();
    saveState({ x, y });
  };
  win.on('moved', persistPos);

  win.on('close', (e) => {
    if (!quitting) { e.preventDefault(); win.hide(); }
  });
}

function targetHeight() {
  if (collapsed) return H_COLLAPSED;
  if (extHeight) return extHeight; // renderer-measured (covers the update banner too)
  if (mode !== 'extended') return H_SIMPLE;
  return extMore ? H_EXT_MORE : H_EXTENDED;
}

function applyBounds() {
  if (!win) return;
  const [x, y] = win.getPosition();
  win.setBounds({ x, y, width: WIN_W, height: targetHeight() });
}

function setCollapsed(next) {
  collapsed = next;
  saveState({ collapsed });
  applyBounds();
}

function setMode(next) {
  mode = next === 'extended' ? 'extended' : 'simple';
  extHeight = 0; // stale for the new mode; the renderer re-reports right after
  saveState({ mode });
  applyBounds();
  if (mode === 'extended') pollNow(); // fetch tokens now
}

function setExtMore(next) {
  extMore = !!next;
  extHeight = 0; // stale for the new pane state; the renderer re-reports right after
  saveState({ extMore });
  applyBounds();
}

// The renderer measured its content height (see reportHeight() there).
function setExtHeight(h) {
  if (typeof h !== 'number' || !Number.isFinite(h)) return;
  const next = Math.max(120, Math.min(H_EXT_MAX, Math.round(h)));
  if (Math.abs(next - (extHeight || 0)) < 3) return; // ignore sub-pixel jitter
  extHeight = next;
  if (!collapsed) applyBounds();
}

// ---- Poller ----
function scheduleNext(ms) {
  clearTimeout(pollTimer);
  if (paused) return;
  pollTimer = setTimeout(poll, ms);
}

async function poll() {
  if (paused || polling) { if (polling) pollQueued = true; return; } // one request at a time
  polling = true;
  pollQueued = false;
  const allowNetwork = rejected4xx < BREAKER_TRIP || breakerRetry;
  breakerRetry = false; // a re-arm is good for exactly one attempt
  try {
    // Claude Code tokens: LOCAL data (JSONL). Runs independently of the network,
    // so it doesn't disappear when the usage endpoint is offline or the breaker
    // is tripped.
    if (mode === 'extended') {
      try {
        const tk = await todayUsage();
        if (tk) { lastTokens = tk; if (win) win.webContents.send('tokens:update', tk); }
      } catch (_) { /* don't break the cycle */ }
    }
    if (getSettings().source === 'statusline') {
      // statusLine source: 100% local (capture file written by Claude Code's
      // statusLine hook). No network, so no breaker/backoff concerns.
      try {
        const usage = readStatusline(app.getPath('userData'));
        lastGood = usage;
        if (win) win.webContents.send('usage:update', usage);
        updateTrayTitle(usage);
      } catch (err) {
        if (win) {
          win.webContents.send('usage:error', {
            message: err.message, expired: !!err.expired, at: Date.now(), last: lastGood,
          });
        }
      }
      scheduleNext(POLL_ACTIVE_MS);
      return;
    }
    if (!allowNetwork) {
      // Breaker is tripped and nothing re-armed it: local-only tick. Extended
      // mode keeps its tokens pane fresh; the endpoint is left alone.
      if (mode === 'extended') scheduleNext(POLL_ACTIVE_MS);
      else clearTimeout(pollTimer);
      return;
    }
    try {
      const usage = await fetchUsage();
      lastGood = usage;
      rlBackoff = 0;   // recovered: reset the rate-limit backoff
      rejected4xx = 0; // and re-arm the circuit breaker
      if (win) win.webContents.send('usage:update', usage);
      updateTrayTitle(usage);
      scheduleNext(POLL_ACTIVE_MS);
    } catch (err) {
      const status = err && err.status;
      if (err && err.rateLimited) {
        // 429/529 is throttling, not rejection — the endpoint answered, so it's
        // alive: fully re-arm the breaker and let the backoff below handle pace.
        rejected4xx = 0;
      } else if (Number.isInteger(status) && status >= 400 && status < 500) {
        rejected4xx++; // the server actively refused us (401/403/404/410/...)
      } else if (err && err.expired && !status) {
        // locally detected expiry — no request was made; leave the breaker as-is
      } else {
        rejected4xx = 0; // network blip / 5xx: transient, not a rejection
      }
      const tripped = rejected4xx >= BREAKER_TRIP;
      if (win) {
        win.webContents.send('usage:error', {
          message: err.message, expired: !!err.expired, unavailable: tripped, at: Date.now(), last: lastGood,
        });
      }
      if (err && err.rateLimited) {
        // 429/529: back off for real (exponential up to 30 min), honoring Retry-After
        rlBackoff = rlBackoff ? Math.min(rlBackoff * 2, 30 * 60 * 1000) : 5 * 60 * 1000;
        scheduleNext(Math.max(rlBackoff, (err.retryAfter || 0) * 1000));
      } else if (tripped) {
        // The endpoint keeps refusing: stop hitting it. Extended mode keeps a
        // local-only tick (JSONL pane); pollNow() (refresh button, tray,
        // credential rewrite, unlock/resume) allows one new attempt.
        if (mode === 'extended') scheduleNext(POLL_ACTIVE_MS);
        else clearTimeout(pollTimer);
      } else {
        scheduleNext(POLL_ERROR_MS); // network error: moderate retry
      }
    }
  } finally {
    polling = false;
    if (pollQueued) { pollQueued = false; if (!paused) scheduleNext(0); } // run the coalesced refresh
  }
}

function pollNow() {
  paused = false;
  breakerRetry = true; // a deliberate signal (user gesture, new token, resume) re-arms one attempt
  if (polling) { pollQueued = true; return; } // coalesce into the in-flight poll
  scheduleNext(0);
}

// Watch the credential file so we re-poll the instant Claude Code rewrites it.
// Without this, a stale "token expired" would linger until the next timed poll
// (up to ~90s) even though Claude Code already refreshed the token. We watch the
// *directory* (not the file) so the watcher survives the atomic rename-replace
// Claude Code uses when rewriting the file. Read-only — our own polls never write
// the file, so this can't feed back on itself.
let credWatcher = null;
let credWatchDebounce = null;
let credWatchRetry = null;
function watchCredentials() {
  let dir, file;
  try { const p = credPath(); dir = path.dirname(p); file = path.basename(p); }
  catch (_) { return; }
  clearTimeout(credWatchRetry);
  try {
    credWatcher = fs.watch(dir, (_evt, fname) => {
      if (fname && fname !== file) return; // ignore other files in ~/.claude
      clearTimeout(credWatchDebounce);
      // small debounce: the rename-replace fires several events; let it settle
      credWatchDebounce = setTimeout(() => { if (!paused) pollNow(); }, 400);
    });
    credWatcher.on('error', () => { try { credWatcher.close(); } catch (_) {} credWatcher = null; scheduleWatchRetry(); });
  } catch (_) {
    // dir missing/unwatchable (e.g. installed before Claude Code's first run):
    // timed polling still covers recovery; keep retrying so instant refresh
    // detection comes back once ~/.claude exists.
    scheduleWatchRetry();
  }
}
function scheduleWatchRetry() {
  clearTimeout(credWatchRetry);
  credWatchRetry = setTimeout(watchCredentials, 5 * 60 * 1000);
}

// ---- statusLine capture watcher ----
// With the statusline source active, watch the capture file so the widget
// refreshes the moment Claude Code updates its status line (polling still
// covers if watching fails). userData always exists, so no retry dance here.
let slWatcher = null;
let slDebounce = null;
function watchStatusline() {
  unwatchStatusline();
  if (getSettings().source !== 'statusline') return;
  try {
    slWatcher = fs.watch(app.getPath('userData'), (_evt, fname) => {
      if (fname && fname !== 'statusline.json') return;
      clearTimeout(slDebounce);
      slDebounce = setTimeout(() => { if (!paused) pollNow(); }, 400);
    });
    slWatcher.on('error', () => { unwatchStatusline(); });
  } catch (_) { /* timed polling still covers */ }
}
function unwatchStatusline() {
  clearTimeout(slDebounce);
  try { if (slWatcher) slWatcher.close(); } catch (_) {}
  slWatcher = null;
}

// ---- Tray ----
function updateTrayTitle(usage) {
  if (!tray) return;
  const five = usage && usage.fiveHour ? usage.fiveHour.utilization + '%' : '--';
  const seven = usage && usage.sevenDay ? usage.sevenDay.utilization + '%' : '--';
  tray.setToolTip(`Count Claudula · 5h ${five} · 7d ${seven}`);
}

function rebuildTrayMenu() {
  if (!tray) return;
  const L = effectiveLocale();
  const items = [
    { label: i18n.t(L, 'tray_showhide'), click: toggleWindow },
    { label: i18n.t(L, 'tray_expand'), click: expandPanel },
    { label: i18n.t(L, 'tray_refresh'), click: pollNow },
    { label: i18n.t(L, 'tray_settings'), click: openSettings },
    { label: i18n.t(L, 'set_donate'), click: () => shell.openExternal(DONATE_URL) },
  ];
  if (updateReady) {
    items.push({ type: 'separator' }, { label: i18n.t(L, 'update_restart'), click: installUpdate });
  } else if (updateAvailable && !updateDownloading) {
    items.push({ type: 'separator' }, { label: i18n.t(L, 'update_download'), click: startUpdateDownload });
  }
  items.push({ type: 'separator' }, { label: i18n.t(L, 'tray_quit'), click: () => { quitting = true; app.quit(); } });
  tray.setContextMenu(Menu.buildFromTemplate(items));
}

// ---- Update UI (tray + in-widget banner) ----
function updateUiState() {
  if (updateReady) return { state: 'ready', version: updateVersion };
  if (updateDownloading) return { state: 'downloading', version: updateVersion, percent: updateProgress };
  if (updateAvailable) return { state: 'available', version: updateVersion };
  return { state: 'none' };
}
// Keep both surfaces in sync. Download progress skips the tray rebuild —
// progress events fire often and only the banner shows a percentage.
function syncUpdateUi(progressOnly) {
  if (!progressOnly) rebuildTrayMenu();
  if (win) win.webContents.send('update:state', updateUiState());
}
function startUpdateDownload() {
  if (!updateAvailable || updateDownloading || updateReady) return;
  updateDownloading = true;
  updateProgress = 0;
  syncUpdateUi();
  autoUpdater.downloadUpdate().catch(() => { updateDownloading = false; syncUpdateUi(); });
}
function installUpdate() {
  if (!updateReady) return;
  quitting = true;
  // silent NSIS run + relaunch: updating never reopens the install wizard
  autoUpdater.quitAndInstall(true, true);
}

// Update via GitHub releases (packaged app only; NSIS — the portable doesn't update).
function setupUpdater() {
  // Packaged NSIS install only. The portable build can't self-update (latest.yml
  // points at the installer), so skip it there (electron-builder sets this env).
  if (!app.isPackaged || process.env.PORTABLE_EXECUTABLE_DIR) return;
  // Consent-first: the Windows build is unsigned, and electron-updater can't
  // verify signatures on an unsigned app — so nothing is ever downloaded
  // silently. We only check metadata; the user starts the download from the
  // tray ("Download update") and the install happens on restart/quit.
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on('update-available', (info) => {
    updateAvailable = true;
    updateVersion = (info && info.version) || '';
    syncUpdateUi();
  });
  // e.g. a yanked release: stop offering a download that would just fail
  autoUpdater.on('update-not-available', () => {
    if (updateAvailable) { updateAvailable = false; updateVersion = ''; syncUpdateUi(); }
  });
  autoUpdater.on('download-progress', (p) => {
    updateProgress = Math.round((p && p.percent) || 0);
    syncUpdateUi(true);
  });
  autoUpdater.on('update-downloaded', () => { updateDownloading = false; updateReady = true; syncUpdateUi(); });
  autoUpdater.on('error', () => {
    // offline / no release / failed download: stay silent, re-offer the item
    if (updateDownloading) { updateDownloading = false; syncUpdateUi(); }
  });
  const check = () => {
    // Don't disturb an in-flight download or a downloaded-and-waiting update:
    // a failed periodic check would otherwise reset the download state.
    if (updateDownloading || updateReady) return;
    try { autoUpdater.checkForUpdates().catch(() => {}); } catch (_) {}
  };
  setTimeout(check, 15000);
  setInterval(check, 6 * 60 * 60 * 1000);
}

function buildTray() {
  tray = new Tray(makeTrayIcon());
  tray.setToolTip('Count Claudula · ' + i18n.t(effectiveLocale(), 'tray_loading'));
  rebuildTrayMenu();
  tray.on('click', toggleWindow);
}

function openSettings() {
  if (settingsWin) { settingsWin.show(); settingsWin.focus(); return; }
  settingsWin = new BrowserWindow({
    width: 344,
    height: 560,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    title: 'Count Claudula',
    icon: makeTrayIcon(),
    backgroundColor: THEME_BG[getSettings().theme] || '#F4F1EA',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  settingsWin.setMenuBarVisibility(false);
  settingsWin.loadFile(path.join(__dirname, 'renderer', 'settings.html'));
  settingsWin.on('closed', () => { settingsWin = null; });
}

function expandPanel() {
  if (!win) createWindow();
  win.show();
  win.setAlwaysOnTop(true, 'screen-saver');
  win.webContents.send('ui:expand');
}

function toggleWindow() {
  if (!win) return createWindow();
  if (win.isVisible()) win.hide();
  else { win.show(); win.setAlwaysOnTop(true, 'screen-saver'); pollNow(); }
}

// ---- Power: pause on lock/suspend ----
function wirePowerEvents() {
  powerMonitor.on('lock-screen', () => { paused = true; clearTimeout(pollTimer); });
  powerMonitor.on('suspend', () => { paused = true; clearTimeout(pollTimer); });
  powerMonitor.on('unlock-screen', pollNow);
  powerMonitor.on('resume', pollNow);
}

// ---- IPC from the renderer ----
ipcMain.on('ui:refresh', pollNow);
ipcMain.on('ui:collapse', (_e, next) => setCollapsed(!!next));
ipcMain.on('ui:mode', (_e, m) => setMode(m));
ipcMain.on('ui:extmore', (_e, v) => setExtMore(!!v));
ipcMain.on('ui:height', (_e, h) => setExtHeight(h));
ipcMain.on('ui:update-download', startUpdateDownload);
ipcMain.on('ui:update-restart', installUpdate);
ipcMain.on('ui:settings', openSettings);
ipcMain.on('ui:donate', () => shell.openExternal(DONATE_URL));
ipcMain.on('ui:hide', () => { if (win) win.hide(); });
ipcMain.on('ui:quit', () => { quitting = true; app.quit(); });

ipcMain.handle('settings:get', () => ({
  settings: getSettings(),
  langs: i18n.LANGS,
  locale: effectiveLocale(),
  statuslineCmd: captureCommand(app.getPath('userData')),
}));
ipcMain.on('settings:set', (_e, payload) => {
  const { k, v } = payload || {}; // tolerate a malformed/empty payload
  if (!validSetting(k, v)) return; // reject unknown key / invalid value
  setSetting(k, v);
  if (k === 'startWithOS') applyStartup();
  if (k === 'language') {
    const loc = effectiveLocale();
    if (win) win.webContents.send('ui:locale', loc);
    if (settingsWin) settingsWin.webContents.send('ui:locale', loc);
    rebuildTrayMenu();
  }
  if (k === 'theme') {
    const th = getSettings().theme;
    if (win) win.webContents.send('ui:theme', th);
    if (settingsWin) settingsWin.webContents.send('ui:theme', th);
  }
  if (k === 'source') {
    if (v === 'statusline') ensureCaptureScript(app.getPath('userData'));
    watchStatusline(); // attaches or detaches per the new source
    pollNow();
  }
});
ipcMain.on('settings:close', () => { if (settingsWin) settingsWin.close(); });

ipcMain.handle('feedback:send', async (_e, text) => {
  const meta = `\n\n— Count Claudula v${app.getVersion()} · ${process.platform} · ${effectiveLocale()}`;
  // mailto: URLs have a practical length ceiling in several clients/OSes
  // (~2000 chars); a longer body can make the email silently fail to open.
  const body = String(text || '').slice(0, 1800) + meta;
  const subject = encodeURIComponent('Count Claudula — feedback');
  await shell.openExternal(`mailto:${FEEDBACK_EMAIL}?subject=${subject}&body=${encodeURIComponent(body)}`);
  return { ok: true, method: 'mailto' };
});

// ---- Boot ----
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => { if (win) { win.show(); win.focus(); } });
  app.whenReady().then(() => {
    if (process.platform === 'win32') app.setAppUserModelId('com.countclaudula.app');
    migrateLegacyState();
    createWindow();
    buildTray();
    wirePowerEvents();
    applyStartup();
    if (getSettings().source === 'statusline') ensureCaptureScript(app.getPath('userData'));
    pollNow();
    watchCredentials();
    watchStatusline();
    setupUpdater();
  });
  app.on('before-quit', () => {
    quitting = true;
    clearTimeout(pollTimer);
    clearTimeout(credWatchDebounce);
    clearTimeout(credWatchRetry);
    try { if (credWatcher) credWatcher.close(); } catch (_) {}
    unwatchStatusline();
  });
  app.on('window-all-closed', (e) => { /* stays alive in the tray */ });
  app.on('activate', () => { if (!win) createWindow(); else win.show(); });
}
