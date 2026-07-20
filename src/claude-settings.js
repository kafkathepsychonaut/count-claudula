'use strict';
// One-click "configure my statusLine" support. Writes the capture command into
// Claude Code's own settings.json so the user never hand-edits JSON. It's
// ANOTHER app's config, so we treat it with care: back it up, MERGE (never
// clobber other keys), write atomically, and flat-out refuse to touch a file we
// can't parse OR can't read (better to send the user to edit by hand than to
// destroy their settings).

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');
const { settingsPath } = require('./claude-paths'); // honours CLAUDE_CONFIG_DIR — we used to hardcode ~/.claude and write a file Claude Code never read
const { hydrateEnv } = require('./shell-env');

// Does this exe actually run? Confirming with a spawn (not just existsSync)
// keeps a stale symlink or a half-removed install from counting as "node works".
function runsNode(exe) {
  try {
    const r = spawnSync(exe, ['-v'], { timeout: 4000, windowsHide: true });
    return !r.error && r.status === 0;
  } catch (_) { return false; }
}

// Where node actually lives when it isn't on our PATH. Returns absolute paths
// that exist on disk, so the caller spawns at most a handful of processes.
function nodeCandidates() {
  const home = os.homedir();
  const out = [];
  if (process.platform === 'win32') {
    out.push(path.join(process.env.ProgramFiles || 'C:\\Program Files', 'nodejs', 'node.exe'));
    out.push(path.join(process.env.LOCALAPPDATA || path.join(home, 'AppData', 'Local'), 'Programs', 'nodejs', 'node.exe'));
  } else {
    out.push('/opt/homebrew/bin/node', '/usr/local/bin/node', '/usr/bin/node', '/opt/local/bin/node', '/snap/bin/node');
    out.push(path.join(home, '.volta', 'bin', 'node'));
    out.push(path.join(home, '.asdf', 'shims', 'node'));
    out.push(path.join(home, '.local', 'bin', 'node'));
    // Version managers keep one directory per installed version. nvm puts the
    // binary at <ver>/bin/node, fnm at <ver>/installation/bin/node; try both
    // layouts and cap the list so a user with 30 node versions costs us nothing.
    for (const base of [path.join(home, '.nvm', 'versions', 'node'),
                        path.join(home, '.local', 'share', 'fnm', 'node-versions'),
                        path.join(home, 'Library', 'Application Support', 'fnm', 'node-versions')]) {
      let vers;
      try { vers = fs.readdirSync(base); } catch (_) { continue; } // manager not installed
      for (const v of vers.sort().reverse().slice(0, 5)) {
        out.push(path.join(base, v, 'bin', 'node'));
        out.push(path.join(base, v, 'installation', 'bin', 'node'));
      }
    }
  }
  return out.filter((p) => { try { return fs.statSync(p).isFile(); } catch (_) { return false; } });
}

// Is `node` runnable? The statusLine command is `node "script"`, so if node
// doesn't resolve, Claude Code's command silently fails and the widget sits at
// "needs setup" forever — surface it up front instead of leaving them puzzled.
//
// But a false "Node is missing" is worse than no check at all: it tells someone
// whose setup is fine to go reinstall Node, or to give up on the default source.
// And that was the common case, not the rare one — a GUI launch (Finder, Dock,
// .desktop) inherits launchd/systemd's minimal PATH, which has no
// /opt/homebrew/bin, no /usr/local/bin and no nvm dir, while Claude Code runs
// the very same command from a real shell and finds node perfectly. So: adopt
// the login shell's PATH first, then probe the places node actually installs to,
// and only claim it's absent when nothing at all runs.
function nodeAvailable() {
  hydrateEnv(); // memoized; folds the login shell's PATH in on macOS/Linux
  if (runsNode('node')) return true;
  return nodeCandidates().some(runsNode);
}

// Read settings.json, distinguishing "not there yet" from "there but unreadable".
// Only ENOENT is a clean first-time setup. EBUSY/EPERM (a Windows sharing
// violation from AV, a backup agent, or Claude Code rewriting its own settings
// at that instant) and EACCES must never be mistaken for an empty file: that
// mistake is what skipped the .bak backup and then replaced the whole of
// someone's settings.json — permissions, hooks, env, model — with our one key.
// Returns { raw } | { missing: true } | { err: <errno code> }.
function readSettings(p) {
  try { return { raw: fs.readFileSync(p, 'utf8') }; }
  catch (e) {
    if (e && (e.code === 'ENOENT' || e.code === 'ENOTDIR')) return { missing: true };
    return { err: (e && e.code) || 'EIO' };
  }
}

// Look at the current settings.json WITHOUT modifying it. Returns:
//   { path, exists, unreadable, readError, currentCmd, isMine }
// unreadable = the file exists but isn't valid JSON (we must not overwrite it).
// readError = errno code when the file exists and we couldn't read it at all.
// currentCmd = the statusLine command already configured (or null).
// isMine = that command already points at our capture script (nothing to do).
function inspect(wantCmd) {
  const p = settingsPath();
  const out = { path: p, exists: false, unreadable: false, readError: null, currentCmd: null, isMine: false };
  const r = readSettings(p);
  if (r.missing) return out; // no file: a clean first-time setup
  if (r.err) {
    // Returning the first-time-setup shape here would be a lie with teeth: it
    // hides any statusLine the user already has, so the "replace existing?"
    // confirmation never appears and apply() looks safe to run unattended.
    out.exists = true;
    out.readError = r.err;
    return out;
  }
  const raw = r.raw;
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
// Returns { ok: true, created } or
// { ok: false, error: 'unreadable'|'read_failed'|'write_failed' }.
function apply(wantCmd) {
  const p = settingsPath();
  let obj = {};
  let existed = false;
  const r = readSettings(p);
  // A file we couldn't read is a file we must not replace: we have no copy of it
  // to back up and no idea what we'd be throwing away. Bail loudly; a retry once
  // the lock clears costs the user nothing.
  if (r.err) return { ok: false, error: 'read_failed' };
  if (!r.missing) {
    existed = true;
    try { obj = JSON.parse(r.raw); }
    catch (_) { return { ok: false, error: 'unreadable' }; } // never clobber a file we can't parse
    try { fs.writeFileSync(p + '.bak', r.raw); } catch (_) { /* backup is best-effort */ }
  }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) obj = {};
  obj.statusLine = { type: 'command', command: wantCmd };
  const tmp = p + '.' + process.pid + '.tmp';
  try {
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(tmp, JSON.stringify(obj, null, 2) + '\n');
    fs.renameSync(tmp, p); // atomic replace so a concurrent reader never sees half a file
    return { ok: true, created: !existed };
  } catch (_) {
    // A failed rename (EPERM on Windows while AV or the indexer holds the
    // target) otherwise strands a complete settings.json.<pid>.tmp in someone
    // else's config dir, one per attempt. Best-effort sweep, as the capture
    // script does.
    try { fs.unlinkSync(tmp); } catch (_) {}
    return { ok: false, error: 'write_failed' };
  }
}

module.exports = { settingsPath, nodeAvailable, inspect, apply };
