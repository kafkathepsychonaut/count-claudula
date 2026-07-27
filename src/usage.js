'use strict';
// READ-ONLY. Reads the OAuth credential Claude Code already maintains — the
// .credentials.json file, or on macOS the login Keychain — and queries the same
// status endpoint that /usage uses. NEVER writes either store and NEVER
// refreshes/mints a token (doesn't impersonate the official client). If the token
// is stale it signals that — Claude Code refreshes it as you use it.
// `node src/usage.js` runs a smoke test in the terminal.

const fs = require('fs');
const { execFile } = require('child_process');
// Locating Claude Code's config dir is shared, not ours to re-derive: deriving it
// here missed CLAUDE_CONFIG_DIR on a GUI launch (Dock/Start Menu/login item never
// inherit a shell profile's exports), so we read ~/.claude while Claude Code
// refreshed its token in the relocated dir — a subscriber told to "open Claude
// Code" forever, with the credential watcher watching the wrong directory too.
const { credPath } = require('./claude-paths');

const USAGE_URL = 'https://api.anthropic.com/api/oauth/usage';
// Honest self-identification, version kept in lockstep with package.json
// (works both inside Electron and via `node src/usage.js`).
const VERSION = require('../package.json').version;
const OAUTH_HEADERS = {
  'anthropic-beta': 'oauth-2025-04-20',
  'anthropic-version': '2023-06-01',
  'user-agent': 'count-claudula/' + VERSION + ' (status-monitor)',
};
const EXPIRY_SKEW_MS = 90 * 1000;

// macOS keeps the credential in the login Keychain as a generic-password item
// under this service name (see readKeychain).
const KEYCHAIN_SERVICE = 'Claude Code-credentials';
// Deliberately generous: this call can sit waiting on a human to answer the
// Keychain access dialog. It only bounds the pathological case — a prompt left
// on screen forever must not wedge the poller.
const KEYCHAIN_TIMEOUT_MS = 60 * 1000;
// After a denied/unreadable Keychain read, stop asking for a while. The poller
// retries every 90s and re-raising a system auth dialog that often is hostile.
const KEYCHAIN_RETRY_MS = 10 * 60 * 1000;
// Floor on how long a successful Keychain read is held. Covers a credential with
// no usable expiry and a torn read, so neither can put us back to shelling out
// (and possibly prompting) on every single poll.
const KEYCHAIN_MIN_TTL_MS = 5 * 60 * 1000;

function readCredFile() {
  try { return fs.readFileSync(credPath(), 'utf8'); }
  catch (_) { return null; } // absent is normal on macOS, where the Keychain holds it
}

// macOS: Claude Code stores the OAuth credential in the login Keychain and does
// NOT keep .credentials.json current (installs predating that migration leave a
// stale copy behind). Without this fallback the endpoint source is permanently
// dead on every Mac — it reports "no credential file", or loops on an expired
// one, and the UI answers "open Claude Code", a remedy that can never work.
//
// Read-only like the rest of this module: `find-generic-password -w` prints the
// secret and touches nothing. Async on purpose — this may put a Keychain access
// dialog on screen, and a sync spawn would freeze the whole widget behind it.
// A SUCCESSFUL read has to be cached too, not just a blocked one. `-w` decrypts
// the secret, so if Claude Code created the item outside `security` the ACL
// doesn't trust that binary and macOS raises the access dialog — and clicking
// "Allow" (rather than "Always Allow") leaves the ACL untouched. Re-shelling on
// every poll would then put a system auth dialog on screen every 3 minutes for
// the life of the app. Hold the credential until it's near expiry instead; it
// only turns over every few hours anyway.
let kcBlockedUntil = 0;
let kcCache = null; // { raw, until }
function readKeychain() {
  return new Promise((resolve) => {
    if (kcCache && Date.now() < kcCache.until) { resolve({ raw: kcCache.raw }); return; }
    if (Date.now() < kcBlockedUntil) { resolve({ blocked: true }); return; }
    execFile(
      'security', ['find-generic-password', '-s', KEYCHAIN_SERVICE, '-w'],
      { timeout: KEYCHAIN_TIMEOUT_MS },
      (err, stdout, stderr) => {
        if (!err) {
          const raw = String(stdout).trim();
          // Cache only until just before the token itself lapses, so a refreshed
          // credential is picked up promptly. An unparseable payload gets a short
          // floor so a torn read can't pin us to a bad value.
          const item = parseCredential(raw);
          const ttl = (item && item.token && item.expiresAt)
            ? Math.max(0, item.expiresAt - EXPIRY_SKEW_MS - Date.now())
            : KEYCHAIN_MIN_TTL_MS;
          kcCache = { raw, until: Date.now() + Math.max(KEYCHAIN_MIN_TTL_MS, ttl) };
          resolve({ raw });
          return;
        }
        // "could not be found" is a real answer — there is no credential, so the
        // usual "log in to Claude Code" guidance applies. Everything else (user
        // hit Deny, prompt timed out and we killed it, `security` unusable)
        // means we simply don't know, and must not be reported as a missing login.
        if (/could not be found/i.test(String(stderr || err.message || ''))) {
          resolve({ absent: true }); return;
        }
        kcBlockedUntil = Date.now() + KEYCHAIN_RETRY_MS;
        resolve({ blocked: true });
      },
    );
  });
}

// Both stores hold the same JSON shape. Returns null when there's nothing usable
// (store absent, torn or invalid JSON), {apiKeyAccount} when the store is valid
// but carries no subscription OAuth, else {token, expired}.
//
// Unparseable JSON reads as "nothing here", NOT as an API-key account: it's
// almost always a torn read of a file Claude Code is mid-write on, and a
// subscriber must not flip to the permanent cost-only layout over one bad read.
function parseCredential(raw) {
  if (!raw) return null;
  let o = null;
  try { o = JSON.parse(raw); } catch (_) { return null; }
  if (!o || typeof o !== 'object') return null;
  const c = o.claudeAiOauth;
  if (!c || !c.accessToken) return { apiKeyAccount: true };
  return {
    token: c.accessToken,
    expiresAt: typeof c.expiresAt === 'number' ? c.expiresAt : 0,
    expired: !(c.expiresAt && c.expiresAt - Date.now() > EXPIRY_SKEW_MS),
  };
}

function noCredentialError() {
  // A valid store holding no subscription OAuth — an API-key / Console account.
  // Those have no 5h/weekly windows AT ALL, so this is a steady state, not an
  // outage: the UI says so and the token panel keeps working.
  const e = new Error('no subscription credential (API key / Console account)');
  e.noCredential = true;
  return e;
}

async function readToken() {
  const file = parseCredential(readCredFile());
  // Fast path, and on Windows/Linux the only path: a live token on disk. Note
  // this keeps the Keychain (and its prompt) entirely out of the picture unless
  // the file can't answer — and fetchUsage only runs at all for the opt-in
  // endpoint source, so default installs never trigger a Keychain dialog.
  if (file && file.token && !file.expired) return file;

  if (process.platform === 'darwin') {
    // The Keychain is the store Claude Code actually maintains, so it outranks
    // whatever the file says — including an expired pre-migration copy, which is
    // exactly what kept macOS looping on "expired"/401 forever.
    const kc = await readKeychain();
    const item = parseCredential(kc.raw);
    if (item && item.token) return item;
    if (kc.blocked) {
      // Denied, unanswered, or `security` unusable: we genuinely don't know
      // whether a credential exists, so we must NOT claim there's none — that
      // renders as "open Claude Code", sending the user after a fix that cannot
      // work. Carrying no .expired/.noCredential flag leaves the widget in its
      // honest can't-read-it state instead.
      throw new Error('keychain read blocked (access denied or unavailable)');
    }
    if (item && item.apiKeyAccount) throw noCredentialError();
    // kc.absent: no Keychain item at all. Fall through — the file's verdict, or
    // "never logged in", is the truth. Once the user does log in, the item
    // appears and the next poll finds it.
  }

  if (file && file.token) return file; // expired: fetchUsage signals it, we never refresh
  if (file && file.apiKeyAccount) throw noCredentialError();
  // Nothing in any store (Claude Code not installed / never logged in): "open
  // Claude Code" is the fix, same as an expired token. The dir watcher re-polls
  // the instant the file appears.
  const e = new Error('no credential file'); e.expired = true; throw e;
}

// `status` is only set when the SERVER rejected us (e.g. 401) — a locally
// detected expiry never touched the network, and the poller's circuit breaker
// must only count real server rejections.
function expiredError(status) {
  const e = new Error('token expired'); e.expired = true;
  if (status) e.status = status;
  return e;
}

function normalizeWindow(w) {
  if (!w || typeof w.utilization !== 'number') return null;
  return { utilization: Math.round(w.utilization), resetsAt: w.resets_at || null };
}

// Scoped/extra limits beyond the two headline bars. The endpoint's `limits`
// array carries one entry per active limit — including per-model weekly caps
// (e.g. a "Fable" weekly limit) that exist nowhere else in the response.
function normalizeLimits(d) {
  if (!Array.isArray(d.limits)) return [];
  const out = [];
  for (const l of d.limits) {
    if (!l || typeof l.percent !== 'number') continue;
    out.push({
      kind: String(l.kind || ''),
      group: String(l.group || ''),
      percent: Math.round(l.percent),
      severity: String(l.severity || 'normal'),
      resetsAt: l.resets_at || null,
      // per-model caps carry the model's display name; others have no scope
      label: (l.scope && l.scope.model && l.scope.model.display_name) ? String(l.scope.model.display_name) : null,
    });
  }
  return out;
}

// Paid overage (billed for usage beyond the plan). Comes in spend + extra_usage.
function normalizeOverage(d) {
  const s = d.spend || {};
  const e = d.extra_usage || {};
  if (!(s.enabled || e.is_enabled)) return { enabled: false };
  const expo = (s.used && s.used.exponent != null) ? s.used.exponent : 2;
  const div = Math.pow(10, expo);
  return {
    enabled: true,
    used: s.used ? (s.used.amount_minor || 0) / div : 0,
    limit: s.limit ? (s.limit.amount_minor || 0) / div : 0,
    percent: Math.round(s.percent != null ? s.percent : (e.utilization || 0)),
    severity: s.severity || 'normal',
    currency: (s.used && s.used.currency) || (s.limit && s.limit.currency) || e.currency || 'USD',
  };
}

async function fetchUsage() {
  const { token, expired } = await readToken();
  if (expired) throw expiredError(); // we don't refresh; Claude Code refreshes it when used

  // Don't hang forever if the connection stalls — abort after 20s so the poller
  // can schedule the next attempt instead of getting stuck on a dead await.
  // Keep the abort timer armed until the body is fully read and normalized —
  // clearing it once headers arrived left res.json()/res.text() with no timeout,
  // so a server that sent headers then stalled the body hung the single-flight
  // poller forever. The finally covers every await below.
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000);
  try {
    const res = await fetch(USAGE_URL, {
      headers: { authorization: 'Bearer ' + token, ...OAUTH_HEADERS },
      signal: ctrl.signal,
    });

    if (res.status === 401) throw expiredError(401);
    if (res.status === 429 || res.status === 529) {
      const e = new Error('rate limited (' + res.status + ')');
      e.rateLimited = true;
      e.status = res.status;
      e.retryAfter = parseInt(res.headers.get('retry-after'), 10) || 0;
      throw e;
    }
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      const e = new Error('usage endpoint ' + res.status + ': ' + body.slice(0, 200));
      e.status = res.status;
      throw e;
    }

    const d = await res.json();
    return {
      fetchedAt: Date.now(),
      fiveHour: normalizeWindow(d.five_hour),
      sevenDay: normalizeWindow(d.seven_day),
      sevenDayOpus: normalizeWindow(d.seven_day_opus),
      sevenDaySonnet: normalizeWindow(d.seven_day_sonnet),
      limits: normalizeLimits(d),
      overage: normalizeOverage(d),
    };
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { fetchUsage, credPath };

if (require.main === module) {
  fetchUsage()
    .then((u) => {
      const f = (w, label) => w ? `${label}: ${w.utilization}%  (reset ${w.resetsAt})` : `${label}: --`;
      console.log(f(u.fiveHour, '5h '));
      console.log(f(u.sevenDay, '7d '));
    })
    .catch((e) => { console.error('ERRO:', e.message); process.exit(1); });
}
