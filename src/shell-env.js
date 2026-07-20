'use strict';
// A GUI-launched app doesn't inherit the user's shell environment. On macOS
// (Finder/Dock/login item) and Linux (.desktop launcher) the process gets
// launchd/systemd's minimal environment: PATH is /usr/bin:/bin:/usr/sbin:/sbin
// and anything exported from ~/.zshrc, ~/.bashrc or ~/.profile is simply absent.
//
// That breaks us in two places, both of which used to look like user error:
//   * CLAUDE_CONFIG_DIR — Claude Code relocates its whole config dir when this
//     is set. Exported in a shell profile it's invisible to us, so we'd read
//     ~/.claude, find nothing (or pre-migration leftovers), and present that as
//     the truth while Claude Code wrote elsewhere.
//   * PATH — node lives in /opt/homebrew/bin, /usr/local/bin or an nvm dir for
//     virtually every mac dev. Without it `node -v` fails and we'd tell a user
//     with a perfectly good install that Node is missing.
//
// Fix: ask the user's login shell for its environment, once, and fold the parts
// we care about into process.env. Windows GUI apps DO inherit user env vars from
// the registry, so this is a no-op there.

const { spawnSync } = require('child_process');

// Only these are adopted. A wholesale process.env overwrite would be a much
// bigger blast radius than the two problems we're solving.
const ADOPT = ['CLAUDE_CONFIG_DIR', 'PATH'];
const DELIM = '__CC_ENV__';

let done = false;

// Idempotent and synchronous. Costs one shell spawn (~100-300ms) the first time
// on macOS/Linux and nothing afterwards; callers may invoke it freely.
function hydrateEnv() {
  if (done) return;
  done = true;
  if (process.platform === 'win32') return;

  const shell = process.env.SHELL || '/bin/sh';
  let out;
  try {
    // -l so profile files are read (that's where the exports live); -c to run
    // and exit. The delimiters let us skip any banner/motd the profile prints.
    const r = spawnSync(shell, ['-lc', `echo ${DELIM}; env; echo ${DELIM}`], {
      timeout: 5000, encoding: 'utf8', windowsHide: true,
    });
    if (r.error || r.status !== 0 || !r.stdout) return;
    out = r.stdout;
  } catch (_) { return; } // a broken login shell must not stop the app booting

  const start = out.indexOf(DELIM);
  const end = out.lastIndexOf(DELIM);
  if (start === -1 || end <= start) return;
  const body = out.slice(start + DELIM.length, end);

  for (const line of body.split('\n')) {
    const eq = line.indexOf('=');
    if (eq <= 0) continue; // blank line, or a multi-line value's continuation
    const key = line.slice(0, eq);
    if (!ADOPT.includes(key)) continue;
    const val = line.slice(eq + 1);
    if (!val) continue;
    // The inherited value wins when we already have one: an env var set
    // explicitly for this process is a deliberate override, and the login
    // shell's copy must not clobber it.
    if (key === 'PATH') {
      // PATH is the exception — merge rather than pick. Electron puts its own
      // entries here that the login shell has never heard of.
      const seen = new Set();
      const merged = [];
      for (const p of (process.env.PATH || '').split(':').concat(val.split(':'))) {
        if (p && !seen.has(p)) { seen.add(p); merged.push(p); }
      }
      process.env.PATH = merged.join(':');
    } else if (!process.env[key]) {
      process.env[key] = val;
    }
  }
}

module.exports = { hydrateEnv };
