'use strict';
// Aggregates TODAY's Claude Code tokens by reading the local JSONL files
// (~/.claude/projects/**/*.jsonl). Claude Code (CLI) only — web/desktop don't log
// locally. "API-equivalent" cost using current per-model prices + cache tiers.

const fs = require('fs');
const os = require('os');
const path = require('path');
const readline = require('readline');

// US$ per 1M tokens (ref. claude-api 2026-06). read=0.1x in; cache write 5m=1.25x, 1h=2x.
const PRICE = {
  opus:   { in: 5,  out: 25, read: 0.5,  w5: 6.25, w1: 10 },
  sonnet: { in: 3,  out: 15, read: 0.3,  w5: 3.75, w1: 6 },
  haiku:  { in: 1,  out: 5,  read: 0.1,  w5: 1.25, w1: 2 },
};

function tierOf(model) {
  if (!model) return 'opus';
  if (model.includes('sonnet')) return 'sonnet';
  if (model.includes('haiku')) return 'haiku';
  return 'opus';
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
  return { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0, byModel: {} };
}

// Stream one file line by line (don't load it whole) and aggregate today's lines.
async function aggregateFile(fp, startMs) {
  const agg = emptyAgg();
  let rl;
  try { rl = readline.createInterface({ input: fs.createReadStream(fp, 'utf8'), crlfDelay: Infinity }); }
  catch (_) { return agg; }
  for await (const ln of rl) {
    if (ln.length < 40 || ln.indexOf('"usage"') < 0 || ln.indexOf('"assistant"') < 0) continue;
    let j;
    try { j = JSON.parse(ln); } catch (_) { continue; }
    const msg = j && j.message;
    if (j.type !== 'assistant' || !msg || !msg.usage || !j.timestamp) continue;
    if (new Date(j.timestamp).getTime() < startMs) continue;

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

    const t = tierOf(msg.model);
    const m = agg.byModel[t] || (agg.byModel[t] = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0 });
    m.input += inp; m.output += out; m.cacheRead += cr; m.cacheWrite += cwTot; m.cost += lineCost;
    agg.input += inp; agg.output += out; agg.cacheRead += cr; agg.cacheWrite += cwTot; agg.cost += lineCost;
  }
  return agg;
}

async function todayUsage() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const startMs = start.getTime();
  if (startMs !== cacheDay) { fileCache.clear(); cacheDay = startMs; } // new day: drop the cache
  const root = projectsDir();

  let dirs;
  try { dirs = await fs.promises.readdir(root, { withFileTypes: true }); }
  catch (_) { return null; }

  // only files touched today (trims the scan)
  const files = [];
  for (const d of dirs) {
    if (!d.isDirectory()) continue;
    const pd = path.join(root, d.name);
    let ents;
    try { ents = await fs.promises.readdir(pd); } catch (_) { continue; }
    for (const f of ents) {
      if (!f.endsWith('.jsonl')) continue;
      const fp = path.join(pd, f);
      try { const st = await fs.promises.stat(fp); if (st.mtimeMs >= startMs) files.push({ fp, size: st.size, mtimeMs: st.mtimeMs }); }
      catch (_) {}
    }
  }

  const seen = new Set();
  const totals = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
  const byModel = {};
  let cost = 0;

  for (const { fp, size, mtimeMs } of files) {
    seen.add(fp);
    let entry = fileCache.get(fp);
    if (!entry || entry.size !== size || entry.mtimeMs !== mtimeMs) {
      entry = { size, mtimeMs, agg: await aggregateFile(fp, startMs) };  // re-read only changed files
      fileCache.set(fp, entry);
    }
    const a = entry.agg;
    totals.input += a.input; totals.output += a.output; totals.cacheRead += a.cacheRead; totals.cacheWrite += a.cacheWrite;
    cost += a.cost;
    for (const [t, v] of Object.entries(a.byModel)) {
      const m = byModel[t] || (byModel[t] = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0 });
      m.input += v.input; m.output += v.output; m.cacheRead += v.cacheRead; m.cacheWrite += v.cacheWrite; m.cost += v.cost;
    }
  }

  for (const k of fileCache.keys()) if (!seen.has(k)) fileCache.delete(k); // prune gone files

  return { at: Date.now(), totals, cost, byModel };
}

module.exports = { todayUsage };

if (require.main === module) {
  todayUsage().then((r) => {
    if (!r) { console.log('no data'); return; }
    const k = (n) => n >= 1e6 ? (n / 1e6).toFixed(2) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'k' : '' + n;
    console.log(`today (Claude Code): in ${k(r.totals.input)} · out ${k(r.totals.output)} · cacheR ${k(r.totals.cacheRead)} · cacheW ${k(r.totals.cacheWrite)}`);
    console.log(`API-equivalent cost: $${r.cost.toFixed(2)}`);
    for (const [m, v] of Object.entries(r.byModel)) console.log(`  ${m}: $${v.cost.toFixed(2)}`);
  });
}
