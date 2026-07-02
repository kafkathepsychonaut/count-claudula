'use strict';
const api = window.claudeCount;

let latest = null;            // last usage received
let stale = false;            // last fetch failed -> showing stale data
let expiredFlag = false;      // failed because the token expired (read-only mode)
let unavailableFlag = false;  // circuit breaker tripped: the endpoint keeps refusing
let countdownTimer = null;

const $ = (id) => document.getElementById(id);

function levelClass(p) {
  if (p >= 85) return 'crit';
  if (p >= 60) return 'warn';
  return 'ok';
}

const LEVEL_COLOR = { ok: '#D97757', warn: '#C2562F', crit: '#9B3415' };

let mode = 'simple';
let extMore = false;          // fine-detail pane inside extended mode
let lastTk = null;            // last tokens payload (re-render on language switch)
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
  if (latest) renderAll();  // re-translate dynamic status/reset
  if (lastTk) renderTokens(lastTk); // re-translate the "other" tier row
  reportHeight();           // label lengths differ per language
}
function fmtTok(n) {
  n = n || 0;
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'k';
  return '' + n;
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

// Content-driven window height: the extended pane's content varies (number of
// scoped limits, per-model rows, language), so the renderer measures it and
// asks main to resize. Fixed heights clipped content — and a clipped toggle
// can't be clicked to un-clip itself.
let heightRaf = 0;
function reportHeight() {
  cancelAnimationFrame(heightRaf);
  heightRaf = requestAnimationFrame(() => {
    if (mode !== 'extended' || document.body.classList.contains('collapsed')) return;
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

function renderMini(u) {
  const five = u && u.fiveHour ? u.fiveHour.utilization : null;
  const seven = u && u.sevenDay ? u.sevenDay.utilization : null;
  $('mini-five').textContent = five != null ? five + '%' : '--';
  $('mini-seven').textContent = seven != null ? seven + '%' : '--';
  // (the vampire art doesn't change color; the level shows in each bar's %)
}

function fmtMoney(amount, currency) {
  try {
    return new Intl.NumberFormat(LOCALE, { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount || 0);
  } catch (_) {
    return (currency || '') + ' ' + (amount || 0).toFixed(2);
  }
}

function renderModels(u) {
  const el = $('models');
  // paid overage takes priority (real money); only shown when enabled
  const ov = u.overage;
  if (ov && ov.enabled) {
    el.textContent = `${t('overage')} ${fmtMoney(ov.used, ov.currency)} · ${ov.percent}%`;
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

// Scoped limits (fine-detail pane): everything in `limits` beyond the two
// headline bars — per-model weekly caps ("Fable"), future scopes, etc.
function renderLimits(u) {
  const el = $('limits');
  el.textContent = '';
  const rows = (u && u.limits ? u.limits : [])
    .filter((l) => l.kind !== 'session' && l.kind !== 'weekly_all')
    .slice(0, 4); // the window has a fixed height; cap the list
  $('limits-title').style.display = rows.length ? '' : 'none';
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
    v.className = 'lv ' + lvl; // theme-aware colors via CSS vars
    v.textContent = l.percent + '%';
    row.title = fmtCountdown(l.resetsAt);
    row.append(k, track, v);
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
  if (!latest) {
    // No data yet: if the first fetch failed, at least show the status
    // (offline/expired) instead of staying stuck on "connecting…".
    if (stale) { renderWindow('five', null); renderWindow('seven', null); renderMini(null); renderStatus(null); }
    return;
  }
  renderWindow('five', latest.fiveHour);
  renderWindow('seven', latest.sevenDay);
  renderModels(latest);
  renderLimits(latest);
  renderStatus(latest);
  renderMini(latest);
  reportHeight();
}

function startCountdown() {
  clearInterval(countdownTimer);
  countdownTimer = setInterval(() => {
    if (!latest) return;
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

function renderTokens(tk) {
  const tt = tk.totals || {};
  $('tok-in').textContent = fmtTok(tt.input);
  $('tok-out').textContent = fmtTok(tt.output);
  $('tok-cr').textContent = fmtTok(tt.cacheRead);
  $('tok-cw').textContent = fmtTok(tt.cacheWrite);
  $('tok-cost').textContent = '$' + (tk.cost || 0).toFixed(2);
  // per-model split: % of today's usage + cost. opus and sonnet always;
  // fable/haiku/other only when used. Tier names are brands except "other".
  const bm = tk.byModel || {};
  const total = Object.values(bm).reduce((s, v) => s + (v.cost || 0), 0);
  const rows = [];
  for (const m of ['fable', 'opus', 'sonnet', 'haiku', 'other']) {
    if ((m === 'fable' || m === 'haiku' || m === 'other') && !bm[m]) continue;
    const cost = bm[m] ? bm[m].cost : 0;
    const pct = total > 0 ? Math.round((cost / total) * 100) : 0;
    const label = m === 'other' ? t('tier_other') : m;
    rows.push(`<div class="bm-row"><span class="bk">${label}</span><span class="bv"><span class="bpct">${pct}%</span>$${cost.toFixed(2)}</span></div>`);
  }
  $('tok-bymodel').innerHTML = rows.join('');
  // fine-detail pane: 7-day moving average (the 7 complete days before today)
  const wk = tk.week || null;
  $('tok-avg7').textContent = wk ? '$' + (wk.avgPerDay || 0).toFixed(2) : '–';
  $('tok-week').textContent = wk ? '$' + (wk.cost || 0).toFixed(2) : '–';
  reportHeight();
}

api.onTokens((tk) => {
  if (!tk) return;
  lastTk = tk;
  renderTokens(tk);
});

api.onUsage((u) => {
  latest = u;
  stale = false;
  expiredFlag = false;
  unavailableFlag = false;
  renderAll();
});

api.onError(({ last, expired, unavailable }) => {
  stale = true;
  expiredFlag = !!expired;
  unavailableFlag = !!unavailable;
  if (last) latest = last;
  renderAll();
});

// ---- Controles ----
$('btn-refresh').addEventListener('click', () => {
  $('status').textContent = t('updating');
  api.refresh();
});
$('btn-hide').addEventListener('click', () => api.hide());
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
}
// Clique simples na faisca expande (no-drag, alvo de toque generoso).
$('mini-art').addEventListener('click', (e) => { e.stopPropagation(); expand(); });
// Fallback: duplo-clique em qualquer lugar da pilula.
$('mini').addEventListener('dblclick', expand);
// Recovery via tray (in case the pill becomes unreachable).
api.onExpand(expand);

startCountdown();
