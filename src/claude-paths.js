'use strict';
// Single source of truth for where Claude Code keeps its files. Three modules
// used to each derive this themselves and they didn't agree: usage.js and
// usage-jsonl.js honoured CLAUDE_CONFIG_DIR, claude-settings.js hardcoded
// ~/.claude — so one-click statusLine setup could write a settings.json that
// Claude Code never reads, and report success doing it.
//
// Resolution order:
//   1. CLAUDE_CONFIG_DIR from our own environment
//   2. CLAUDE_CONFIG_DIR recovered from the user's login shell (see shell-env.js —
//      a GUI launch doesn't inherit shell exports)
//   3. ~/.claude
// Steps 1 and 2 are the same lookup: hydrateEnv() folds the shell's value into
// process.env, so everything downstream reads one variable.

const os = require('os');
const path = require('path');
const { hydrateEnv } = require('./shell-env');

function configDir() {
  hydrateEnv(); // memoized; a no-op on Windows and after the first call
  return process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
}

function credPath()     { return path.join(configDir(), '.credentials.json'); }
function projectsDir()  { return path.join(configDir(), 'projects'); }
function settingsPath() { return path.join(configDir(), 'settings.json'); }

// True when the config dir came from CLAUDE_CONFIG_DIR rather than the default.
// Useful for diagnostics ("we're reading somewhere unusual") without making
// every caller re-derive the comparison.
function isRelocated() {
  return configDir() !== path.join(os.homedir(), '.claude');
}

module.exports = { configDir, credPath, projectsDir, settingsPath, isRelocated };
