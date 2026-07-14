'use strict';
// Alternative, ToS-clean data source. Claude Code pipes a JSON payload to the
// user's statusLine command on every status update, and that payload carries
// rate_limits (the same 5h/7d percentages the endpoint reports) — no
// credential read, no network. A tiny capture script (written to userData when
// the user enables this source) persists each payload; we read the files here.
//
// MULTI-SESSION: every Claude Code window shares the same settings.json, so they
// all run the same statusLine command. If they all wrote ONE file, the last
// writer would win and the widget would flicker between each session's
// last-seen snapshot (a session that hasn't made an API call in a while reports
// a staler, lower %). So each session writes its OWN file (statusline.<id>.json)
// and readStatusline aggregates across them: for each window it takes the MAX
// utilization among fresh sessions in the current window. Usage only climbs
// within a window (until reset), so the max is the freshest truth and never
// dips — 20 open windows make the data fresher, not broken.
//
// Trade-off vs the endpoint (why this is opt-in for some): the data only
// refreshes while a Claude Code session is active, and it doesn't see usage
// from web/desktop between those refreshes.

const fs = require('fs');
const path = require('path');

// No Claude Code session for a while => the percentages are too old to show
// as live. Surfaced like an expired token: "open Claude Code" is the fix.
const STALE_MS = 2 * 60 * 60 * 1000;
// Dead-session files older than this are swept on read (only while a fresh file
// exists, so we never delete the last signal). One file per session run would
// otherwise accumulate forever.
const PRUNE_MS = 24 * 60 * 60 * 1000;

function captureFile(userData) { return path.join(userData, 'statusline.json'); }
function scriptFile(userData) { return path.join(userData, 'statusline-capture.js'); }

// True for a persisted capture file — the legacy single file or a per-session
// one (statusline.<id>.json). Excludes the capture script and *.tmp writes.
// Shared with main.js's file watcher so both agree on what to react to.
function isCaptureFileName(name) {
  return name === 'statusline.json' || /^statusline\..+\.json$/.test(name);
}

// The standalone capture script. It must live as a real file on disk (a
// packaged app's sources are inside app.asar, which the system node can't
// run), so the app writes it out when the source is enabled. It persists the
// payload next to itself and prints a compact status line, so it's also a
// usable statusLine on its own.
const CAPTURE_SRC = `'use strict';
// Count Claudula statusline capture. Claude Code pipes its statusLine JSON to
// this script's stdin; it saves the payload next to itself and prints a compact
// status line. Each Claude Code session writes its OWN file (statusline.<id>.json)
// so concurrent windows don't clobber each other — the widget aggregates them.
const fs = require('fs');
const path = require('path');
let raw = '';
process.stdin.on('data', (c) => { raw += c; });
process.stdin.on('end', () => {
  let j = {};
  try { j = JSON.parse(raw); } catch (_) {}
  // Per-session filename keyed by the payload's session_id (sanitized). Without
  // one (older Claude Code), fall back to the legacy single file.
  const sid = (j && typeof j.session_id === 'string') ? j.session_id.replace(/[^a-zA-Z0-9_-]/g, '') : '';
  const out = path.join(__dirname, sid ? ('statusline.' + sid + '.json') : 'statusline.json');
  // Atomic write: temp file (unique per pid) then rename over the target, so a
  // reader (the widget's watcher or poll) never sees a half-written file.
  const tmp = out + '.' + process.pid + '.tmp';
  try {
    fs.writeFileSync(tmp, JSON.stringify({ at: Date.now(), data: j }));
    fs.renameSync(tmp, out);
  } catch (_) { try { fs.unlinkSync(tmp); } catch (_) {} }
  const rl = (j && j.rate_limits) || {};
  const p = (w) => (w && w.used_percentage != null) ? Math.round(w.used_percentage) + '%' : '--';
  const model = (j && j.model && (j.model.display_name || j.model.id)) || '';
  process.stdout.write((model ? model + '  ' : '') + '5h ' + p(rl.five_hour) + ' · 7d ' + p(rl.seven_day));
});
`;

// Write (or refresh) the capture script; returns its path. Called when the
// user switches the data source to statusline, and at boot.
function ensureCaptureScript(userData) {
  const fp = scriptFile(userData);
  try { fs.writeFileSync(fp, CAPTURE_SRC); } catch (_) { /* surfaced as missing data */ }
  return fp;
}

// The exact statusLine command for Claude Code's settings.json.
function captureCommand(userData) {
  return 'node "' + scriptFile(userData) + '"';
}

// resets_at arrives as a Unix epoch in SECONDS from the statusLine payload (the
// endpoint uses an ISO string). Normalize both to epoch seconds for comparison.
function toEpochSec(v) {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') { const t = Date.parse(v); return Number.isFinite(t) ? Math.floor(t / 1000) : null; }
  return null;
}

// Aggregate one window (five_hour / seven_day) across every fresh session
// payload. The current window is the one with the latest reset boundary; among
// sessions reporting that window, the max utilization is the freshest value
// (usage only rises until reset). Older-window entries (a session whose last
// API call predates a reset) are dropped, so a reset isn't masked by a stale
// high number. Returns { utilization, resetsAt(ISO) } or null.
function aggregateWindow(entries, key) {
  const ws = [];
  for (const e of entries) {
    const w = ((e.data && e.data.rate_limits) || {})[key];
    if (w && typeof w.used_percentage === 'number') {
      ws.push({ pct: w.used_percentage, reset: toEpochSec(w.resets_at) });
    }
  }
  if (!ws.length) return null;
  let curReset = null;
  for (const x of ws) if (x.reset != null && (curReset == null || x.reset > curReset)) curReset = x.reset;
  let maxPct = -Infinity;
  for (const x of ws) {
    if (curReset != null && x.reset !== curReset) continue; // stale / pre-reset window
    if (x.pct > maxPct) maxPct = x.pct;
  }
  if (maxPct === -Infinity) return null;
  return { utilization: Math.round(maxPct), resetsAt: curReset != null ? new Date(curReset * 1000).toISOString() : null };
}

// Read every session's capture file and fold them into the same shape
// fetchUsage() returns, so the renderer doesn't care where the data came from.
// Throws (like fetchUsage) when there's no usable data:
//   .needsSetup -> no capture file at all (statusLine never wired up)
//   .expired    -> files exist but are all stale/unreadable ("open Claude Code")
//   .noCredential -> fresh capture(s) but no rate_limits (API-key / Console)
function readStatusline(userData) {
  let names;
  try { names = fs.readdirSync(userData); }
  catch (_) { names = []; }
  const files = names.filter(isCaptureFileName).map((n) => path.join(userData, n));

  if (!files.length) {
    // Claude Code has never piped its statusLine here — a one-time setup, not a
    // stale-data state. Signalled separately so the UI nudges "configure it".
    const e = new Error('statusline not set up yet'); e.expired = true; e.needsSetup = true; throw e;
  }

  const now = Date.now();
  const fresh = [];          // parsed payloads within STALE_MS
  let parsedAny = false;     // at least one file was valid JSON
  const stalePaths = [];     // fresh-enough to keep, too old to prune... tracked for sweep
  for (const fp of files) {
    let j;
    try { j = JSON.parse(fs.readFileSync(fp, 'utf8')); }
    catch (_) { continue; } // missing/torn/half-written — skip this one, others may be fine
    if (!j || typeof j.at !== 'number') continue;
    parsedAny = true;
    if (now - j.at <= STALE_MS) fresh.push(j);
    else if (now - j.at > PRUNE_MS) stalePaths.push(fp);
  }

  if (!parsedAny) {
    // Every file failed to parse — almost always a torn read of a mid-write file.
    // Transient blip, NOT needsSetup: a configured widget must not flash "set up
    // statusLine" over one bad read.
    const e = new Error('statusline capture unreadable (mid-write?)'); e.expired = true; throw e;
  }
  if (!fresh.length) {
    const e = new Error('statusline data stale'); e.expired = true; throw e;
  }

  // Housekeeping: sweep long-dead session files, but only now that we have a
  // fresh one, so we never delete the last remaining signal.
  for (const fp of stalePaths) { try { fs.unlinkSync(fp); } catch (_) { /* best effort */ } }

  const fiveHour = aggregateWindow(fresh, 'five_hour');
  const sevenDay = aggregateWindow(fresh, 'seven_day');
  if (!fiveHour && !sevenDay) {
    // Fresh capture(s) but no rate_limits anywhere: Claude Code is demonstrably
    // running but the account has no subscription windows — an API-key / Console
    // login. Signal it like the endpoint source does so the widget shows its
    // cost-first layout instead of nagging "open Claude Code".
    const e = new Error('statusline payload has no rate_limits (API key / Console account)');
    e.noCredential = true;
    throw e;
  }

  // "updated" reflects the freshest session's capture.
  const fetchedAt = fresh.reduce((mx, j) => Math.max(mx, j.at), 0);
  return {
    fetchedAt,
    fiveHour,
    sevenDay,
    sevenDayOpus: null,
    sevenDaySonnet: null,
    limits: [],
    overage: { enabled: false },
    // This source can't see paid overage or per-model 7d caps (they live only on
    // the endpoint). Flag it so the widget marks those surfaces "N/A" instead of
    // rendering them blank — a blank row reads as "you have none", which is wrong.
    partial: true,
  };
}

module.exports = { readStatusline, ensureCaptureScript, captureCommand, captureFile, isCaptureFileName };
