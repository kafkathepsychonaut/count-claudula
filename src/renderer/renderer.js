'use strict';
const api = window.claudeCount;

let latest = null;            // last usage received
let stale = false;            // last fetch failed -> showing stale data
let expiredFlag = false;      // failed because the token expired (read-only mode)
let nocredFlag = false;       // API-key / Console account: no subscription windows exist
let unavailableFlag = false;  // circuit breaker tripped: the endpoint keeps refusing
let countdownTimer = null;

const $ = (id) => document.getElementById(id);

function levelClass(p) {
  if (p >= 85) return 'crit';
  if (p >= 60) return 'warn';
  return 'ok';
}

let mode = 'simple';
let extMore = false;          // fine-detail pane inside extended mode
let lastTk = null;            // last tokens payload (re-render on language switch)
let updState = null;          // update banner: {state: available|downloading|ready, version, percent}
let updConfirm = null;        // "ready" needs a second click within a few seconds
let LOCALE = 'en';
function applyTheme(theme) {
  const t = (theme === 'bloodthirsty' || theme === 'zombie') ? theme : 'classic';
  document.documentElement.setAttribute('data-theme', t);
}
function t(k) { return window.I18N ? window.I18N.t(LOCALE, k) : k; }
function applyI18n(loc) {
  LOCALE = window.I18N ? window.I18N.normalize(loc) : 'en';
  document.documentElement.lang = LOCALE;
  document.documentElement.dir = (window.I18N && window.I18N.isRTL(LOCALE)) ? 'rtl' : 'ltr';
  document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.getAttribute('data-i18n')); });
  document.querySelectorAll('[data-i18n-title]').forEach((el) => { el.title = t(el.getAttribute('data-i18n-title')); });
  applyMode(mode);          // re-translate the mode button title
  applyExtMore(extMore);    // re-translate the more/less toggle
  renderUpdate();           // re-translate the update banner
  syncHeroHint();           // account-dependent tooltip on the cost row
  renderAll();              // re-translate dynamic status/reset (also the no-data error state)
  if (lastTk) renderTokens(lastTk); // re-translate rows + locale number formats
  reportHeight();           // label lengths differ per language
}
// Locale-aware compact token counts ("17.6M" / "17,6 mln"), tabular-safe.
function fmtTok(n) {
  n = n || 0;
  try {
    return new Intl.NumberFormat(LOCALE, { notation: 'compact', maximumFractionDigits: 1 }).format(n);
  } catch (_) {
    if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(1) + 'k';
    return '' + n;
  }
}
function fmtMoney(amount, currency) {
  try {
    return new Intl.NumberFormat(LOCALE, { style: 'currency', currency: currency || 'USD', maximumFractionDigits: 2 }).format(amount || 0);
  } catch (_) {
    return '$' + (amount || 0).toFixed(2);
  }
}
function applyMode(m) {
  mode = m === 'extended' ? 'extended' : 'simple';
  document.body.classList.toggle('mode-extended', mode === 'extended');
  const b = $('btn-mode');
  if (mode === 'extended') { b.innerHTML = '&#x229f;'; b.title = t('t_simple'); }
  else { b.innerHTML = '&#x229e;'; b.title = t('t_detailed'); }
}

function applyExtMore(v) {
  extMore = !!v;
  document.body.classList.toggle('ext-more', extMore);
  $('ext-more-toggle').setAttribute('aria-expanded', String(extMore));
  $('ext-more-label').textContent = t(extMore ? 't_less' : 't_more');
}

// The "API value" figure needs its explanation ON the number, not in a footnote:
// subscription accounts see "covered, not billed"; API-key accounts must not.
function syncHeroHint() {
  $('hero-row').title = t(nocredFlag ? 'equiv_cost_hint_api' : 'equiv_cost_hint');
}

// In-widget update banner (the tray mirrors it): available -> click downloads
// (✕ snoozes this version); downloading -> shows %; ready -> click twice to
// restart into the new version (a single stray click must not kill the session).
function renderUpdate() {
  document.body.classList.toggle('has-upd', !!updState);
  const upd = $('upd');
  if (!updState) { upd.classList.remove('dismissable'); return; }
  let label;
  if (updState.state === 'ready') label = updConfirm ? t('update_confirm') : t('update_restart');
  else if (updState.state === 'downloading') label = t('updating') + (updState.percent ? ' ' + updState.percent + '%' : '');
  else label = t('update_download') + (updState.version ? ' · v' + updState.version : '');
  $('upd-label').textContent = label;
  upd.classList.toggle('dismissable', updState.state === 'available');
}

// Content-driven window height: the visible content varies (update banner,
// number of scoped limits, per-model rows, language), so the renderer measures
// it and asks main to resize. Fixed heights clipped content — and a clipped
// toggle can't be clicked to un-clip itself.
let heightRaf = 0;
function reportHeight() {
  cancelAnimationFrame(heightRaf);
  heightRaf = requestAnimationFrame(() => {
    if (document.body.classList.contains('collapsed')) return;
    const card = $('card');
    card.style.height = 'auto';          // let it take its natural content height
    const h = card.offsetHeight + 22;    // + body padding (11px each side)
    card.style.height = '';
    api.reportHeight(h);
  });
}

function fmtCountdown(iso) {
  if (!iso) return '';
  const ms = new Date(iso).getTime() - Date.now();
  if (!Number.isFinite(ms)) return '';
  if (ms <= 0) return t('resetting');
  const totalMin = Math.floor(ms / 60000);
  const d = Math.floor(totalMin / 1440);
  const h = Math.floor((totalMin % 1440) / 60);
  const m = totalMin % 60;
  const pre = t('resets_in');
  if (d > 0) return `${pre} ${d}d ${h}h`;
  if (h > 0) return `${pre} ${h}h ${String(m).padStart(2, '0')}m`;
  return `${pre} ${m}m`;
}

function renderWindow(prefix, w) {
  const pctEl = $(prefix + '-pct');
  const fillEl = $(prefix + '-fill');
  const resetEl = $(prefix + '-reset');
  if (!w) {
    pctEl.textContent = '--';
    fillEl.style.width = '0%';
    resetEl.textContent = '';
    return;
  }
  const lvl = levelClass(w.utilization);
  pctEl.textContent = w.utilization + '%';
  pctEl.className = 'pct ' + lvl;
  fillEl.style.width = Math.min(100, w.utilization) + '%';
  fillEl.className = 'fill ' + lvl;
  resetEl.textContent = fmtCountdown(w.resetsAt);
}

// Burn-rate hint next to the 5h countdown: "≈ +12%/h", red when the limit
// would arrive before the reset. Language-neutral (number + unit glyphs).
function renderPace(u) {
  const el = $('five-pace');
  const p = u && u.pace;
  if (!p || stale) { el.textContent = ''; el.className = 'pace'; return; }
  el.textContent = `≈ +${p.perHour}%/h`;
  el.className = 'pace' + (p.hot ? ' hot' : '');
}

function renderMini(u) {
  const five = u && u.fiveHour ? u.fiveHour.utilization : null;
  const seven = u && u.sevenDay ? u.sevenDay.utilization : null;
  const f = $('mini-five');
  const s = $('mini-seven');
  f.textContent = five != null ? five + '%' : '--';
  s.textContent = seven != null ? seven + '%' : '--';
  // the level shows even collapsed: 85%+ must read as critical at a glance
  f.className = five != null ? levelClass(five) : '';
  s.className = seven != null ? levelClass(seven) : '';
}

function renderModels(u) {
  const el = $('models');
  // paid overage takes priority (real money); only shown when enabled
  const ov = u.overage;
  if (ov && ov.enabled) {
    // used / limit: the only real-money figure in the app gets its denominator
    const denom = ov.limit > 0 ? ` / ${fmtMoney(ov.limit, ov.currency)}` : ` · ${ov.percent}%`;
    el.textContent = `${t('overage')} ${fmtMoney(ov.used, ov.currency)}${denom}`;
    const sev = String(ov.severity || '').toLowerCase();
    const cls = (sev.includes('crit') || sev.includes('alert')) ? 'ov-crit'
      : (sev.includes('warn') || sev.includes('high')) ? 'ov-warn' : 'ov';
    el.className = 'models ' + cls;
    return;
  }
  el.className = 'models';
  const parts = [];
  if (u.sevenDayOpus && u.sevenDayOpus.utilization > 0) parts.push('opus ' + u.sevenDayOpus.utilization + '%');
  if (u.sevenDaySonnet && u.sevenDaySonnet.utilization > 0) parts.push('sonnet ' + u.sevenDaySonnet.utilization + '%');
  el.textContent = parts.join('  ');
}

// Scoped account limits (per-model weekly caps etc): rendered with the headline
// bars — same payload, same subject. Countdown inline once the limit matters.
function renderLimits(u) {
  const el = $('limits');
  el.textContent = '';
  const rows = (u && u.limits ? u.limits : [])
    .filter((l) => l.kind !== 'session' && l.kind !== 'weekly_all')
    .slice(0, 4); // keep the widget glanceable; cap the list
  for (const l of rows) {
    const lvl = levelClass(l.percent);
    const row = document.createElement('div');
    row.className = 'lim-row';
    const k = document.createElement('span');
    k.className = 'lk';
    // "Fable · week" for model-scoped weekly caps; fall back to the raw kind
    k.textContent = l.label ? `${l.label} · ${l.group === 'weekly' ? t('week') : l.group}` : l.kind;
    const track = document.createElement('div');
    track.className = 'track';
    const fill = document.createElement('div');
    fill.className = 'fill ' + lvl;
    fill.style.width = Math.min(100, l.percent) + '%';
    track.appendChild(fill);
    const v = document.createElement('span');
    v.className = 'lv ' + lvl; // theme-aware semantic colors via CSS vars
    v.textContent = l.percent + '%';
    row.title = fmtCountdown(l.resetsAt);
    row.append(k, track, v);
    // a limit that's half gone deserves its reset time in plain sight,
    // not behind a hover tooltip
    if (l.percent >= 50 && l.resetsAt) {
      const c = document.createElement('span');
      c.className = 'lc';
      const ms = new Date(l.resetsAt).getTime() - Date.now();
      if (Number.isFinite(ms) && ms > 0) {
        const totalMin = Math.floor(ms / 60000);
        const d = Math.floor(totalMin / 1440);
        const h = Math.floor((totalMin % 1440) / 60);
        c.textContent = d > 0 ? `${d}d ${h}h` : `${h}h ${String(totalMin % 60).padStart(2, '0')}m`;
        row.appendChild(c);
      }
    }
    el.appendChild(row);
  }
}

function renderStatus(u) {
  const el = $('status');
  if (stale) {
    // expired = token went stale; it's a normal idle state (Claude Code refreshes
    // it), so nudge calmly with the fix in the tooltip rather than an alarming red.
    // expired wins over unavailable: reopening Claude Code is the fix for both.
    if (expiredFlag) {
      el.textContent = t('expired');
      el.title = t('expired_hint');
      el.className = 'status idle';
    } else if (nocredFlag) {
      // API-key / Console login: the bars have nothing to show, by design.
      // Calm status (the token panel below still works), explanation on hover.
      el.textContent = t('nocred');
      el.title = t('nocred_hint');
      el.className = 'status idle';
    } else if (unavailableFlag) {
      // circuit breaker: the endpoint keeps refusing, so polling stopped —
      // say so honestly instead of pretending to be merely offline.
      el.textContent = t('unavailable');
      el.title = t('unavailable_hint');
      el.className = 'status stale';
    } else {
      el.textContent = t('offline');
      el.title = '';
      el.className = 'status stale';
    }
    return;
  }
  el.title = '';
  const when = new Date(u.fetchedAt);
  const hh = String(when.getHours()).padStart(2, '0');
  const mm = String(when.getMinutes()).padStart(2, '0');
  el.textContent = `${t('updated')} ${hh}:${mm}`;
  el.className = 'status';
}

function renderAll() {
  // stale data must not look live (bars dim, countdown freezes)
  document.body.classList.toggle('stale', stale);
  if (!latest) {
    // No data yet: if the first fetch failed, at least show the status
    // (offline/expired) instead of staying stuck on "connecting…".
    if (stale) { renderWindow('five', null); renderWindow('seven', null); renderPace(null); renderMini(null); renderStatus(null); }
    return;
  }
  renderWindow('five', latest.fiveHour);
  renderWindow('seven', latest.sevenDay);
  renderPace(latest);
  renderModels(latest);
  renderLimits(latest);
  renderStatus(latest);
  renderMini(latest);
  syncHeroHint();
  reportHeight();
}

function startCountdown() {
  clearInterval(countdownTimer);
  countdownTimer = setInterval(() => {
    if (!latest || stale) return; // frozen while stale: a ticking countdown reads as live data
    if (latest.fiveHour) $('five-reset').textContent = fmtCountdown(latest.fiveHour.resetsAt);
    if (latest.sevenDay) $('seven-reset').textContent = fmtCountdown(latest.sevenDay.resetsAt);
  }, 1000);
}

// ---- IPC ----
api.onInit(({ collapsed, mode, extMore, locale, theme }) => {
  document.body.classList.toggle('collapsed', !!collapsed);
  applyTheme(theme);
  applyMode(mode);
  applyExtMore(extMore);
  applyI18n(locale);
});

api.onLocale((loc) => applyI18n(loc));
api.onTheme((th) => applyTheme(th));
api.onModeSet((m) => { applyMode(m); reportHeight(); }); // tray-initiated mode change

api.onUpdate((u) => {
  updState = (u && u.state && u.state !== 'none') ? u : null;
  if (!updState || updState.state !== 'ready') { clearTimeout(updConfirm); updConfirm = null; }
  renderUpdate();
  reportHeight();
});

// One .bm-row: name | share% (dim) | $ — real grid columns so both align.
function bmRow(name, pct, cost, tooltip) {
  const row = document.createElement('div');
  row.className = 'bm-row';
  const k = document.createElement('span'); k.className = 'bk'; k.textContent = name;
  const p = document.createElement('span'); p.className = 'bpct'; p.textContent = pct != null ? pct + '%' : '';
  const v = document.createElement('span'); v.className = 'bv'; v.textContent = fmtMoney(cost);
  if (tooltip) row.title = tooltip;
  row.append(k, p, v);
  return row;
}

function renderTokens(tk) {
  const noData = !!tk.noData;
  $('tok-nodata').classList.toggle('hidden', !noData);
  if (noData) {
    // first run / Claude Code never used: explain instead of dashes forever
    $('tok-cost').textContent = '–';
    $('row-proj').classList.add('hidden');
    $('row-save').classList.add('hidden');
    $('bymodel-wrap').classList.add('hidden');
    $('byproject-wrap').classList.add('hidden');
    for (const id of ['tok-in', 'tok-out', 'tok-cr', 'tok-cw', 'tok-week', 'tok-avg7']) $(id).textContent = '–';
    $('tok-spark').classList.add('hidden');
    reportHeight();
    return;
  }
  const tt = tk.totals || {};
  $('tok-in').textContent = fmtTok(tt.input);
  $('tok-out').textContent = fmtTok(tt.output);
  $('tok-cr').textContent = fmtTok(tt.cacheRead);
  $('tok-cw').textContent = fmtTok(tt.cacheWrite);
  $('tok-cost').textContent = fmtMoney(tk.cost);

  // linear projection of today: only once ~1h of the day has elapsed — before
  // that the row hides entirely (an unexplained "–" reads as broken data)
  const dayFrac = (Date.now() - new Date().setHours(0, 0, 0, 0)) / 86400000;
  const showProj = dayFrac > 0.05 && (tk.cost || 0) > 0;
  $('row-proj').classList.toggle('hidden', !showProj);
  if (showProj) $('tok-proj').textContent = fmtMoney((tk.cost || 0) / dayFrac);

  // per-model split: only tiers that actually cost something, and only when
  // there are two of them — a single row would just restate the total
  const bm = tk.byModel || {};
  const total = Object.values(bm).reduce((s, v) => s + (v.cost || 0), 0);
  const bmEl = $('tok-bymodel');
  bmEl.textContent = '';
  let bmCount = 0;
  for (const m of ['fable', 'opus', 'sonnet', 'haiku', 'other']) {
    const cost = bm[m] ? bm[m].cost : 0;
    if (!(cost > 0.005)) continue; // skip anything that would print $0.00
    const pct = total > 0 ? Math.round((cost / total) * 100) : 0;
    bmEl.appendChild(bmRow(m === 'other' ? t('tier_other') : m, pct, cost));
    bmCount++;
  }
  $('bymodel-wrap').classList.toggle('hidden', bmCount < 2);

  // per-project split (top 3): answers "where did my money go" directly.
  // Keys are full cwd paths (two repos sharing a folder name stay apart);
  // the label is the basename, the tooltip carries the full path.
  const bp = Object.entries(tk.byProject || {})
    .filter(([, v]) => v.cost > 0.005)
    .sort((a, b) => b[1].cost - a[1].cost);
  const bpEl = $('tok-byproject');
  bpEl.textContent = '';
  for (const [pathKey, v] of bp.slice(0, 3)) {
    const parts = pathKey.split(/[\\/]+/).filter(Boolean);
    const name = parts.length ? parts[parts.length - 1] : pathKey;
    const pct = tk.cost > 0 ? Math.round((v.cost / tk.cost) * 100) : 0;
    bpEl.appendChild(bmRow(name, pct, v.cost, pathKey));
  }
  $('byproject-wrap').classList.toggle('hidden', bp.length < 2);

  // net cache savings vs a no-cache baseline; hidden when there was no cache
  // activity at all (a "$0.00" row is noise)
  const hasCache = (tt.cacheRead || 0) > 0 || (tt.cacheWrite || 0) > 0;
  $('row-save').classList.toggle('hidden', !hasCache);
  if (hasCache) $('tok-save').textContent = fmtMoney(tk.savings || 0);

  // previous 7 complete days (today excluded — the header says so)
  const wk = tk.week || null;
  $('tok-week').textContent = wk ? fmtMoney(wk.cost || 0) : '–';
  $('tok-avg7').textContent = wk ? fmtMoney(wk.avgPerDay || 0) : '–';

  // daily sparkline: oldest → yesterday; hover names the day and the cost
  const spark = $('tok-spark');
  spark.textContent = '';
  const days = (wk && wk.days) || [];
  const max = Math.max(0, ...days);
  spark.classList.toggle('hidden', !(max > 0));
  if (max > 0) {
    const dayName = (offset) => {
      const d = new Date();
      d.setDate(d.getDate() - offset);
      try { return new Intl.DateTimeFormat(LOCALE, { weekday: 'short', day: 'numeric' }).format(d); }
      catch (_) { return d.toDateString().slice(0, 10); }
    };
    days.forEach((v, i) => {
      const bar = document.createElement('i');
      const h = v > 0 ? Math.max(3, Math.round((v / max) * 18)) : 2;
      bar.style.height = h + 'px';
      if (v > 0) bar.className = v === max ? 'max' : 'on';
      bar.title = `${dayName(7 - i)} · ${fmtMoney(v)}`;
      spark.appendChild(bar);
    });
  }
  reportHeight();
}

api.onTokens((tk) => {
  if (!tk) return;
  lastTk = tk;
  stopSpin();
  renderTokens(tk);
});

api.onUsage((u) => {
  latest = u;
  stale = false;
  expiredFlag = false;
  nocredFlag = false;
  unavailableFlag = false;
  stopSpin();
  renderAll();
});

api.onError(({ last, expired, noCredential, unavailable }) => {
  stale = true;
  expiredFlag = !!expired;
  nocredFlag = !!noCredential;
  unavailableFlag = !!unavailable;
  if (last) latest = last;
  stopSpin();
  renderAll();
});

// ---- Controls ----
// Refresh feedback lives on the button itself: it spins until an answer
// (usage, error or tokens) arrives — and the status text resets its error
// color instead of showing "updating…" painted in stale red.
function startSpin() { $('btn-refresh').classList.add('spinning'); }
function stopSpin() { $('btn-refresh').classList.remove('spinning'); }
function doRefresh() {
  const st = $('status');
  st.textContent = t('updating');
  st.className = 'status';
  st.title = '';
  startSpin();
  api.refresh();
}
$('btn-refresh').addEventListener('click', doRefresh);
// the status word doubles as a retry button whenever it reports a problem —
// its tooltips already say "press refresh"; let the text be the button
$('status').addEventListener('click', () => { if (stale) doRefresh(); });
$('btn-hide').addEventListener('click', () => api.hide());
$('upd').addEventListener('click', () => {
  if (!updState) return;
  if (updState.state === 'ready') {
    // restarting kills whatever the user is doing — require a second click
    if (updConfirm) { clearTimeout(updConfirm); updConfirm = null; api.updateRestart(); return; }
    updConfirm = setTimeout(() => { updConfirm = null; renderUpdate(); }, 5000);
    renderUpdate();
  } else if (updState.state === 'available') {
    api.updateDownload();
  }
});
$('upd-x').addEventListener('click', (e) => {
  e.stopPropagation();
  if (updState && updState.state === 'available') api.updateDismiss();
});
$('btn-settings').addEventListener('click', () => api.openSettings());
$('btn-mode').addEventListener('click', () => {
  applyMode(mode === 'extended' ? 'simple' : 'extended');
  api.setMode(mode);
  reportHeight();
});
$('ext-more-toggle').addEventListener('click', () => {
  applyExtMore(!extMore);
  api.setExtMore(extMore);
  reportHeight();
});

// Keyboard: every role="button" must actually work as a button.
function keyable(el, fn) {
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(e); }
  });
}
keyable($('ext-more-toggle'), () => $('ext-more-toggle').click());
keyable($('upd'), () => $('upd').click());
keyable($('upd-x'), () => $('upd-x').click());
keyable($('status'), () => { if (stale) doRefresh(); });

let collapsed = false;
$('btn-collapse').addEventListener('click', () => {
  collapsed = true;
  document.body.classList.add('collapsed');
  api.collapse(true);
});
function expand() {
  collapsed = false;
  document.body.classList.remove('collapsed');
  api.collapse(false);
  reportHeight(); // content (banner, limits, locale) may have changed while collapsed
}
// Single click on the vampire art expands (no-drag, generous touch target).
$('mini-art').addEventListener('click', (e) => { e.stopPropagation(); expand(); });
keyable($('mini-art'), expand);
// Fallback: double-click anywhere on the pill.
$('mini').addEventListener('dblclick', expand);
// Recovery via tray (in case the pill becomes unreachable).
api.onExpand(expand);

startCountdown();
