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

- Live **5-hour** and **weekly** usage bars with reset countdowns, semantic color
  coding (amber ≥60%, red ≥85% in every theme), and a **burn-rate hint**
  ("≈ +12%/h", red when you'd hit the limit before the reset)
- **Per-model weekly caps** (e.g. the separate Fable limit) and the **paid
  extra-usage bar** (`$used / $limit`) right under the main bars, when your
  account has them
- **Detailed mode**, organized in two time sections:
  - **Today** — the API value of today's Claude Code usage (what it would cost
    on the API — already included in a subscription, not an extra charge), a
    linear **projection for the day**, and splits **by model** and **by
    project**
  - **Previous 7 days** — total, average per active day, and a **daily
    sparkline** with weekday labels and per-day cost on hover
- Costs honor the billing modifiers recorded in the logs: **Batch** (0.5×),
  **fast mode** and **US-only inference** premiums
- **API-key / Console accounts** (no subscription windows): the widget switches
  to a cost-first layout — today's spend leads, and the pill shows it too
- **37 languages**, auto-detecting your OS language (right-to-left included)
- **3 themes** — *Classic* (light), *Bloodthirsty* (dark, blood-red) and *Zombie*
  (dark, toxic-green) — switch in Settings

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
  `~/.claude/projects/**/*.jsonl` — **recursively**, so subagent and workflow
  transcripts count too (read-only, never touches the network). To keep restarts
  fast it persists an aggregation cache (`jsonl-cache.json`) in the app's own
  data folder — derived numbers only, no transcript content.
  (See [`src/usage-jsonl.js`](src/usage-jsonl.js).)
- Nothing else leaves your machine — no account, no telemetry, no tracking. (The
  packaged app checks GitHub for app updates on launch and every 6h, but **never
  downloads one silently** — you start the download from the in-widget banner or
  the tray menu; the banner can be dismissed per version, and "restart to
  update" asks for a confirming second click. The portable build doesn't even
  check. There is no usage telemetry either way.)

> ⚠️ **Heads up on Anthropic's Terms.** The `/api/oauth/usage` endpoint is
> **internal/undocumented** and may change or be locked to the official client at
> any time. Using your Claude OAuth token in a third-party tool — even read-only —
> is **automated access to Anthropic's services** and is plausibly **against
> Anthropic's Consumer Terms** (their §3.7 restricts automated/scripted access).
> In principle this could cause your Claude account to be rate-limited or flagged.
> This tool minimizes that footprint (read-only, gentle polling, no token minting,
> an honest `count-claudula/x.y.z` User-Agent), and if the endpoint ever starts
> refusing requests the widget **stops polling entirely** instead of hammering it
> (a manual ↻ re-arms it). Still: **you use it at your own risk** — read the Terms
> and decide for yourself.

### Prefer zero endpoint? Use the statusLine source

Settings → **Data source → Claude Code statusLine** switches the 5h/weekly bars
to the data Claude Code itself pipes into its
[statusLine](https://code.claude.com/docs/en/statusline) — a sanctioned channel,
**no credential read, no endpoint call at all**. The widget writes a tiny capture
script and shows you the exact command to set as `statusLine` in Claude Code's
`settings.json`; the script also prints a usable status line (model + 5h/7d %).
Trade-off: the numbers only refresh **while a Claude Code session is running**,
they don't include usage from the web/desktop apps, and this source carries no
paid extra-usage or per-model limit data — which is why the live endpoint
remains the default.

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
