'use strict';
// Alternative, ToS-clean data source. Claude Code pipes a JSON payload to the
// user's statusLine command on every status update, and that payload carries
// rate_limits (the same 5h/7d percentages the endpoint reports) — no
// credential read, no network. A tiny capture script (written to userData when
// the user enables this source) persists each payload; we read the file here.
//
// Trade-off vs the endpoint (why this is opt-in, not the default): the data
// only refreshes while a Claude Code session is active, and it doesn't see
// usage from web/desktop.

const fs = require('fs');
const path = require('path');

// No Claude Code session for a while => the percentages are too old to show
// as live. Surfaced like an expired token: "open Claude Code" is the fix.
const STALE_MS = 2 * 60 * 60 * 1000;

function captureFile(userData) { return path.join(userData, 'statusline.json'); }
function scriptFile(userData) { return path.join(userData, 'statusline-capture.js'); }

// The standalone capture script. It must live as a real file on disk (a
// packaged app's sources are inside app.asar, which the system node can't
// run), so the app writes it out when the source is enabled. It persists the
// payload next to itself and prints a compact status line, so it's also a
// usable statusLine on its own.
const CAPTURE_SRC = `'use strict';
// Count Claudula statusline capture. Claude Code pipes its statusLine JSON to
// this script's stdin; it saves the payload next to itself (statusline.json,
// read by the Count Claudula widget) and prints a compact status line.
const fs = require('fs');
const path = require('path');
let raw = '';
process.stdin.on('data', (c) => { raw += c; });
process.stdin.on('end', () => {
  let j = {};
  try { j = JSON.parse(raw); } catch (_) {}
  try {
    fs.writeFileSync(path.join(__dirname, 'statusline.json'), JSON.stringify({ at: Date.now(), data: j }));
  } catch (_) {}
  const rl = (j && j.rate_limits) || {};
  const p = (w) => (w && w.used_percentage != null) ? Math.round(w.used_percentage) + '%' : '--';
  const model = (j && j.model && (j.model.display_name || j.model.id)) || '';
  process.stdout.write((model ? model + '  ' : '') + '5h ' + p(rl.five_hour) + ' · 7d ' + p(rl.seven_day));
});
`;

// Write (or refresh) the capture script; returns its path. Called when the
// user switches the data source to statusline.
function ensureCaptureScript(userData) {
  const fp = scriptFile(userData);
  try { fs.writeFileSync(fp, CAPTURE_SRC); } catch (_) { /* surfaced as missing data */ }
  return fp;
}

// The exact statusLine command for Claude Code's settings.json.
function captureCommand(userData) {
  return 'node "' + scriptFile(userData) + '"';
}

// Read the last captured payload and map it to the same shape fetchUsage()
// returns, so the renderer doesn't care where the data came from.
// Throws (like fetchUsage) when there's no usable data:
//   .expired = true  -> no capture yet, or capture too old ("open Claude Code")
function readStatusline(userData) {
  let j;
  try {
    j = JSON.parse(fs.readFileSync(captureFile(userData), 'utf8'));
  } catch (_) {
    const e = new Error('no statusline capture yet'); e.expired = true; throw e;
  }
  if (!j || typeof j.at !== 'number' || Date.now() - j.at > STALE_MS) {
    const e = new Error('statusline data stale'); e.expired = true; throw e;
  }
  const rl = (j.data && j.data.rate_limits) || {};
  const norm = (w) => (w && typeof w.used_percentage === 'number')
    ? { utilization: Math.round(w.used_percentage), resetsAt: w.resets_at || null }
    : null;
  const fiveHour = norm(rl.five_hour);
  const sevenDay = norm(rl.seven_day);
  if (!fiveHour && !sevenDay) {
    // payload exists but carries no rate_limits (old Claude Code, or schema drift)
    const e = new Error('statusline payload has no rate_limits'); e.expired = true; throw e;
  }
  return {
    fetchedAt: j.at,
    fiveHour,
    sevenDay,
    sevenDayOpus: null,
    sevenDaySonnet: null,
    limits: [],
    overage: { enabled: false },
  };
}

module.exports = { readStatusline, ensureCaptureScript, captureCommand, captureFile };
