'use strict';
// READ-ONLY. Reads the OAuth credential Claude Code already maintains in
// ~/.claude/.credentials.json and queries the same status endpoint that /usage
// uses. NEVER writes the file and NEVER refreshes/mints a token (doesn't
// impersonate the official client). If the token is stale it signals that — Claude
// Code refreshes it as you use it. `node src/usage.js` runs a smoke test in the terminal.

const fs = require('fs');
const os = require('os');
const path = require('path');

const USAGE_URL = 'https://api.anthropic.com/api/oauth/usage';
const OAUTH_HEADERS = {
  'anthropic-beta': 'oauth-2025-04-20',
  'anthropic-version': '2023-06-01',
  'user-agent': 'claude-count/1.0 (status-monitor)',
};
const EXPIRY_SKEW_MS = 90 * 1000;

function credPath() {
  const base = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
  return path.join(base, '.credentials.json');
}

function readToken() {
  const raw = fs.readFileSync(credPath(), 'utf8');
  const o = JSON.parse(raw).claudeAiOauth;
  if (!o || !o.accessToken) {
    throw new Error('credencial OAuth do Claude nao encontrada (claudeAiOauth ausente)');
  }
  const expired = !(o.expiresAt && o.expiresAt - Date.now() > EXPIRY_SKEW_MS);
  return { token: o.accessToken, expired };
}

function expiredError() {
  const e = new Error('token expired'); e.expired = true; return e;
}

function normalizeWindow(w) {
  if (!w || typeof w.utilization !== 'number') return null;
  return { utilization: Math.round(w.utilization), resetsAt: w.resets_at || null };
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
  const { token, expired } = readToken();
  if (expired) throw expiredError(); // we don't refresh; Claude Code refreshes it when used

  // Don't hang forever if the connection stalls — abort after 20s so the poller
  // can schedule the next attempt instead of getting stuck on a dead await.
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000);
  let res;
  try {
    res = await fetch(USAGE_URL, {
      headers: { authorization: 'Bearer ' + token, ...OAUTH_HEADERS },
      signal: ctrl.signal,
    });
  } finally {
    clearTimeout(timer);
  }

  if (res.status === 401) throw expiredError();
  if (res.status === 429 || res.status === 529) {
    const e = new Error('rate limited (' + res.status + ')');
    e.rateLimited = true;
    e.retryAfter = parseInt(res.headers.get('retry-after'), 10) || 0;
    throw e;
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error('usage endpoint ' + res.status + ': ' + body.slice(0, 200));
  }

  const d = await res.json();
  return {
    fetchedAt: Date.now(),
    fiveHour: normalizeWindow(d.five_hour),
    sevenDay: normalizeWindow(d.seven_day),
    sevenDayOpus: normalizeWindow(d.seven_day_opus),
    sevenDaySonnet: normalizeWindow(d.seven_day_sonnet),
    overage: normalizeOverage(d),
  };
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
