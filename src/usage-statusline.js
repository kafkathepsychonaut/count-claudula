'use strict';
// THE DEFAULT data source (and, since v1.4.8, where an un-consented endpoint pin
// gets moved). ToS-clean. Claude Code pipes a JSON payload to the
// user's statusLine command on every status update, and that payload carries
// rate_limits (the same 5h/7d percentages the endpoint reports) — no
// credential read, no network. A tiny capture script (written to userData on
// every boot while this source is active — no user action needed) persists each
// payload; we read the files here.
//
// TERMINAL ONLY — the constraint that decides whether this source works at all.
// statusLine belongs to the Claude Code CLI's terminal UI. The IDE extension
// panel (VS Code / Cursor / Antigravity) and the Claude desktop app NEVER run
// it, so on those surfaces settings.json can be perfect and no capture file ever
// appears. Verified against the docs 2026-07-20; there is no supported
// alternative (OTel carries no rate_limits, hooks carry no usage, and the
// extension's own session store is undocumented). main.js detects this exact
// state — our command installed, zero captures — and says so, because "set up
// statusLine" told those users to fix what was already correct.
//
// rate_limits itself is Pro/Max-only AND only present after a session's first
// API response, so an opened-but-unprompted session legitimately has none.
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
// Trade-off vs the endpoint: the data only refreshes while a Claude Code session
// is generating, and it doesn't see usage from web/desktop between refreshes.

const fs = require('fs');
const path = require('path');

// No Claude Code session for a while => the percentages are too old to show
// as live. Surfaced like an expired token: "open Claude Code" is the fix.
const STALE_MS = 2 * 60 * 60 * 1000;
// Dead-session files older than this are swept on read (only while a fresh file
// exists, so we never delete the last signal). One file per session run would
// otherwise accumulate forever.
const PRUNE_MS = 24 * 60 * 60 * 1000;
// Orphaned *.tmp writes older than this are reaped. A live capture script writes
// and renames within milliseconds, so anything this old is provably abandoned —
// no in-flight write can still own it.
const TMP_ORPHAN_MS = 5 * 60 * 1000;
// How long fresh-but-windowless captures must persist before we stop believing
// the caller's knownSubscriber latch (see readStatusline). Deliberately past
// STALE_MS: the case the latch exists for — a session that hasn't made its first
// API call yet — is a gap of seconds, and can't outlive STALE_MS anyway, because
// after that there's no fresh capture left and we report stale instead.
const SUBSCRIBER_LATCH_MS = 3 * 60 * 60 * 1000;
// ...and over more than one reading, so a laptop that slept through the whole
// interval can't decay the latch on its first poll after waking.
const SUBSCRIBER_LATCH_MIN_READS = 3;

function captureFile(userData) { return path.join(userData, 'statusline.json'); }
function scriptFile(userData) { return path.join(userData, 'statusline-capture.js'); }

// True for a persisted capture file — the legacy single file or a per-session
// one (statusline.<id>.json). Excludes the capture script and *.tmp writes.
// Shared with main.js's file watcher so both agree on what to react to.
function isCaptureFileName(name) {
  return name === 'statusline.json' || /^statusline\..+\.json$/.test(name);
}

// True for a capture script temp write (statusline[.<id>].json.<pid>.tmp). The
// script writes one then renames it over the target; if it dies in between the
// temp survives — Claude Code kills statusLine commands that outrun its timeout,
// and every invocation is a fresh short-lived process. On Windows the rename can
// also fail with EPERM while an AV/indexer holds the just-created temp, which
// defeats the script's own unlink fallback on that same locked file. Each orphan
// carries a unique pid, so without this they pile up one per failed invocation,
// forever, in userData — and isCaptureFileName can't see them (it requires a
// .json suffix), so they need their own sweep.
function isTempCaptureFileName(name) {
  return /^statusline\.(.+\.)?json\.\d+\.tmp$/.test(name);
}

// Reap abandoned temp writes. Age-gated so we never touch one a live capture
// process is mid-write on.
function sweepTempCaptures(userData, names) {
  const now = Date.now();
  for (const n of names) {
    if (!isTempCaptureFileName(n)) continue;
    const fp = path.join(userData, n);
    try {
      if (now - fs.statSync(fp).mtimeMs > TMP_ORPHAN_MS) fs.unlinkSync(fp);
    } catch (_) { /* already gone, or still locked by whatever broke the rename — next read retries */ }
  }
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

// Does a captured payload carry at least one usable rate-limit window? Claude
// Code populates rate_limits ONLY for claude.ai subscribers (Pro/Max) and ONLY
// after the first API response of a session — so a fresh capture written at
// session start (or between calls) legitimately lacks it. Used to tell a
// transient gap ("subscriber, no response yet") apart from a genuine API-key
// account that will NEVER report windows.
function hasRateLimits(data) {
  const rl = (data && data.rate_limits) || {};
  for (const key of ['five_hour', 'seven_day']) {
    const w = rl[key];
    if (w && typeof w.used_percentage === 'number') return true;
  }
  return false;
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
//
// opts.knownSubscriber: the caller has seen rate_limits from this install before
// (persisted across restarts). It hardens the transient-gap detection for the
// case where every rate-limit-bearing capture has already rotated off disk, so a
// subscriber is never mislabelled an API-key account just because their newest
// session hasn't produced an API response yet. It DECAYS (see below) — nothing
// ever clears the caller's persisted flag, so on its own it would trap a
// downgraded account in the transient-gap state forever.
//
// Latch-decay bookkeeping. Kept in memory rather than persisted on purpose: a
// restart grants one more grace period, which is the forgiving direction, and
// the latch decays again a few hours into the new run. The noCredential error
// also carries .subscriberLatchExpired so the caller can drop its persisted
// flag and make the recovery permanent.
let windowlessSince = null;   // start of the current unbroken fresh-but-windowless run
let windowlessReads = 0;      // readings in that run

// Any read that DIDN'T get far enough to judge the windows has to end the run —
// otherwise "unbroken" is a lie. Every early throw above (no captures at all,
// nothing parseable, nothing fresh) returns before the counter, so hours of
// no-data used to sit *inside* a supposedly contiguous run: the elapsed test
// then measured the span between the first and last qualifying read rather than
// sustained windowlessness, and the minimum-reads guard was no defence because
// the watcher fires a poll 400ms after every capture write. A Pro subscriber who
// opened Claude Code twice into the pre-first-API-call gap, hours apart, could
// decay the latch and lose their bars — the exact regression v1.4.6 fixed.
function breakWindowlessRun() {
  windowlessSince = null;
  windowlessReads = 0;
}

function readStatusline(userData, opts) {
  const knownSubscriber = !!(opts && opts.knownSubscriber);
  let names;
  try { names = fs.readdirSync(userData); }
  catch (_) { names = []; }
  const files = names.filter(isCaptureFileName).map((n) => path.join(userData, n));
  // Before any early return: orphaned temps are never a signal, so unlike the
  // dead-session sweep below there's nothing to protect by waiting for a fresh
  // file — and an install stuck in the needsSetup/stale states is exactly one
  // that would otherwise never get swept.
  sweepTempCaptures(userData, names);

  if (!files.length) {
    // Claude Code has never piped its statusLine here — a one-time setup, not a
    // stale-data state. Signalled separately so the UI nudges "configure it".
    breakWindowlessRun();
    const e = new Error('statusline not set up yet'); e.expired = true; e.needsSetup = true; throw e;
  }

  const now = Date.now();
  const fresh = [];          // parsed payloads within STALE_MS
  let parsedAny = false;     // at least one file was valid JSON
  let everHadRateLimits = false; // any parsed file (fresh OR stale) carried a window
  const stalePaths = [];     // fresh-enough to keep, too old to prune... tracked for sweep
  for (const fp of files) {
    let j;
    try { j = JSON.parse(fs.readFileSync(fp, 'utf8')); }
    catch (_) { continue; } // missing/torn/half-written — skip this one, others may be fine
    if (!j || typeof j.at !== 'number') continue;
    parsedAny = true;
    if (hasRateLimits(j.data)) everHadRateLimits = true;
    if (now - j.at <= STALE_MS) fresh.push(j);
    else if (now - j.at > PRUNE_MS) stalePaths.push(fp);
  }

  if (!parsedAny) {
    // Every file failed to parse — almost always a torn read of a mid-write file.
    // Transient blip, NOT needsSetup: a configured widget must not flash "set up
    // statusLine" over one bad read.
    breakWindowlessRun();
    const e = new Error('statusline capture unreadable (mid-write?)'); e.expired = true; throw e;
  }
  if (!fresh.length) {
    breakWindowlessRun();
    const e = new Error('statusline data stale'); e.expired = true; throw e;
  }

  // Housekeeping: sweep long-dead session files, but only now that we have a
  // fresh one, so we never delete the last remaining signal. Re-read each one
  // immediately before unlinking rather than trusting the classification made
  // earlier in this pass: the capture script runs in another process and renames
  // a brand-new payload over this exact path whenever its session emits an
  // update, and a >24h-old file coming back to life is precisely `claude
  // --resume` (resume keeps the session_id, so the same path is reused). A
  // rename landing in that gap would otherwise delete just-written fresh data
  // and the widget would briefly under-report.
  for (const fp of stalePaths) {
    try {
      const j = JSON.parse(fs.readFileSync(fp, 'utf8'));
      if (!j || typeof j.at !== 'number' || Date.now() - j.at <= PRUNE_MS) continue; // resumed since we looked
      fs.unlinkSync(fp);
    } catch (_) { /* unreadable = torn mid-rename; leave it, the next pass re-decides */ }
  }

  const fiveHour = aggregateWindow(fresh, 'five_hour');
  const sevenDay = aggregateWindow(fresh, 'seven_day');
  // A run only accrues while NOTHING on disk carries a window: any rate-limit-
  // bearing capture, even one too stale to show, is live proof this install
  // still gets windows, so it restarts the clock.
  if (!fiveHour && !sevenDay && !everHadRateLimits) {
    if (windowlessSince == null) windowlessSince = now;
    windowlessReads++;
  } else {
    breakWindowlessRun();
  }
  if (!fiveHour && !sevenDay) {
    // The latch has to expire or a user who drops from Pro to API-key/Console
    // billing is stuck forever: the caller persists "saw rate limits" the first
    // time windows appear and never clears it, so noCredential below could never
    // fire again — the widget would keep showing months-old percentages as stale
    // bars behind a "run a Claude Code command" nudge that no amount of running
    // commands can satisfy, and never reach the cost-only layout. Only deleting
    // the state file recovered it.
    const latchDecayed = windowlessSince != null
      && (now - windowlessSince) > SUBSCRIBER_LATCH_MS
      && windowlessReads >= SUBSCRIBER_LATCH_MIN_READS;
    if (everHadRateLimits || (knownSubscriber && !latchDecayed)) {
      // A subscriber whose CURRENT fresh capture just has no window: rate_limits
      // is populated only after the first API response of a session, so a newly
      // opened window (or one idle between calls) reports none, and the rate-
      // limit-bearing captures may have aged past STALE_MS. This is a transient
      // gap, NOT an API-key account — surface it like an expired token so the
      // widget keeps its last-known bars and nudges "run a Claude Code command"
      // instead of flipping to the permanent no-subscription (cost-only) layout
      // and hiding real bars.
      const e = new Error('statusline fresh but no current rate_limits (subscriber awaiting an API response)');
      e.expired = true;
      throw e;
    }
    // Fresh capture(s) but no rate_limits ever seen: Claude Code is demonstrably
    // running but the account has no subscription windows — an API-key / Console
    // login. Signal it like the endpoint source does so the widget shows its
    // cost-first layout instead of nagging "open Claude Code".
    const e = new Error('statusline payload has no rate_limits (API key / Console account)');
    e.noCredential = true;
    // Tells the caller its persisted knownSubscriber flag is stale and should be
    // cleared, so this recovery survives a restart instead of costing the user
    // another SUBSCRIBER_LATCH_MS of wrong bars on every launch.
    if (knownSubscriber) e.subscriberLatchExpired = true;
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
