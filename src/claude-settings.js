'use strict';
// One-click "configure my statusLine" support. Writes the capture command into
// Claude Code's own settings.json (~/.claude/settings.json) so the user never
// hand-edits JSON. It's ANOTHER app's config, so we treat it with care: back it
// up, MERGE (never clobber other keys), write atomically, and flat-out refuse to
// touch a file we can't parse (better to send the user to edit by hand than to
// destroy their settings).

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

function settingsPath() {
  return path.join(os.homedir(), '.claude', 'settings.json');
}

// Is `node` runnable from PATH? The statusLine command is `node "script"`, so if
// node doesn't resolve, Claude Code's command silently fails and the widget sits
// at "needs setup" forever — surface it up front instead of leaving them puzzled.
function nodeAvailable() {
  try {
    const r = spawnSync('node', ['-v'], { timeout: 4000, windowsHide: true });
    return !r.error && r.status === 0;
  } catch (_) { return false; }
}

// Look at the current settings.json WITHOUT modifying it. Returns:
//   { path, exists, unreadable, currentCmd, isMine }
// unreadable = the file exists but isn't valid JSON (we must not overwrite it).
// currentCmd = the statusLine command already configured (or null).
// isMine = that command already points at our capture script (nothing to do).
function inspect(wantCmd) {
  const p = settingsPath();
  const out = { path: p, exists: false, unreadable: false, currentCmd: null, isMine: false };
  let raw;
  try { raw = fs.readFileSync(p, 'utf8'); }
  catch (_) { return out; } // no file: a clean first-time setup
  out.exists = true;
  let j;
  try { j = JSON.parse(raw); }
  catch (_) { out.unreadable = true; return out; }
  const sl = j && j.statusLine;
  if (sl && typeof sl === 'object' && typeof sl.command === 'string') {
    out.currentCmd = sl.command;
    out.isMine = sl.command === wantCmd;
  }
  return out;
}

// Merge the statusLine command into settings.json. Backs up the original next to
// it (.bak), writes atomically (temp + rename), and preserves every other key.
// Returns { ok: true, created } or { ok: false, error: 'unreadable'|'write_failed' }.
function apply(wantCmd) {
  const p = settingsPath();
  let obj = {};
  let existed = false;
  try {
    const raw = fs.readFileSync(p, 'utf8');
    existed = true;
    try { obj = JSON.parse(raw); }
    catch (_) { return { ok: false, error: 'unreadable' }; } // never clobber a file we can't parse
    try { fs.writeFileSync(p + '.bak', raw); } catch (_) { /* backup is best-effort */ }
  } catch (_) { /* no file yet: we create one below */ }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) obj = {};
  obj.statusLine = { type: 'command', command: wantCmd };
  try {
    fs.mkdirSync(path.dirname(p), { recursive: true });
    const tmp = p + '.' + process.pid + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(obj, null, 2) + '\n');
    fs.renameSync(tmp, p); // atomic replace so a concurrent reader never sees half a file
    return { ok: true, created: !existed };
  } catch (_) {
    return { ok: false, error: 'write_failed' };
  }
}

module.exports = { settingsPath, nodeAvailable, inspect, apply };
