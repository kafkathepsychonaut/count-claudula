'use strict';
const { app, BrowserWindow, Tray, Menu, ipcMain, powerMonitor, screen, nativeImage, shell } = require('electron');
const fs = require('fs');
const path = require('path');
const { fetchUsage, credPath } = require('./usage');
const { todayUsage } = require('./usage-jsonl');
const { makeTrayIcon } = require('./icon');
const i18n = require('./renderer/i18n');
const { autoUpdater } = require('electron-updater');

// ---- Config ----
const WIN_W = 268;
const H_SIMPLE = 218;     // simple mode (2 bars)
const H_EXTENDED = 408;   // extended mode (+ Claude Code tokens)
const H_COLLAPSED = 60;
const POLL_ACTIVE_MS = 180 * 1000;  // 3 min — the data changes slowly; gentle on the endpoint's rate limit
const POLL_ERROR_MS = 90 * 1000;    // 90s for NETWORK error (429 uses its own exponential backoff)
const STATE_FILE = path.join(app.getPath('userData'), 'state.json');

// Feedback. Empty FEEDBACK_ENDPOINT => opens the user's email (mailto).
// Set a URL (Formspree/serverless) for silent in-app sending, with no embedded secret.
const FEEDBACK_EMAIL = 'kafkathepsychonaut@gmail.com';
const FEEDBACK_ENDPOINT = '';
const DONATE_URL = 'https://ko-fi.com/kafkathepsychonaut';
const THEME_BG = { classic: '#F4F1EA', bloodthirsty: '#1B1113', zombie: '#141017' };

let win = null;
let tray = null;
let pollTimer = null;
let paused = false;          // screen locked / suspended
let collapsed = false;
let mode = 'simple';         // 'simple' | 'extended'
let lastGood = null;         // last usage that succeeded (to show stale)
let lastTokens = null;       // last aggregate of Claude Code tokens
let settingsWin = null;
let updateReady = false;
let rlBackoff = 0;           // growing backoff when the endpoint returns 429
let polling = false;         // a poll is in flight (avoid overlapping requests)
let pollQueued = false;      // a refresh arrived mid-poll; run once more after
let quitting = false;

// ---- Position/state persistence ----
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
    win.webContents.send('ui:init', { collapsed, mode, locale: effectiveLocale(), theme: getSettings().theme });
    if (lastGood) win.webContents.send('usage:update', lastGood);
    if (lastTokens) win.webContents.send('tokens:update', lastTokens);
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
  return mode === 'extended' ? H_EXTENDED : H_SIMPLE;
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
  saveState({ mode });
  applyBounds();
  if (mode === 'extended') pollNow(); // fetch tokens now
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
  try {
    // Claude Code tokens: LOCAL data (JSONL). Runs independently of the network,
    // so it doesn't disappear when the usage endpoint is offline.
    if (mode === 'extended') {
      try {
        const tk = await todayUsage();
        if (tk) { lastTokens = tk; if (win) win.webContents.send('tokens:update', tk); }
      } catch (_) { /* don't break the cycle */ }
    }
    try {
      const usage = await fetchUsage();
      lastGood = usage;
      rlBackoff = 0; // recovered: reset the rate-limit backoff
      if (win) win.webContents.send('usage:update', usage);
      updateTrayTitle(usage);
      scheduleNext(POLL_ACTIVE_MS);
    } catch (err) {
      if (win) win.webContents.send('usage:error', { message: err.message, expired: !!err.expired, at: Date.now(), last: lastGood });
      if (err && err.rateLimited) {
        // 429/529: back off for real (exponential up to 30 min), honoring Retry-After
        rlBackoff = rlBackoff ? Math.min(rlBackoff * 2, 30 * 60 * 1000) : 5 * 60 * 1000;
        scheduleNext(Math.max(rlBackoff, (err.retryAfter || 0) * 1000));
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
function watchCredentials() {
  let dir, file;
  try { const p = credPath(); dir = path.dirname(p); file = path.basename(p); }
  catch (_) { return; }
  try {
    credWatcher = fs.watch(dir, (_evt, fname) => {
      if (fname && fname !== file) return; // ignore other files in ~/.claude
      clearTimeout(credWatchDebounce);
      // small debounce: the rename-replace fires several events; let it settle
      credWatchDebounce = setTimeout(() => { if (!paused) pollNow(); }, 400);
    });
    credWatcher.on('error', () => { try { credWatcher.close(); } catch (_) {} credWatcher = null; });
  } catch (_) { /* dir missing/unwatchable: timed polling still covers recovery */ }
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
    items.push({ type: 'separator' }, {
      label: i18n.t(L, 'update_restart'),
      click: () => { quitting = true; autoUpdater.quitAndInstall(); },
    });
  }
  items.push({ type: 'separator' }, { label: i18n.t(L, 'tray_quit'), click: () => { quitting = true; app.quit(); } });
  tray.setContextMenu(Menu.buildFromTemplate(items));
}

// Auto-update via GitHub releases (packaged app only; NSIS — the portable doesn't update).
function setupUpdater() {
  // Packaged NSIS install only. The portable build can't self-update (latest.yml
  // points at the installer), so skip it there (electron-builder sets this env).
  if (!app.isPackaged || process.env.PORTABLE_EXECUTABLE_DIR) return;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on('update-downloaded', () => { updateReady = true; rebuildTrayMenu(); });
  autoUpdater.on('error', () => { /* offline / no release: stay silent */ });
  const check = () => { try { autoUpdater.checkForUpdates().catch(() => {}); } catch (_) {} };
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
    height: 470,
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
ipcMain.on('ui:settings', openSettings);
ipcMain.on('ui:donate', () => shell.openExternal(DONATE_URL));
ipcMain.on('ui:hide', () => { if (win) win.hide(); });
ipcMain.on('ui:quit', () => { quitting = true; app.quit(); });

ipcMain.handle('settings:get', () => ({
  settings: getSettings(),
  langs: i18n.LANGS,
  locale: effectiveLocale(),
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
});
ipcMain.on('settings:close', () => { if (settingsWin) settingsWin.close(); });

ipcMain.handle('feedback:send', async (_e, text) => {
  const meta = `\n\n— Count Claudula v${app.getVersion()} · ${process.platform} · ${effectiveLocale()}`;
  const body = String(text || '').slice(0, 5000) + meta;
  if (FEEDBACK_ENDPOINT) {
    try {
      const r = await fetch(FEEDBACK_ENDPOINT, {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ message: body, app: 'Count Claudula', version: app.getVersion() }),
      });
      if (r.ok) return { ok: true, method: 'endpoint' };
    } catch (_) { /* falls back to mailto */ }
  }
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
    createWindow();
    buildTray();
    wirePowerEvents();
    applyStartup();
    pollNow();
    watchCredentials();
    setupUpdater();
  });
  app.on('window-all-closed', (e) => { /* stays alive in the tray */ });
  app.on('activate', () => { if (!win) createWindow(); else win.show(); });
}
