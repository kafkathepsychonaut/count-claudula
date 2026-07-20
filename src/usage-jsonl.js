'use strict';
// Aggregates TODAY's Claude Code tokens by reading the local JSONL files
// (~/.claude/projects/**/*.jsonl). Claude Code (CLI) only — web/desktop don't log
// locally. "API-equivalent" cost using current per-model prices + cache tiers.

const fs = require('fs');
const path = require('path');
const readline = require('readline');

// US$ per 1M tokens (ref. claude-api 2026-07-19). read=0.1x in; cache write 5m=1.25x, 1h=2x.
const PRICE = {
  fable:  { in: 10, out: 50, read: 1,    w5: 12.5, w1: 20 },
  opus:   { in: 5,  out: 25, read: 0.5,  w5: 6.25, w1: 10 },
  sonnet: { in: 3,  out: 15, read: 0.3,  w5: 3.75, w1: 6 },
  haiku:  { in: 1,  out: 5,  read: 0.1,  w5: 1.25, w1: 2 },
  other:  { in: 3,  out: 15, read: 0.3,  w5: 3.75, w1: 6 }, // unknown IDs: mid-tier estimate, shown as its own row
  sonnet5: { in: 2, out: 10, read: 0.2,  w5: 2.5,  w1: 4 }, // launch promo, see SONNET5_INTRO_END
};

// Sonnet 5 shipped on introductory pricing that runs THROUGH 2026-08-31 and
// then reverts to the standard sonnet row ($3/$15) — so the first standard-
// priced instant is 2026-09-01Z. Every line is priced by its OWN timestamp
// rather than by "now", which makes the rollover self-executing: lines logged
// inside the window keep intro rates forever (a cached cost stays correct even
// when re-read in September) and later lines bill $3/$15 with no release, no
// edit, and no silent 1.5x overcharge the morning the promo ends.
const SONNET5_INTRO_END = Date.UTC(2026, 8, 1);

function tierOf(model) {
  const m = String(model || '').toLowerCase();
  if (m.includes('fable') || m.includes('mythos')) return 'fable';
  if (m.includes('opus')) return 'opus';
  if (m.includes('sonnet')) return 'sonnet';
  if (m.includes('haiku')) return 'haiku';
  return 'other';
}

// Per-model-version pricing, the same way costMultiplier() discriminates on
// version below. Deliberately NOT a new tierOf() tier: the renderer walks a
// fixed list of tier names, so a 'sonnet5' bucket would drop its cost silently
// out of the by-model breakdown. Sonnet 5 bills at its own rates but still
// displays under 'sonnet'. 'sonnet-4-5' can't match — it has no 'sonnet-5'.
function priceOf(model, ts) {
  const id = String(model || '').toLowerCase();
  if (ts < SONNET5_INTRO_END && /sonnet-5(?!\d)/.test(id)) return PRICE.sonnet5;
  return PRICE[tierOf(model)];
}

// Billing modifiers the JSONL already records per line (ref. claude-api /
// service-tiers + fast-mode docs 2026-07). They stack multiplicatively on the
// standard per-token price; priority tier bills at standard rates (it's a
// capacity commitment, not a price change), so it needs no factor here.
function costMultiplier(usage, model) {
  let mult = 1;
  const id = String(model || '').toLowerCase();
  if (usage.service_tier === 'batch') mult *= 0.5; // Batch API: 50% of standard
  if (usage.speed === 'fast') {
    // fast mode premium is per-model; unsupported models bill standard and
    // report usage.speed 'standard', so keying off the reported speed is safe
    if (id.includes('opus-4-8')) mult *= 2;
    else if (id.includes('opus-4-7')) mult *= 6;
  }
  // US-only inference: 1.1x on Opus 4.6/Sonnet 4.6 and later. Pre-4.6 models
  // reject the parameter outright, so an EXCLUSION list of the old families is
  // forward-compatible where an allowlist would silently miss future models.
  const preGeo = /(opus-4-[0-5]|sonnet-4-[0-5]|haiku-4-5)(?!\d)|claude-[23][.-]/;
  if (usage.inference_geo === 'us' && !preGeo.test(id)) mult *= 1.1;
  return mult;
}

// Shared resolver: reading process.env directly here missed a CLAUDE_CONFIG_DIR
// exported from a shell profile, because a GUI-launched app never inherits one —
// so the token pane silently scanned an empty ~/.claude and reported "no
// activity" while Claude Code wrote transcripts elsewhere.
const { projectsDir } = require('./claude-paths');

// Per-file cache keyed by size+mtime, so unchanged files aren't re-read every poll
// (a heavy user only actively appends to one file). Cleared when the day rolls.
// Persisted to disk (when a dir is provided) so an app restart doesn't re-parse
// a thousand transcripts — the first scan of a heavy history takes many seconds.
const fileCache = new Map();
let cacheDay = 0;
let cacheDir = null;
let cacheLoaded = false;
let cacheSaveTimer = null;

function setCacheDir(dir) { cacheDir = dir; }
function cacheFilePath() { return cacheDir ? path.join(cacheDir, 'jsonl-cache.json') : null; }

const CACHE_V = 2; // bump when the entry shape changes — old files are then ignored wholesale

// One record per billed response, as positional arrays — this cache is
// rewritten every few seconds while a session streams, and a week of heavy use
// is thousands of records, so field names would dominate the file size.
//   today: [key, output, cost, savings, tier, input, cacheRead, cacheWrite, project]
//   week:  [key, output, cost, dayIdx]
// Week rows carry only what the sparkline needs; today's rows carry the full
// breakdown. Both keep `output` because that is what picks the winner between
// duplicates (see todayUsage).
const TODAY_REC_LEN = 9;
const WEEK_REC_LEN = 4;

// v1 cached one pre-summed total per file, which cannot be deduplicated after
// the fact; v2 caches the per-response records instead. The version gate above
// discards a v1 file wholesale rather than reading its {agg, weekCost} shape as
// an empty v2 entry, which would silently report $0.00 after an upgrade.
function validRec(r, len) {
  if (!Array.isArray(r) || r.length !== len || typeof r[0] !== 'string') return false;
  for (let i = 1; i < len; i++) {
    if (len === TODAY_REC_LEN && (i === 4 || i === 8)) {
      if (r[i] !== null && typeof r[i] !== 'string') return false; // tier, project path
    } else if (!Number.isFinite(r[i])) return false;
  }
  return true;
}

// A poisoned entry would silently skip re-aggregation while breaking the
// summation on every poll, so entries are validated field by field on load;
// anything suspect just re-parses (slower, never wrong).
function validCacheEntry(v) {
  return v && Number.isFinite(v.size) && Number.isFinite(v.mtimeMs)
    && Array.isArray(v.today) && v.today.every((r) => validRec(r, TODAY_REC_LEN))
    && Array.isArray(v.week) && v.week.every((r) => validRec(r, WEEK_REC_LEN)
      && r[3] >= 0 && r[3] < 7); // day bucket indexes weekDays[] directly
}

function loadCacheFromDisk(startMs) {
  cacheLoaded = true;
  const fp = cacheFilePath();
  if (!fp) return;
  try {
    const j = JSON.parse(fs.readFileSync(fp, 'utf8'));
    if (j.v !== CACHE_V || j.day !== startMs) return; // shape or windows moved
    for (const [k, v] of Object.entries(j.entries || {})) {
      if (validCacheEntry(v)) fileCache.set(k, v);
    }
    cacheDay = startMs;
  } catch (_) { /* cold start is just slower, not wrong */ }
}

function cacheSnapshot() {
  const entries = {};
  for (const [k, v] of fileCache.entries()) entries[k] = v;
  return JSON.stringify({ v: CACHE_V, day: cacheDay, entries });
}

function scheduleCacheSave() {
  const fp = cacheFilePath();
  if (!fp) return;
  clearTimeout(cacheSaveTimer);
  cacheSaveTimer = setTimeout(() => {
    cacheSaveTimer = null;
    fs.promises.writeFile(fp, cacheSnapshot()).catch(() => {});
  }, 3000);
}

// Quit path: a pending debounced save would otherwise be silently dropped.
function flushCache() {
  if (!cacheSaveTimer) return;
  clearTimeout(cacheSaveTimer);
  cacheSaveTimer = null;
  const fp = cacheFilePath();
  if (!fp) return;
  try { fs.writeFileSync(fp, cacheSnapshot()); } catch (_) {}
}

// Identity of the billed API response a line belongs to. Claude Code writes one
// JSONL line PER CONTENT BLOCK and one per streaming checkpoint, so a single
// response (text + tool_use) lands as several lines that each repeat the whole
// message.usage — and `claude --resume` / rewind / --fork-session copy the
// prior history verbatim into a new .jsonl, so those same lines reappear under
// a second path. Both files pass the mtime filter, so without this the day's
// cost roughly doubles. message.id is the API's own per-response id (never
// observed missing, and never seen split across two requestIds); requestId
// joins it as a tiebreak when present. A line with no message.id can't be
// matched to anything, so it falls back to a path+line key: it stays distinct
// rather than collapsing unrelated turns into one.
function identityOf(j, msg, fp, lineNo) {
  const id = msg && msg.id;
  if (typeof id === 'string' && id) {
    return id + '|' + (typeof j.requestId === 'string' ? j.requestId : '');
  }
  return fp + '#' + lineNo;
}

// Transcripts are not confined to projects/<dir>/*.jsonl: subagent and workflow
// transcripts live in nested session folders (…/<session>/subagents/**.jsonl).
// A single-level scan silently undercounts any day that used subagents, so walk
// recursively (bounded — the tree is shallow; the cap only guards pathology).
const MAX_WALK_DEPTH = 6;
async function collectFiles(dir, minMtimeMs, depth, out) {
  let ents;
  try { ents = await fs.promises.readdir(dir, { withFileTypes: true }); }
  catch (_) { return; }
  for (const ent of ents) {
    const fp = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (depth < MAX_WALK_DEPTH) await collectFiles(fp, minMtimeMs, depth + 1, out);
      continue;
    }
    if (!ent.name.endsWith('.jsonl')) continue;
    // only files touched within the week window (a file whose last append
    // predates the window has no lines inside it)
    try {
      const st = await fs.promises.stat(fp);
      if (st.mtimeMs >= minMtimeMs) out.push({ fp, size: st.size, mtimeMs: st.mtimeMs });
    } catch (_) {}
  }
}

function localDayKey(d) {
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}

// Sessions are attributed to their full working directory; the renderer derives
// the display basename. Keying by full path keeps two repos that happen to share
// a folder name ("api", "scripts") apart. Lines without a cwd are skipped.
function projectKeyOf(cwd) {
  if (typeof cwd !== 'string' || !cwd) return null;
  return cwd;
}

// Stream one file line by line (don't load it whole), emitting one record per
// line rather than a running total. A pre-summed per-file total cannot be
// deduplicated after the fact — the duplicates this has to cancel live in
// OTHER files (forked sessions) and in cached files that are never re-read —
// so the summing moves to todayUsage, which sees every file at once.
async function aggregateFile(fp, todayMs, weekMs, dayIdx) {
  // Resolve this file's own duplicates as we read, so the cache stores one
  // record per billed response rather than one per line (~60% fewer). The
  // winner rule is the same max-output_tokens used across files below, and max
  // is associative, so folding locally first and globally after is identical to
  // one global pass — it just moves the work off the poll path.
  const recs = new Map();
  let rl;
  try { rl = readline.createInterface({ input: fs.createReadStream(fp, 'utf8'), crlfDelay: Infinity }); }
  catch (_) { return { today: [], week: [] }; }
  let lineNo = 0;
  for await (const ln of rl) {
    lineNo++;
    if (ln.length < 40 || ln.indexOf('"usage"') < 0 || ln.indexOf('"assistant"') < 0) continue;
    let j;
    try { j = JSON.parse(ln); } catch (_) { continue; }
    const msg = j && j.message;
    if (j.type !== 'assistant' || !msg || !msg.usage || !j.timestamp) continue;
    const when = new Date(j.timestamp);
    const ts = when.getTime();
    if (ts < weekMs) continue;

    const u = msg.usage;
    const out = u.output_tokens || 0;
    const key = identityOf(j, msg, fp, lineNo);
    const prev = recs.get(key);
    if (prev && prev.out >= out) continue; // an earlier, fuller snapshot already won

    const p = priceOf(msg.model, ts);
    const inp = u.input_tokens || 0;
    const cr = u.cache_read_input_tokens || 0;
    const cwTot = u.cache_creation_input_tokens || 0;
    const cc = u.cache_creation || {};
    const w1 = cc.ephemeral_1h_input_tokens || 0;
    const w5 = cc.ephemeral_5m_input_tokens != null ? cc.ephemeral_5m_input_tokens : Math.max(0, cwTot - w1);
    const mult = costMultiplier(u, msg.model);
    const lineCost = mult * (inp * p.in + out * p.out + cr * p.read + w1 * p.w1 + w5 * p.w5) / 1e6;

    if (ts < todayMs) {
      // bucket by exact local day (DST-safe); a line outside the 7 mapped days
      // (clock-edge stragglers) is skipped so the total always matches the buckets
      const idx = dayIdx[localDayKey(when)];
      if (idx == null) continue;
      recs.set(key, { out, isToday: false, r: [key, out, lineCost, idx] });
      continue;
    }

    // net cache economics vs a no-cache baseline (all those tokens as plain
    // input): reads save (in − read) each, writes cost a premium over input.
    // Billing modifiers scale every token price, so the delta scales too.
    const savings = mult * (cr * (p.in - p.read) - w1 * (p.w1 - p.in) - w5 * (p.w5 - p.in)) / 1e6;
    recs.set(key, {
      out, isToday: true,
      r: [key, out, lineCost, savings, tierOf(msg.model), inp, cr, cwTot, projectKeyOf(j.cwd)],
    });
  }
  const today = [];
  const week = [];
  for (const v of recs.values()) (v.isToday ? today : week).push(v.r);
  return { today, week };
}

async function todayUsage() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const startMs = start.getTime();
  // the 7 complete local days before today (setDate is DST-exact where a
  // fixed 7×24h subtraction is not)
  const weekStart = new Date(start);
  weekStart.setDate(weekStart.getDate() - 7);
  const weekMs = weekStart.getTime();
  // map each of those days to a sparkline bucket: 0 = oldest … 6 = yesterday
  const dayIdx = {};
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() - (7 - i));
    dayIdx[localDayKey(d)] = i;
  }
  if (!cacheLoaded) loadCacheFromDisk(startMs); // one-time warm start from the previous run
  if (startMs !== cacheDay) { fileCache.clear(); cacheDay = startMs; } // new day: drop the cache (windows moved)

  // The root readdir failing (missing dir, EACCES, ENOTDIR…) means "no data",
  // not "zero usage" — null lets the UI show the explanatory empty state.
  const root = projectsDir();
  let rootEnts;
  try { rootEnts = await fs.promises.readdir(root, { withFileTypes: true }); }
  catch (_) { return null; }
  const files = [];
  for (const ent of rootEnts) {
    if (ent.isDirectory()) await collectFiles(path.join(root, ent.name), weekMs, 1, files);
  }

  const seen = new Set();
  let dirty = false;
  for (const { fp, size, mtimeMs } of files) {
    seen.add(fp);
    const entry = fileCache.get(fp);
    if (!entry || entry.size !== size || entry.mtimeMs !== mtimeMs) {
      const r = await aggregateFile(fp, startMs, weekMs, dayIdx); // re-read only changed files
      fileCache.set(fp, { size, mtimeMs, today: r.today, week: r.week });
      dirty = true;
    }
  }

  for (const k of fileCache.keys()) if (!seen.has(k)) { fileCache.delete(k); dirty = true; } // prune gone files
  if (dirty) scheduleCacheSave();

  // Resolve duplicates across every file before summing anything. Highest
  // output_tokens wins: Claude Code appends a line per streaming checkpoint, so
  // the early copies of a response carry a PARTIAL output count (5 tokens) and
  // only the last carries the real one (2327) — first-wins would gut the output
  // figure. Max is order-independent, so a file served from cache and the same
  // file re-parsed settle on the same record, and a forked copy of a session
  // agrees with its original no matter which is walked first.
  // One map for both buckets, so a response whose checkpoints straddle local
  // midnight lands wholly in the winner's bucket instead of being counted twice.
  const chosen = new Map();
  const claim = (r, isToday) => {
    const prev = chosen.get(r[0]);
    if (!prev || r[1] > prev.r[1]) chosen.set(r[0], { r, isToday });
  };
  for (const entry of fileCache.values()) {
    for (const r of entry.today) claim(r, true);
    for (const r of entry.week) claim(r, false);
  }

  const totals = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
  const byModel = {};
  const byProject = {};
  let cost = 0;
  let savings = 0;
  let weekCost = 0;
  const weekDays = [0, 0, 0, 0, 0, 0, 0];

  for (const { r, isToday } of chosen.values()) {
    if (!isToday) {
      weekCost += r[2];
      weekDays[r[3]] += r[2];
      continue;
    }
    const [, out, lineCost, sav, tier, inp, cr, cw, proj] = r;
    const m = byModel[tier] || (byModel[tier] = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0 });
    m.input += inp; m.output += out; m.cacheRead += cr; m.cacheWrite += cw; m.cost += lineCost;
    totals.input += inp; totals.output += out; totals.cacheRead += cr; totals.cacheWrite += cw;
    cost += lineCost;
    savings += sav;
    if (proj) {
      const pr = byProject[proj] || (byProject[proj] = { cost: 0 });
      pr.cost += lineCost;
    }
  }

  // average over days that actually had activity — dividing by a flat 7
  // understates the figure for anyone with fewer days of history
  const activeDays = weekDays.filter((c) => c > 0).length;
  return {
    at: Date.now(), totals, cost, savings, byModel, byProject,
    week: { cost: weekCost, avgPerDay: weekCost / Math.max(1, activeDays), days: weekDays, activeDays },
  };
}

module.exports = { todayUsage, setCacheDir, flushCache };

if (require.main === module) {
  todayUsage().then((r) => {
    if (!r) { console.log('no data'); return; }
    const k = (n) => n >= 1e6 ? (n / 1e6).toFixed(2) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'k' : '' + n;
    console.log(`today (Claude Code): in ${k(r.totals.input)} · out ${k(r.totals.output)} · cacheR ${k(r.totals.cacheRead)} · cacheW ${k(r.totals.cacheWrite)}`);
    console.log(`API-equivalent cost: $${r.cost.toFixed(2)} · net cache savings: $${r.savings.toFixed(2)}`);
    for (const [m, v] of Object.entries(r.byModel)) console.log(`  ${m}: $${v.cost.toFixed(2)}`);
    for (const [p, v] of Object.entries(r.byProject)) console.log(`  [${p}]: $${v.cost.toFixed(2)}`);
    console.log(`prev 7 days: $${r.week.cost.toFixed(2)} (avg $${r.week.avgPerDay.toFixed(2)}/day over ${r.week.activeDays} active) · daily: ${r.week.days.map((c) => c.toFixed(0)).join(' ')}`);
  });
}
