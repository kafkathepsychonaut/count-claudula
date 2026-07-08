'use strict';
// Aggregates TODAY's Claude Code tokens by reading the local JSONL files
// (~/.claude/projects/**/*.jsonl). Claude Code (CLI) only — web/desktop don't log
// locally. "API-equivalent" cost using current per-model prices + cache tiers.

const fs = require('fs');
const os = require('os');
const path = require('path');
const readline = require('readline');

// US$ per 1M tokens (ref. claude-api 2026-07). read=0.1x in; cache write 5m=1.25x, 1h=2x.
const PRICE = {
  fable:  { in: 10, out: 50, read: 1,    w5: 12.5, w1: 20 },
  opus:   { in: 5,  out: 25, read: 0.5,  w5: 6.25, w1: 10 },
  sonnet: { in: 3,  out: 15, read: 0.3,  w5: 3.75, w1: 6 },
  haiku:  { in: 1,  out: 5,  read: 0.1,  w5: 1.25, w1: 2 },
  other:  { in: 3,  out: 15, read: 0.3,  w5: 3.75, w1: 6 }, // unknown IDs: mid-tier estimate, shown as its own row
};

function tierOf(model) {
  const m = String(model || '').toLowerCase();
  if (m.includes('fable') || m.includes('mythos')) return 'fable';
  if (m.includes('opus')) return 'opus';
  if (m.includes('sonnet')) return 'sonnet';
  if (m.includes('haiku')) return 'haiku';
  return 'other';
}

function projectsDir() {
  const base = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
  return path.join(base, 'projects');
}

// Per-file cache keyed by size+mtime, so unchanged files aren't re-read every poll
// (a heavy user only actively appends to one file). Cleared when the day rolls.
const fileCache = new Map();
let cacheDay = 0;

function emptyAgg() {
  return { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0, savings: 0, byModel: {}, byProject: {} };
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

// Stream one file line by line (don't load it whole). One pass fills two
// buckets: today's full aggregate and the 7 complete days before today
// (total + per-day, for the average and the daily sparkline).
async function aggregateFile(fp, todayMs, weekMs, dayIdx) {
  const agg = emptyAgg();
  let weekCost = 0;
  const weekDays = [0, 0, 0, 0, 0, 0, 0];
  let rl;
  try { rl = readline.createInterface({ input: fs.createReadStream(fp, 'utf8'), crlfDelay: Infinity }); }
  catch (_) { return { agg, weekCost, weekDays }; }
  for await (const ln of rl) {
    if (ln.length < 40 || ln.indexOf('"usage"') < 0 || ln.indexOf('"assistant"') < 0) continue;
    let j;
    try { j = JSON.parse(ln); } catch (_) { continue; }
    const msg = j && j.message;
    if (j.type !== 'assistant' || !msg || !msg.usage || !j.timestamp) continue;
    const when = new Date(j.timestamp);
    const ts = when.getTime();
    if (ts < weekMs) continue;

    const u = msg.usage;
    const p = PRICE[tierOf(msg.model)];
    const inp = u.input_tokens || 0;
    const out = u.output_tokens || 0;
    const cr = u.cache_read_input_tokens || 0;
    const cwTot = u.cache_creation_input_tokens || 0;
    const cc = u.cache_creation || {};
    const w1 = cc.ephemeral_1h_input_tokens || 0;
    const w5 = cc.ephemeral_5m_input_tokens != null ? cc.ephemeral_5m_input_tokens : Math.max(0, cwTot - w1);
    const lineCost = (inp * p.in + out * p.out + cr * p.read + w1 * p.w1 + w5 * p.w5) / 1e6;

    if (ts < todayMs) {
      // bucket by exact local day (DST-safe); a line outside the 7 mapped days
      // (clock-edge stragglers) is skipped so the total always matches the buckets
      const idx = dayIdx[localDayKey(when)];
      if (idx == null) continue;
      weekDays[idx] += lineCost;
      weekCost += lineCost;
      continue;
    }

    const t = tierOf(msg.model);
    const m = agg.byModel[t] || (agg.byModel[t] = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0 });
    m.input += inp; m.output += out; m.cacheRead += cr; m.cacheWrite += cwTot; m.cost += lineCost;
    agg.input += inp; agg.output += out; agg.cacheRead += cr; agg.cacheWrite += cwTot; agg.cost += lineCost;
    // net cache economics vs a no-cache baseline (all those tokens as plain
    // input): reads save (in − read) each, writes cost a premium over input
    agg.savings += (cr * (p.in - p.read) - w1 * (p.w1 - p.in) - w5 * (p.w5 - p.in)) / 1e6;
    const proj = projectKeyOf(j.cwd);
    if (proj) {
      const pr = agg.byProject[proj] || (agg.byProject[proj] = { cost: 0 });
      pr.cost += lineCost;
    }
  }
  return { agg, weekCost, weekDays };
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
  const totals = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
  const byModel = {};
  const byProject = {};
  let cost = 0;
  let savings = 0;
  let weekCost = 0;
  const weekDays = [0, 0, 0, 0, 0, 0, 0];

  for (const { fp, size, mtimeMs } of files) {
    seen.add(fp);
    let entry = fileCache.get(fp);
    if (!entry || entry.size !== size || entry.mtimeMs !== mtimeMs) {
      const r = await aggregateFile(fp, startMs, weekMs, dayIdx); // re-read only changed files
      entry = { size, mtimeMs, agg: r.agg, weekCost: r.weekCost, weekDays: r.weekDays };
      fileCache.set(fp, entry);
    }
    const a = entry.agg;
    weekCost += entry.weekCost;
    for (let i = 0; i < 7; i++) weekDays[i] += entry.weekDays[i];
    totals.input += a.input; totals.output += a.output; totals.cacheRead += a.cacheRead; totals.cacheWrite += a.cacheWrite;
    cost += a.cost;
    savings += a.savings || 0;
    for (const [t, v] of Object.entries(a.byModel)) {
      const m = byModel[t] || (byModel[t] = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0 });
      m.input += v.input; m.output += v.output; m.cacheRead += v.cacheRead; m.cacheWrite += v.cacheWrite; m.cost += v.cost;
    }
    for (const [name, v] of Object.entries(a.byProject || {})) {
      const pr = byProject[name] || (byProject[name] = { cost: 0 });
      pr.cost += v.cost;
    }
  }

  for (const k of fileCache.keys()) if (!seen.has(k)) fileCache.delete(k); // prune gone files

  // average over days that actually had activity — dividing by a flat 7
  // understates the figure for anyone with fewer days of history
  const activeDays = weekDays.filter((c) => c > 0).length;
  return {
    at: Date.now(), totals, cost, savings, byModel, byProject,
    week: { cost: weekCost, avgPerDay: weekCost / Math.max(1, activeDays), days: weekDays, activeDays },
  };
}

module.exports = { todayUsage };

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
