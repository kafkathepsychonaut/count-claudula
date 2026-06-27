# Count Claudula 🧛

A tiny **always-on-top desktop widget** that shows how much of your Claude usage
limits you've burned — your **5-hour window** and your **weekly** limit — without
opening the web app or running `/usage` in Claude Code.

It floats in a corner of your screen; shrink it to a compact pill or tuck it into
the system tray.

## ⬇️ Download

Get the latest from **[Releases ↗](../../releases/latest)**:

- **Windows** — `Count-Claudula-Setup-x.y.z.exe` (installer) or `Count Claudula.exe` (portable, no install)
- **macOS** (Apple Silicon) — `Count-Claudula-x.y.z-arm64.dmg`
- **Linux** — `Count-Claudula-x.y.z.AppImage`

Requires Claude Code installed and logged in. The binaries are unsigned (see
*Why isn't the `.exe` signed?* below). On an Intel Mac, build from source.

## What it shows

- Live **5-hour** and **weekly** usage bars with reset countdowns and color coding
- **Detailed mode**: today's Claude Code tokens (input / output / cache), their
  equivalent **API value** (what that usage would cost on the API — already
  included in your Max plan, not an extra charge), and a per-model split
- **37 languages**, auto-detecting your OS language (right-to-left included)

## How it works (and what it touches)

The number comes from the **same status endpoint that `/usage` reads**:

```
GET https://api.anthropic.com/api/oauth/usage   (Bearer = your Claude Code OAuth token)
```

- **It only reads** your local credential at `~/.claude/.credentials.json` (or
  `$CLAUDE_CONFIG_DIR`) — the same file Claude Code maintains — and makes one
  read-only GET to that endpoint. **It never writes that file and never refreshes
  or mints tokens** (it doesn't impersonate the official client). The token is kept
  fresh by Claude Code itself as you use it, and the widget re-checks the moment that
  file changes; if it goes stale the widget nudges you to *"open Claude Code"*. Only
  Claude Code refreshes this token — Claude Desktop, Cowork and the web app sign in
  separately and won't touch it — so if you go a long stretch using only those, expect
  that nudge until you next run any Claude Code command. (See [`src/usage.js`](src/usage.js).)
- The token-count / cost panel reads Claude Code's local logs in
  `~/.claude/projects/**/*.jsonl` (read-only, never touches the network).
  (See [`src/usage-jsonl.js`](src/usage-jsonl.js).)
- Nothing else leaves your machine — no account, no telemetry, no tracking. (The
  packaged app does check GitHub for app updates on launch and every 6h; the
  portable build does not. There is no usage telemetry either way.)

> ⚠️ **Heads up on Anthropic's Terms.** The `/api/oauth/usage` endpoint is
> **internal/undocumented** and may change or be locked to the official client at
> any time. Using your Claude OAuth token in a third-party tool — even read-only —
> is **automated access to Anthropic's services** and is plausibly **against
> Anthropic's Consumer Terms** (their §3.7 restricts automated/scripted access).
> In principle this could cause your Claude account to be rate-limited or flagged.
> This tool minimizes that footprint (read-only, gentle polling, no token minting),
> but **you use it at your own risk** — read the Terms and decide for yourself.

## 🔍 Don't trust — audit, or build it yourself

This reads a credential file, so don't take a binary's word for it. The source is
right here. Requires **Node 18+** and Git.

```bash
git clone https://github.com/kafkathepsychonaut/count-claudula
cd count-claudula
npm install
npm start            # run the widget from source

npm run dist         # build for your current OS, into dist/
```

`npm run dist` builds for whatever OS you run it on — **Windows** → NSIS installer +
portable `.exe`, **macOS** → `.dmg` / `.zip`, **Linux** → `.AppImage`. Regenerating
the app icon from the source art is a separate `npm run icon` (needs Python +
Pillow); the built icon is already committed, so a normal build doesn't need Python.

`npm run usage` prints the raw 5h / weekly numbers in your terminal, no UI.

## Why isn't the `.exe` signed?

Code-signing certificates cost money and this is a free side project, so the
prebuilt Windows binary is unsigned — SmartScreen warns "unknown publisher" on
first launch (More info → Run anyway). For a tool that reads a credential file,
if that bothers you, **build it from source.**

## Disclaimer

Count Claudula is an independent, unofficial tool. It is **not affiliated with,
endorsed by, or sponsored by Anthropic**. "Claude" and "Claude Code" are
trademarks of Anthropic, PBC, used here only to describe what the tool works with
(nominative use). Use at your own risk.

---

Made by **[Kafka the Psychonaut](https://www.kafkathepsychonaut.io)**. MIT licensed.
