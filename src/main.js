'use strict';
const { app, BrowserWindow, Tray, Menu, ipcMain, powerMonitor, screen, shell, Notification } = require('electron');
const fs = require('fs');
const path = require('path');
const { fetchUsage, credPath } = require('./usage');
const { todayUsage, setCacheDir, flushCache } = require('./usage-jsonl');
const { readStatusline, ensureCaptureScript, captureCommand, isCaptureFileName } = require('./usage-statusline');
const claudeSettings = require('./claude-settings');
const { makeTrayIcon, makeMenuBarIcon } = require('./icon');
const i18n = require('./renderer/i18n');
const { autoUpdater } = require('electron-updater');

// ---- Config ----
const WIN_W = 246; // fleet frame: window == card (former 11px body padding removed)
const H_SIMPLE = 218;     // simple mode (2 bars)
// Extended mode is content-driven: the renderer measures its content (limit
// rows, per-model rows and label lengths all vary) and reports the height over
// IPC. These are only the fallbacks used before the first report arrives.
const H_EXTENDED = 380;   // fallback: fine-detail pane closed
const H_EXT_MORE = 600;   // fallback: fine-detail pane open
const H_EXT_MAX = 760;    // sanity cap for renderer-reported heights
const H_COLLAPSED = 38; // fleet frame: former 2*11px body padding removed
const POLL_ACTIVE_MS = 180 * 1000;  // 3 min — the data changes slowly; gentle on the endpoint's rate limit
const POLL_STATUSLINE_MS = 60 * 1000; // statusLine is a LOCAL file read (no rate limit): the file watcher drives real-time updates, so this timer is only a staleness/countdown fallback and can be far tighter than the endpoint cadence
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
// Where a macOS user is sent to fetch a build the app can't install for them.
const RELEASES_URL = 'https://github.com/kafkathepsychonaut/count-claudula/releases/latest';
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
let lastError = null;        // last usage:error payload (replayed to a fresh renderer;
                             // the boot poll often finishes before the window loads)
let lastTokens = null;       // last aggregate of Claude Code tokens
let settingsWin = null;
let updateAvailable = false; // a newer release exists (metadata only, nothing downloaded)
let updateSnoozed = false;   // banner dismissed for this version (tray still offers it)
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
let paceSamples = [];        // recent (t, 5h-utilization) samples -> burn-rate hint

// ---- Pace (burn rate) ----
// The endpoint is sampled every ~3 min anyway; keeping a short window of those
// samples lets the widget answer its core question — "am I going to hit the
// limit before it resets?" — instead of only showing the current level.
const PACE_WINDOW_MS = 90 * 60 * 1000;
const PACE_MIN_SPAN_MS = 4 * 60 * 1000; // a couple of polls of runway before a slope means anything
// How old the newest sample may be and still support a "hot" verdict. The
// statusline source keeps returning data for 2h after the last Claude Code
// session goes quiet; a burn rate measured that long ago is history, not a
// prediction, so it must not keep the warning lit while the user is idle.
const PACE_HOT_MAX_AGE_MS = 10 * 60 * 1000;

// The endpoint reports `resets_at` with a jittering sub-second fraction — the
// string differs on EVERY poll even though the real reset time is fixed. Compare
// it at minute granularity so that noise never looks like a window roll (a real
// roll moves it by ~5h). Returns a stable integer key (minutes since epoch).
function windowKey(resetsAt) {
  return resetsAt ? Math.floor(new Date(resetsAt).getTime() / 60000) : 0;
}

function computePace(usage) {
  const w = usage && usage.fiveHour;
  if (!w || typeof w.utilization !== 'number') { paceSamples = []; return null; }
  const now = usage.fetchedAt || Date.now();
  const wall = Date.now();
  const rk = windowKey(w.resetsAt);
  const last = paceSamples[paceSamples.length - 1];
  // Only a genuine window ROLL invalidates the slope, and the reset boundary is
  // what proves one: a roll moves it by ~5h. A falling utilization does NOT —
  // the statusline aggregate is the MAX across sessions fresher than 2h, so when
  // the session holding the high value crosses that cutoff the number drops back
  // to a surviving session's frozen, lower reading with no reset in sight.
  // Wiping there erased a genuine hot warning AND re-seeded the buffer at the
  // understated value; the next API response then snapped it back up and that
  // artificial jump was read as real burn (a wild perHour and a false "you'll
  // hit the limit before reset"). Only fall back to the utilization test when
  // there's no reset boundary to compare (endpoint payloads without resets_at).
  const rolled = !!last && ((last.r && rk) ? last.r !== rk : w.utilization < last.u - 1);
  if (rolled) paceSamples = [];
  // Inside one window usage only ever climbs (it resets, it doesn't fall), so a
  // dip is an aggregation artifact — or ±1 integer rounding noise on the
  // endpoint. Carry the last known level instead of recording the dip, and read
  // the current level off the buffer so a fabricated jump can't follow.
  const prev = rolled ? null : last;
  const level = (prev && w.utilization < prev.u) ? prev.u : w.utilization;
  if (!last || last.t !== now) paceSamples.push({ t: now, u: level, r: rk });
  paceSamples = paceSamples.filter((s) => now - s.t <= PACE_WINDOW_MS);
  const first = paceSamples[0];
  const cur = paceSamples[paceSamples.length - 1];
  const spanMs = now - first.t;
  if (paceSamples.length < 2 || spanMs < PACE_MIN_SPAN_MS) return null;
  // Clamp to 0: a flat or drifting-down window reads as "≈ +0%/h" (steady) rather
  // than vanishing — the hint stays visible almost all the time once it's warm.
  const perHour = Math.max(0, (cur.u - first.u) / (spanMs / 3600000));
  // Time-to-reset is measured against the WALL CLOCK, never `now`. With the
  // statusline source `now` is the newest capture's timestamp, and that stops
  // advancing the moment every Claude Code session goes idle — while
  // readStatusline keeps succeeding for up to 2h. Measuring from that frozen
  // instant kept comparing the pace against runway that had already elapsed, so
  // the widget sat on a red "hot" warning while the user did nothing, and went
  // on asserting it after the reset had already passed.
  const hoursToReset = w.resetsAt ? (new Date(w.resetsAt).getTime() - wall) / 3600000 : 0;
  const hoursTo100 = perHour > 0 ? (100 - cur.u) / perHour : Infinity;
  return {
    perHour: Math.round(perHour),
    // "hot" = at this pace the limit arrives before the reset does. A burn rate
    // last observed ages ago says nothing about right now, so stale captures
    // can't keep the warning lit indefinitely.
    hot: perHour > 0 && hoursToReset > 0 && hoursTo100 < hoursToReset && (wall - now) <= PACE_HOT_MAX_AGE_MS,
  };
}

// Warm the burn-rate buffer from disk so a restart doesn't blank the hint for
// minutes. Stale samples (older than the window) are dropped on the next compute.
function restorePaceSamples() {
  try {
    const saved = loadState().paceSamples;
    if (Array.isArray(saved)) paceSamples = saved.filter((s) => s && typeof s.t === 'number');
  } catch (_) { /* fresh start is fine */ }
}

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

// The default data source flipped to 'statusline' (ToS-clean) in v1.4.0. An
// install from BEFORE the flip was silently using the endpoint; don't yank it
// out from under them into a source that needs manual setup — pin 'endpoint'
// once for those. Everyone else gets the new default.
//
// THE TRAP, for whoever touches this next: "state.json exists" is NOT "installed
// before the flip", and reading it that way (the original guard) silently moved
// essentially every fresh v1.4 install onto the ToS-violating endpoint on its
// SECOND launch, bypassing the app's own consent dialog. A fresh install never
// persists settings.source — getSettings() only COMPUTES the 'statusline'
// default, and statusline:apply skips writing it for exactly that reason — yet
// state.json appears within seconds of first run for unrelated reasons
// (ui:onboarded from every path through the first-run card, x/y on a window
// drag, paceSamples + sawStatuslineRateLimits on every successful poll).
//
// There is NO heuristic that separates the two populations, and trying was the
// second mistake. A pre-flip upgrader and a bug-flipped v1.4 install both end up
// with exactly `settings.source: 'endpoint'` written by this same function — the
// files are byte-identical. (The previous attempt keyed off persisted
// paceSamples, which only exists from v1.3.4 on, so 13 of the 14 pre-flip tags
// would have been pushed the other way.)
//
// So stop guessing and ask a question that HAS an answer: did the user ever pass
// the ToS gate for this source? That gate is the only place endpoint use is
// consented to, and from now on answering it persists `endpointConsent`. An
// 'endpoint' pin without that marker was never consented to by anybody — it was
// written by a migration, in both populations — so it gets moved to the clean
// source once, and `endpointResetAt` tells Settings to explain why.
//
// That deliberately also moves genuine pre-flip endpoint users. It's the right
// call, not just the safe one: they never consented either (the endpoint was
// simply the only source back then, before its Terms status was understood).
// Recovery is one click through the gate, and now they find out it happened —
// which is precisely what the original bug denied everyone.
//
// The decision is written down before anything else can create state.json, so it
// runs exactly once per install. Runs after migrateLegacyState() so a
// legacy-migrated user counts as existing.
function resolveSourceOnce() {
  try {
    const s = loadState();
    const cur = s.settings || {};
    const src = cur.source;
    if (src === 'statusline') return;                                // already on the safe source
    if (src === 'endpoint' && cur.endpointConsent === true) return;   // they answered the gate: their call, never touch it
    const patch = { ...cur, source: 'statusline' };
    // Only an un-consented endpoint pin needs explaining; a fresh install that
    // never had a source resolves silently to the default it would have had.
    if (src === 'endpoint') patch.endpointResetAt = Date.now();
    saveState({ settings: patch });
  } catch (_) { /* worst case the widget shows the statusline setup nudge, not a crash */ }
}

// A read that FAILED is not an empty state. saveState() merges its patch over
// whatever loadState() returned, so one transient EBUSY/EPERM (Windows AV or a
// backup holding state.json open for a moment) used to make the very next write
// persist ONLY the patch — permanently discarding position, theme, language,
// startWithOS, onboarded, snoozedVersion and settings.source. And every
// successful poll writes paceSamples, so the exposure was continuous.
// So: ENOENT means "no state yet, start fresh" and is safe to write over;
// anything else means "we don't know what's in there" and blocks the merge
// until a read succeeds again (the next poll retries seconds later).
let stateUnreadable = false;
function loadState() {
  try {
    const s = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    stateUnreadable = false;
    return (s && typeof s === 'object' && !Array.isArray(s)) ? s : {};
  } catch (e) {
    if (e && e.code === 'ENOENT') { stateUnreadable = false; return {}; }
    if (e instanceof SyntaxError) {
      // Content we can't parse is NOT transient — refusing forever would mean
      // never persisting anything again. Keep a copy (so nothing is destroyed
      // silently) and start fresh. With the atomic write below this should now
      // only ever be a file damaged from outside the app.
      try { fs.renameSync(STATE_FILE, STATE_FILE + '.bad'); } catch (_) {}
      stateUnreadable = false;
      return {};
    }
    stateUnreadable = true;
    return {};
  }
}
function saveState(patch) {
  const s = loadState();
  if (stateUnreadable) return; // don't merge over state we failed to read: that's how keys vanish
  const next = { ...s, ...patch };
  const tmp = STATE_FILE + '.' + process.pid + '.tmp';
  try {
    // Temp + rename (same trick as the statusLine capture script): a crash or a
    // power cut mid-write can't leave truncated JSON behind, which would parse
    // as {} and take every setting with it.
    fs.writeFileSync(tmp, JSON.stringify(next));
    fs.renameSync(tmp, STATE_FILE);
  } catch (_) { try { fs.unlinkSync(tmp); } catch (_) {} }
}

function defaultPosition() {
  const { workArea } = screen.getPrimaryDisplay();
  return {
    x: workArea.x + workArea.width - WIN_W - 24,
    y: workArea.y + 24,
  };
}

// Keep a saved position on a visible monitor — a display/DPI change can leave
// x/y outside every screen, hiding the window. `h` is the height the window is
// ABOUT to have: the pane grows downward, so the clamp has to be done against
// the new height, not the current one.
function clampPosition(x, y, h) {
  const height = h || targetHeight();
  const a = screen.getDisplayNearestPoint({ x, y }).workArea;
  // Math.max on the ceiling keeps the TOP edge on screen when the window is
  // taller than the work area (a long extended pane on a short display): the
  // header and the bars stay reachable, the overflow falls off the bottom.
  return {
    x: Math.min(Math.max(x, a.x), Math.max(a.x, a.x + a.width - WIN_W)),
    y: Math.min(Math.max(y, a.y), Math.max(a.y, a.y + a.height - height)),
  };
}

// ---- Settings + language ----
function getSettings() {
  const s = loadState().settings || {};
  return {
    language: s.language || 'auto',
    startWithOS: s.startWithOS === true, // off by default: it reads a credential + hits Anthropic at boot
    theme: (s.theme === 'bloodthirsty' || s.theme === 'zombie') ? s.theme : 'classic',
    // 'statusline' (Claude Code only, no endpoint — the ToS-clean default) |
    // 'endpoint' (live, all surfaces, but automated access to an internal endpoint).
    // resolveSourceOnce() settles and PERSISTS a source at first boot, so in
    // practice s.source is always set; this default is the fallback for a state
    // file we couldn't read, and it must stay on the safe side of that.
    source: s.source === 'endpoint' ? 'endpoint' : 'statusline',
    // Did the user actually answer the ToS gate for the endpoint? Only ever set
    // by that dialog — an endpoint pin written by a migration has no such mark.
    endpointConsent: s.endpointConsent === true,
    // Set once when an un-consented endpoint pin was moved back to the clean
    // source, so Settings can say why instead of the switch looking arbitrary.
    endpointResetAt: typeof s.endpointResetAt === 'number' ? s.endpointResetAt : 0,
    // macOS only: where the numbers live. 'widget' = the floating always-on-top
    // window (the default, and the only option everywhere else); 'menubar' =
    // the percentages written as text next to the menu bar icon, with no
    // floating window and no dock icon. Windows/Linux trays can't render text,
    // which is why this is a mac-only choice rather than a global one.
    macBar: s.macBar === 'menubar' ? 'menubar' : 'widget',
  };
}
// macOS + the user chose the menu bar: no floating window, no dock icon, the
// numbers ride in the bar. Every caller has to go through this — reading
// getSettings().macBar directly would light the mode up on Windows too.
function menuBarMode() {
  return process.platform === 'darwin' && getSettings().macBar === 'menubar';
}
// setSetting rewrites the whole whitelisted settings object, so any companion
// field (the consent mark) has to travel with it or it would be dropped here.
function setSetting(key, val, extra) {
  const s = getSettings();
  s[key] = val;
  if (extra) Object.assign(s, extra);
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
  if (k === 'macBar') return v === 'widget' || v === 'menubar';
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
// Chromium's default reaction to a file or link DROPPED on a window is to
// navigate that window to the dropped target. This widget is frameless,
// always-on-top and visible on every workspace, so it sits in the path of every
// drag across the desktop — and the preload bridge SURVIVES an in-window
// navigation, which would hand a dropped remote page the entire
// window.claudeCount API: statuslineApply() rewrites another application's
// settings.json, settingsSet('source','endpoint') switches on the ban-risk data
// source, quit() kills the app. On top of that the widget is never destroyed
// (close only hides it), so a single stray drop bricked it until relaunch.
// Pin both windows to the file they were loaded with: nothing navigates them,
// nothing opens a child window from them. (The renderers also swallow
// dragover/drop, so it takes two failures to get here.)
function lockNavigation(bw) {
  bw.webContents.on('will-navigate', (e, url) => {
    if (url !== bw.webContents.getURL()) e.preventDefault();
  });
  bw.webContents.on('will-redirect', (e, url) => {
    if (url !== bw.webContents.getURL()) e.preventDefault();
  });
  bw.webContents.setWindowOpenHandler(() => ({ action: 'deny' })); // links open in the user's browser via shell.openExternal, never in a bridged window
  bw.webContents.on('will-attach-webview', (e) => e.preventDefault());
}

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

  lockNavigation(win);
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  win.once('ready-to-show', () => {
    // In mac menu bar mode the window still exists and still renders (it's what
    // the reset countdown and the update banner live in, and one tray click
    // brings it up), it just doesn't take the screen uninvited.
    if (!menuBarMode()) win.show();
    // onboard: fresh install that never dismissed the first-run setup card —
    // the renderer only shows it if the statusline source also reports needsSetup
    win.webContents.send('ui:init', { collapsed, mode, extMore, locale: effectiveLocale(), theme: getSettings().theme, onboard: !loadState().onboarded });
    if (lastGood) win.webContents.send('usage:update', lastGood);
    if (lastError) win.webContents.send('usage:error', lastError);
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

// Every resize goes through here. The window grows DOWNWARD from its current
// top-left, and the heights involved are not small: 60 (collapsed) or 218
// (simple) can become 380-760 (extended). A widget legitimately parked near the
// bottom edge therefore pushed most of the expanded pane off-screen — and it's
// non-resizable with overflow:hidden, so that content was simply unreachable.
// Boot-time clamping only ever guaranteed the height it ran with, so re-clamp
// against the work area on every height change.
function applyBounds() {
  if (!win) return;
  const [x, y] = win.getPosition();
  const h = targetHeight();
  const p = clampPosition(x, y, h);
  win.setBounds({ x: p.x, y: p.y, width: WIN_W, height: h });
  // Deliberately NOT persisted. This nudge is a consequence of the height we're
  // showing right now, not a place the user put the window: persisting it would
  // let one expand permanently move a widget they had parked at the bottom
  // corner, and collapsing again would leave it somewhere they never chose.
  // The saved x/y stays theirs; a real drag is what updates it (persistPos).
}

// The display topology changed under a running widget. The saved x/y was only
// clamped once, at boot, so unplugging the monitor that held the widget (or
// shrinking its work area — resolution change, a dock/taskbar appearing) left
// this always-on-top window stranded off every screen: invisible, with no way
// back short of quitting and relaunching. Re-clamp it into a visible work area.
let reclampTimer = null;
function reclampWindow() {
  if (!win || win.isDestroyed()) return;
  const [x, y] = win.getPosition();
  const p = clampPosition(x, y);
  if (p.x !== x || p.y !== y) { win.setPosition(p.x, p.y); saveState({ x: p.x, y: p.y }); }
}
function wireDisplayEvents() {
  // Debounced: unplugging a monitor fires several events, and the OS reports
  // its final work areas a beat after the first one.
  const onChange = () => { clearTimeout(reclampTimer); reclampTimer = setTimeout(reclampWindow, 400); };
  screen.on('display-removed', onChange);
  screen.on('display-added', onChange);
  screen.on('display-metrics-changed', onChange);
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
  rebuildTrayMenu(); // the tray's simple/detailed entry mirrors the mode
  if (mode === 'extended') pollNow(); // fetch tokens now
}

// Tray-initiated mode change: main owns the state, the renderer must follow.
// The menu item promises a view — a collapsed pill must expand to show it.
function toggleMode() {
  if (collapsed) setCollapsed(false);
  setMode(mode === 'extended' ? 'simple' : 'extended');
  if (win) {
    win.show();
    win.webContents.send('ui:expand');
    win.webContents.send('ui:modeset', mode);
  }
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

// ---- Local token aggregation (JSONL) ----
let tokensInFlight = null; // single-flight: polls may overlap the slow first scan
let tokensPrimed = false;  // first successful aggregation happened (boot prefetch)
function fetchTokens() {
  if (tokensInFlight) return tokensInFlight;
  tokensInFlight = (async () => {
    try {
      // null = no logs at all (Claude Code never ran): tell the renderer so it
      // can explain itself instead of showing dashes forever
      const tk = (await todayUsage()) || { noData: true, at: Date.now() };
      lastTokens = tk;
      tokensPrimed = true;
      if (win) win.webContents.send('tokens:update', tk);
    } catch (_) {
      // a cold-start failure must not leave the pane stuck on "loading…"
      if (!tokensPrimed && win) win.webContents.send('tokens:update', { noData: true, at: Date.now() });
    } finally {
      tokensInFlight = null;
    }
  })();
  return tokensInFlight;
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
    // Local token pane: fetched in PARALLEL with the usage fetch (it must never
    // delay the bars' first paint) — every cycle in extended/nocred modes, plus
    // once at boot in any mode so the detailed view opens warm. The disk cache
    // makes repeat scans cheap; simple-mode subscription users pay nothing per
    // cycle after the boot prefetch.
    if (mode === 'extended' || (lastError && lastError.noCredential) || !tokensPrimed) fetchTokens();
    if (getSettings().source === 'statusline') {
      // statusLine source: 100% local (capture file written by Claude Code's
      // statusLine hook). No network, so no breaker/backoff concerns.
      try {
        const usage = readStatusline(app.getPath('userData'), { knownSubscriber: loadState().sawStatuslineRateLimits === true });
        usage.pace = computePace(usage);
        // Remember, across restarts, that this install is a claude.ai subscriber
        // (rate_limits has appeared at least once). readStatusline uses it so a
        // later window that momentarily lacks rate_limits — a new session before
        // its first API response — isn't mistaken for an API-key account.
        if ((usage.fiveHour || usage.sevenDay) && loadState().sawStatuslineRateLimits !== true) {
          saveState({ sawStatuslineRateLimits: true });
        }
        // (the matching latch DROP lives in the catch below — see .subscriberLatchExpired)
        saveState({ paceSamples });
        lastGood = usage;
        lastError = null;
        if (win) win.webContents.send('usage:update', usage);
        updateTrayTitle(usage);
      } catch (err) {
        // The reader decayed its in-memory latch after a sustained windowless
        // run: this account really has stopped getting subscription windows
        // (Pro lapsed into API-key/Console billing). Drop the persisted flag too,
        // or every restart hands back a fresh grace period and the widget never
        // settles into the cost-only layout it should now be showing.
        if (err.subscriberLatchExpired && loadState().sawStatuslineRateLimits === true) {
          saveState({ sawStatuslineRateLimits: false });
        }
        // needsSetup means no capture file exists at all. But if OUR command is
        // already sitting in Claude Code's settings.json, nothing is missing —
        // it's configured and has simply never executed. That's the normal state
        // on every non-terminal surface: statusLine belongs to the CLI's terminal
        // UI, and the IDE extension panel and desktop app never run it. Telling
        // that user to "set up statusLine" sends them to fix what is already
        // correct, which is how this looks like a broken app instead of a
        // wrong-surface problem.
        let configuredNotRunning = false;
        if (err.needsSetup) {
          try { configuredNotRunning = claudeSettings.inspect(captureCommand(app.getPath('userData'))).isMine === true; }
          catch (_) { /* can't tell — fall back to the plain setup nudge */ }
        }
        lastError = {
          message: err.message, expired: !!err.expired, noCredential: !!err.noCredential,
          needsSetup: !!err.needsSetup, configuredNotRunning, at: Date.now(), last: lastGood,
        };
        if (win) win.webContents.send('usage:error', lastError);
        updateTrayTitleStale();
      }
      scheduleNext(POLL_STATUSLINE_MS);
      return;
    }
    if (!allowNetwork) {
      // Breaker is tripped and nothing re-armed it: local-only tick. Extended
      // mode — and API-key accounts, whose token pane is their main content —
      // keep the local data fresh; the endpoint is left alone.
      if (mode === 'extended' || (lastError && lastError.noCredential)) scheduleNext(POLL_ACTIVE_MS);
      else clearTimeout(pollTimer);
      return;
    }
    try {
      const usage = await fetchUsage();
      usage.pace = computePace(usage);
      saveState({ paceSamples });
      lastGood = usage;
      lastError = null;
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
      } else if (err && (err.noCredential || (err.expired && !status))) {
        // locally detected (no request was made) — leave the breaker as-is
      } else {
        rejected4xx = 0; // network blip / 5xx: transient, not a rejection
      }
      const tripped = rejected4xx >= BREAKER_TRIP;
      lastError = {
        message: err.message, expired: !!err.expired, noCredential: !!err.noCredential,
        unavailable: tripped, at: Date.now(), last: lastGood,
      };
      if (win) win.webContents.send('usage:error', lastError);
      updateTrayTitleStale();
      if (err && err.noCredential) {
        // API-key / Console account: a steady state, not an outage. Poll at the
        // calm cadence — the credential watcher re-polls instantly if a
        // subscription login ever appears. The cycle that DISCOVERS the state
        // fills the pane right away (the top-of-poll gate used the old error).
        fetchTokens();
        scheduleNext(POLL_ACTIVE_MS);
      } else if (err && err.rateLimited) {
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
// the file, so this can't feed back on itself. That's also why a null filename
// (fs.watch doesn't always report one) is accepted here as a plain "something
// changed, re-poll": nothing we do writes into ~/.claude, so a spurious poll
// can't trigger another one. The statusLine watcher below sits on a directory we
// DO write to and needs the stricter treatment — see the note there.
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
let slMtimeSig = '';
// Fingerprint of the capture files' mtimes — the fallback for events that don't
// say which file changed (see below).
function captureMtimeSig() {
  const dir = app.getPath('userData');
  let sig = '';
  try {
    for (const n of fs.readdirSync(dir)) {
      if (!isCaptureFileName(n)) continue;
      try { sig += n + ':' + fs.statSync(path.join(dir, n)).mtimeMs + ';'; } catch (_) { /* raced with a rename; the next event catches it */ }
    }
  } catch (_) { /* unreadable dir: treat as "no change", timed polling still covers */ }
  return sig;
}
function watchStatusline() {
  unwatchStatusline();
  if (getSettings().source !== 'statusline') return;
  slMtimeSig = captureMtimeSig();
  try {
    slWatcher = fs.watch(app.getPath('userData'), (_evt, fname) => {
      if (fname) {
        if (!isCaptureFileName(fname)) return; // ignore the capture script, *.tmp, unrelated files
      } else {
        // fs.watch is documented to hand us a null filename on some platforms,
        // and unlike the credential watcher this directory is one WE write to:
        // every successful poll saves paceSamples into state.json here, plus the
        // JSONL cache. Letting a null through unfiltered therefore made each
        // poll's own write trigger the next poll — a self-sustaining ~400ms loop
        // for as long as the data stayed fresh. When we can't tell what changed,
        // ask the capture files directly: no capture moved, no poll.
        const sig = captureMtimeSig();
        if (sig === slMtimeSig) return;
        slMtimeSig = sig;
      }
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
function updateTrayTitle(usage, staleWord) {
  if (!tray) return;
  const five = usage && usage.fiveHour ? usage.fiveHour.utilization + '%' : '--';
  const seven = usage && usage.sevenDay ? usage.sevenDay.utilization + '%' : '--';
  // "5h"/"7d" are language-neutral unit tokens (matching the collapsed pill)
  tray.setToolTip(`Count Claudula · 5h ${five} · 7d ${seven}` + (staleWord ? ` · ${staleWord}` : ''));
  // macOS menu bar mode: the same two numbers, as text beside the icon. The bar
  // is shared real estate, so it gets the compact form and a "⚠" instead of the
  // localized status word — the full sentence is one hover away in the tooltip.
  // Stale numbers must never read as live, hence the marker rather than nothing.
  setMenuBarTitle(`5h ${five} · 7d ${seven}` + (staleWord ? ' ⚠' : ''));
}

// tray.setTitle exists only on macOS. Writing an empty string is what CLEARS
// the text, so this is also how widget mode takes the bar back.
function setMenuBarTitle(text) {
  if (!tray || process.platform !== 'darwin' || typeof tray.setTitle !== 'function') return;
  try { tray.setTitle(menuBarMode() ? ' ' + text : ''); } catch (_) {}
}

// Apply the mac display choice: menu bar mode retires the floating window and
// the dock icon (a menu bar extra with a dock tile and an always-on-top window
// is exactly the clutter this option exists to remove); widget mode brings both
// back. No-op off macOS, so Windows/Linux keep the widget unconditionally.
// `boot` = called before the window's first paint, where ready-to-show already
// owns the decision to show it. Forcing show() there would put a transparent,
// unpainted frameless window on screen for a frame or two.
function applyMacBar(boot) {
  if (process.platform !== 'darwin') return;
  if (menuBarMode()) {
    if (win && !win.isDestroyed()) win.hide();
    try { if (app.dock) app.dock.hide(); } catch (_) {}
  } else {
    // app.dock.show() resolves a promise in current Electron; a rejection there
    // would escape the try/catch as an unhandled rejection.
    try { const p = app.dock && app.dock.show(); if (p && p.catch) p.catch(() => {}); } catch (_) {}
    if (!boot) {
      if (!win || win.isDestroyed()) createWindow();
      else win.show();
    }
  }
  // Repaint the bar text for the new mode — this is also what CLEARS it when
  // leaving menu bar mode. Before the first successful poll there's nothing to
  // repaint and the tooltip still says "loading…", so don't overwrite that.
  if (lastError) updateTrayTitleStale();
  else if (lastGood) updateTrayTitle(lastGood);
  else setMenuBarTitle('5h -- · 7d --');
}

// A fetch failed: never present the last numbers as live. Reuse the localized
// status word the widget footer shows for the same state.
function updateTrayTitleStale() {
  if (!tray) return;
  const L = effectiveLocale();
  const e = lastError || {};
  const word = e.expired ? i18n.t(L, 'expired')
    : e.noCredential ? i18n.t(L, 'nocred')
    : e.unavailable ? i18n.t(L, 'unavailable')
    : i18n.t(L, 'offline');
  if (lastGood) { updateTrayTitle(lastGood, word); return; }
  tray.setToolTip('Count Claudula · ' + word);
  // Nothing has ever succeeded: dashes, not an empty bar. A menu bar extra that
  // shows only its icon looks like the app is fine — it isn't, and the tooltip
  // carries the reason.
  setMenuBarTitle('5h -- · 7d --');
}

function rebuildTrayMenu() {
  if (!tray) return;
  const L = effectiveLocale();
  const items = [
    { label: i18n.t(L, 'tray_showhide'), click: toggleWindow },
    { label: i18n.t(L, 'tray_expand'), click: expandPanel },
    // full-word entry point to the detailed pane — the widget's own ⊞ glyph is
    // easy to miss, and menus carry translated labels at any length
    { label: i18n.t(L, mode === 'extended' ? 't_simple' : 't_detailed'), click: toggleMode },
    { label: i18n.t(L, 'tray_refresh'), click: pollNow },
    { label: i18n.t(L, 'tray_settings'), click: openSettings },
    { label: i18n.t(L, 'set_donate'), click: () => shell.openExternal(DONATE_URL) },
  ];
  if (updateReady) {
    items.push({ type: 'separator' }, { label: i18n.t(L, 'update_restart'), click: installUpdate });
  } else if (updateAvailable && !updateDownloading) {
    // macOS gets "Get the new version" (opens the releases page) — offering
    // "Download update" there would promise an install that can't happen.
    items.push({ type: 'separator' }, manualUpdate()
      ? { label: i18n.t(L, 'update_get'), click: openReleasesPage }
      : { label: i18n.t(L, 'update_download'), click: startUpdateDownload });
  } else if (updatesSupported() || manualUpdate()) {
    items.push({ type: 'separator' }, { label: i18n.t(L, 'update_check'), click: trayCheckUpdates });
  }
  items.push({ type: 'separator' }, { label: i18n.t(L, 'tray_quit'), click: () => { quitting = true; app.quit(); } });
  tray.setContextMenu(Menu.buildFromTemplate(items));
}

// ---- Update UI (tray + in-widget banner) ----
function updateUiState() {
  if (updateReady) return { state: 'ready', version: updateVersion };
  if (updateDownloading) return { state: 'downloading', version: updateVersion, percent: updateProgress };
  // `manual` = clicking opens the releases page instead of downloading in place.
  // On macOS that's the only honest offer; 'downloading'/'ready' never occur there.
  if (updateAvailable && !updateSnoozed) return { state: 'available', version: updateVersion, manual: manualUpdate() };
  return { state: 'none' };
}
// Keep both surfaces in sync. Download progress skips the tray rebuild —
// progress events fire often and only the banner shows a percentage.
function syncUpdateUi(progressOnly) {
  if (!progressOnly) rebuildTrayMenu();
  if (win) win.webContents.send('update:state', updateUiState());
}
function startUpdateDownload() {
  // On macOS this must never run: the download always failed into the silent
  // 'error' handler, which is the whole reason updates were hidden there.
  if (manualUpdate()) return openReleasesPage();
  if (!updateAvailable || updateDownloading || updateReady) return;
  updateSnoozed = false; // an explicit download un-snoozes the banner (shows progress)
  updateDownloading = true;
  updateProgress = 0;
  syncUpdateUi();
  autoUpdater.downloadUpdate().catch(() => { updateDownloading = false; syncUpdateUi(); });
}
function openReleasesPage() {
  shell.openExternal(RELEASES_URL).catch(() => {});
}
function installUpdate() {
  if (!updateReady) return;
  quitting = true;
  // silent NSIS run + relaunch: updating never reopens the install wizard
  autoUpdater.quitAndInstall(true, true);
}

// Self-update only works on the packaged NSIS install (the portable build and a
// `npm start` dev run can't apply an update), so the manual check is offered only
// there — elsewhere the Settings block and tray item hide themselves.
// macOS is excluded ON PURPOSE, even though it's packaged and non-portable: the
// mac build ships unsigned (identity:null — the README documents the Gatekeeper
// "damaged" workaround), and electron-updater hands the install to Squirrel.Mac,
// which hard-requires a signed app. The download therefore always failed into
// the silent 'error' handler and the banner reverted to "available" forever —
// an offer that could never be honoured. Mac users update from the DMG.
function updatesSupported() {
  return app.isPackaged && process.platform !== 'darwin' && !process.env.PORTABLE_EXECUTABLE_DIR;
}
// macOS can't INSTALL an update, but it can still be TOLD there is one —
// checking is a metadata fetch, and only the install needs the signature
// Squirrel.Mac demands. Silence was the wrong trade: a Mac user had no way to
// learn a new version existed short of visiting GitHub on a hunch, so a fix
// aimed at them could sit unnoticed forever. In this mode the banner, the tray
// item and Settings all offer the download PAGE instead of an install.
// (The portable Windows build is still fully silent — same could be done there,
// but that's a separate change to a platform that already self-updates.)
function manualUpdate() {
  return app.isPackaged && process.platform === 'darwin' && !process.env.PORTABLE_EXECUTABLE_DIR;
}
// Compare simple x.y.z versions: is `a` newer than `b`?
function isNewerVersion(a, b) {
  const pa = String(a).split('.').map((n) => parseInt(n, 10) || 0);
  const pb = String(b).split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) { if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) > (pb[i] || 0); }
  return false;
}
// A user-initiated check (Settings button or tray item). Resolves to a state the
// caller can show as feedback — the periodic auto-check stays silent, this one
// must always say something. The events in setupUpdater still light the banner.
let manualChecking = false;
async function runManualCheck() {
  if (!updatesSupported() && !manualUpdate()) return { state: 'unsupported' };
  if (updateReady) return { state: 'ready', version: updateVersion };
  if (updateDownloading) return { state: 'downloading', version: updateVersion };
  if (manualChecking) return { state: 'checking' };
  manualChecking = true;
  try {
    const r = await autoUpdater.checkForUpdates();
    const v = r && r.updateInfo && r.updateInfo.version;
    if (v && isNewerVersion(v, app.getVersion())) return { state: 'available', version: v };
    return { state: 'uptodate', version: app.getVersion() };
  } catch (_) {
    return { state: 'error' };
  } finally {
    manualChecking = false;
  }
}
// Tray path: no window to print into, so notify for the terminal states. An
// available update also lights the banner + tray "Download update" via events.
async function trayCheckUpdates() {
  const L = effectiveLocale();
  const r = await runManualCheck();
  if (!Notification.isSupported()) return;
  let body = null;
  if (r.state === 'uptodate') body = i18n.t(L, 'update_uptodate');
  else if (r.state === 'available') body = i18n.t(L, 'update_found') + ' (' + r.version + ')';
  else if (r.state === 'error') body = i18n.t(L, 'update_check_error');
  if (body) new Notification({ title: 'Count Claudula', body }).show();
}

// Update via GitHub releases (packaged app only; NSIS — the portable doesn't update).
function setupUpdater() {
  // Packaged NSIS install only — same test the UI uses, so a platform that can't
  // apply an update never lights the banner or the tray item either (the
  // portable build's latest.yml points at the installer; macOS is unsigned).
  if (!updatesSupported() && !manualUpdate()) return;
  // Consent-first: the Windows build is unsigned, and electron-updater can't
  // verify signatures on an unsigned app — so nothing is ever downloaded
  // silently. We only check metadata; the user starts the download from the
  // tray ("Download update") and the install happens on restart/quit.
  autoUpdater.autoDownload = false;
  // macOS: never let electron-updater stage anything on quit either. Nothing is
  // ever downloaded there, but this mode exists precisely because the install
  // path is broken — don't leave a door open to it.
  autoUpdater.autoInstallOnAppQuit = !manualUpdate();
  autoUpdater.on('update-available', (info) => {
    updateAvailable = true;
    updateVersion = (info && info.version) || '';
    // a dismissed version stays out of the banner (the tray still offers it)
    updateSnoozed = !!updateVersion && updateVersion === loadState().snoozedVersion;
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
  tray = new Tray(process.platform === 'darwin' ? makeMenuBarIcon() : makeTrayIcon());
  tray.setToolTip('Count Claudula · ' + i18n.t(effectiveLocale(), 'tray_loading'));
  rebuildTrayMenu();
  tray.on('click', toggleWindow);
}

function openSettings() {
  // Menu bar mode hides the dock icon, which on macOS makes this an accessory
  // app: its windows open BEHIND whatever is frontmost and can't take the
  // keyboard. Settings owns the switch back to widget mode, so it must not open
  // somewhere the user can't see or reach.
  if (menuBarMode()) { try { app.focus({ steal: true }); } catch (_) {} }
  if (settingsWin) { settingsWin.show(); settingsWin.focus(); return; }
  settingsWin = new BrowserWindow({
    width: 344,
    // the statusline hint + scope note push the footer past 560 even in en; mac
    // adds the widget/menu-bar row and its hint on top of that
    height: process.platform === 'darwin' ? 692 : 630,
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
  lockNavigation(settingsWin); // same bridge, same drop hazard — and this window owns the consent controls
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
// Automated refresh from the reset-crossing tick: obeys the lock/suspend pause
// and does NOT re-arm the circuit breaker — those overrides are reserved for
// genuine user gestures (pollNow).
ipcMain.on('ui:autorefresh', () => {
  if (paused) return;
  if (polling) { pollQueued = true; return; }
  scheduleNext(0);
});
ipcMain.on('ui:collapse', (_e, next) => setCollapsed(!!next));
ipcMain.on('ui:mode', (_e, m) => setMode(m));
ipcMain.on('ui:extmore', (_e, v) => setExtMore(!!v));
ipcMain.on('ui:height', (_e, h) => setExtHeight(h));
ipcMain.on('ui:update-download', startUpdateDownload);
ipcMain.on('ui:update-page', openReleasesPage);
ipcMain.on('ui:update-restart', installUpdate);
ipcMain.on('ui:update-dismiss', () => {
  // banner-only snooze for this version — the tray menu keeps offering it
  if (!updateAvailable || updateDownloading || updateReady) return;
  saveState({ snoozedVersion: updateVersion });
  updateSnoozed = true;
  syncUpdateUi();
});
ipcMain.on('ui:settings', openSettings);
// first-run setup card dismissed/completed — never show it again
ipcMain.on('ui:onboarded', () => saveState({ onboarded: true }));
ipcMain.on('ui:donate', () => shell.openExternal(DONATE_URL));
ipcMain.on('ui:hide', () => { if (win) win.hide(); });
ipcMain.on('ui:quit', () => { quitting = true; app.quit(); });

ipcMain.handle('settings:get', () => ({
  settings: getSettings(),
  langs: i18n.LANGS,
  locale: effectiveLocale(),
  statuslineCmd: captureCommand(app.getPath('userData')),
  // the Updates block also shows on macOS now — as a "check + open the page"
  // control, since the install itself is impossible there (updateManual)
  updatesSupported: updatesSupported() || manualUpdate(),
  updateManual: manualUpdate(),
  appVersion: app.getVersion(),
  // the menu bar choice only exists on macOS — Settings hides the row elsewhere
  platform: process.platform,
}));
ipcMain.handle('update:check', () => runManualCheck());
// One-click statusLine setup: inspect first (so the renderer can confirm before
// replacing an existing statusLine and warn if node is missing), then apply.
ipcMain.handle('statusline:inspect', () => {
  const cmd = captureCommand(app.getPath('userData'));
  return { ...claudeSettings.inspect(cmd), nodeOk: claudeSettings.nodeAvailable() };
});
// This app has exactly two consent decisions — destructively editing ANOTHER
// application's config, and switching on the data source that knowingly violates
// Anthropic's Consumer Terms — and both dialogs live in the renderer. Main must
// not simply believe an IPC message that asks for either: the renderer is a
// window sitting in every drag path on the desktop (see lockNavigation), so
// "the renderer asked" is not "the user agreed". The caller has to state that
// the prompt was actually answered.
ipcMain.handle('statusline:apply', (_e, opts) => {
  const cmd = captureCommand(app.getPath('userData'));
  // Replacing a statusLine the user configured themselves is the destructive
  // case, and the only one that needs the confirmation. A first-time setup (no
  // statusLine at all) and a re-apply of our own command need nothing.
  const cur = claudeSettings.inspect(cmd);
  if (cur.currentCmd && !cur.isMine && !(opts && opts.confirmReplace === true)) {
    return { ok: false, error: 'needs_confirm', currentCmd: cur.currentCmd };
  }
  ensureCaptureScript(app.getPath('userData')); // guarantee the script is on disk before we point Claude Code at it
  const res = claudeSettings.apply(cmd);
  if (res.ok) {
    // make sure the widget is actually reading this source, then re-poll
    if (getSettings().source !== 'statusline') { setSetting('source', 'statusline'); watchStatusline(); }
    pollNow();
  }
  return res;
});
ipcMain.on('settings:set', (_e, payload) => {
  const { k, v, consent } = payload || {}; // tolerate a malformed/empty payload
  if (!validSetting(k, v)) return; // reject unknown key / invalid value
  // Moving ONTO the endpoint is the ban-risk decision: refuse unless the caller
  // states the ToS gate was answered. Only the transition needs it — re-setting
  // a source that's already applied changes nothing, and every move BACK to
  // statusline is always allowed.
  if (k === 'source' && v === 'endpoint' && getSettings().source !== 'endpoint' && consent !== true) return;
  // Record the answered gate alongside the source itself, and clear the
  // "we moved you" notice — whichever way they just chose, they've now seen it.
  setSetting(k, v, k === 'source'
    ? { endpointConsent: v === 'endpoint' ? true : getSettings().endpointConsent, endpointResetAt: 0 }
    : null);
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
  if (k === 'macBar') applyMacBar();
  if (k === 'source') {
    if (v === 'statusline') ensureCaptureScript(app.getPath('userData'));
    watchStatusline(); // attaches or detaches per the new source
    paceSamples = [];  // the two sources have incompatible timelines (Date.now vs capture time)
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
  app.on('second-instance', () => { if (win && !menuBarMode()) { win.show(); win.focus(); } });
  app.whenReady().then(() => {
    if (process.platform === 'win32') app.setAppUserModelId('com.countclaudula.app');
    setCacheDir(app.getPath('userData')); // JSONL aggregation survives restarts
    migrateLegacyState();
    resolveSourceOnce(); // settle the data source before anything else can write state
    restorePaceSamples();  // warm the burn-rate buffer so the hint isn't blank after a restart
    createWindow();
    buildTray();
    applyMacBar(true); // mac: honour the saved widget/menu-bar choice before the first paint
    wirePowerEvents();
    wireDisplayEvents(); // an unplugged monitor must not strand the widget off-screen
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
    clearTimeout(reclampTimer);
    try { if (credWatcher) credWatcher.close(); } catch (_) {}
    unwatchStatusline();
    flushCache(); // a pending debounced save must not be lost on quit
  });
  app.on('window-all-closed', (e) => { /* stays alive in the tray */ });
  app.on('activate', () => { if (!win) createWindow(); else if (!menuBarMode()) win.show(); });
}
