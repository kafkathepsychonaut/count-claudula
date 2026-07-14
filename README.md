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
  ("≈ +12%/h" while you're burning, "≈ +0%/h" when steady, red when you'd hit
  the limit before the reset)
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

The widget has **two data sources**. New installs default to the **Claude Code
statusLine** source — fully local, no endpoint, nothing Anthropic hasn't
sanctioned (described [below](#the-default-source-claude-code-statusline)). The
other source is **opt-in** and reads the number from the **same status endpoint
that `/usage` reads**:

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
  packaged app checks GitHub for app updates on launch and every 6h — or when you
  ask it to via **Settings → Check for updates** or the tray — but it **never
  downloads one silently**: you start the download from the in-widget banner or
  the tray menu; the banner can be dismissed per version, and "restart to
  update" asks for a confirming second click. The portable build doesn't even
  check. There is no usage telemetry either way.)

> ⚠️ **Heads up on Anthropic's Terms — read this.** The **opt-in endpoint
> source** (no longer the default — see below) uses your Claude Code OAuth token
> to call `/api/oauth/usage`, an **internal/undocumented** endpoint. As of a **February 2026 clarification**,
> Anthropic has **explicitly stated** that using an OAuth token from a Claude
> Free/Pro/Max subscription *"in any other product, tool, or service … is not
> permitted and constitutes a violation of the Consumer Terms of Service"* — and
> their Consumer Terms (§3, *Use of our Services*) separately bar accessing the
> Services *"through automated or non-human means, whether through a bot, script,
> or otherwise"* except via an Anthropic API key. **Anthropic has been actively
> enforcing this since January 2026, including account bans.** So this is not a
> gray "plausibly" anymore: using this source **is** against the Consumer Terms.
>
> That enforcement targets **arbitrage** — running actual Claude *inference*
> through unofficial harnesses to pay subscription prices for API-grade usage —
> which this tool does **not** do: it makes no inference, mints/refreshes no
> tokens, only issues one read-only GET for a status number, polls gently, sends
> an honest `count-claudula/x.y.z` User-Agent, and **stops polling entirely** if
> the endpoint ever refuses (a manual ↻ re-arms it). That keeps it far from the
> traffic pattern that triggers bans — but the written rule has **no read-only or
> usage-monitor carve-out**, and the risk is to **your** account. **Use this
> source at your own risk.**
>
> **Want zero Terms risk?** You already have it by default: the **Claude Code
> statusLine** source (Settings → Data source, described just below) does no token
> read and no endpoint call. Reaching the endpoint source above is an explicit
> opt-in; it buys always-fresh-when-idle updates and the per-model / paid-overage
> bars, at the risk spelled out here.

### The default source: Claude Code statusLine

New installs use the data Claude Code itself pipes into its
[statusLine](https://code.claude.com/docs/en/statusline) — a sanctioned channel,
**no credential read, no endpoint call at all**. On first run the widget writes a
tiny capture script and shows you (Settings → **Data source**) the exact command
to set as `statusLine` in Claude Code's `settings.json` — a **one-time setup**;
until you do it the widget shows a *"set up statusLine"* nudge. **Configure
automatically** writes it into `settings.json` for you (it backs the file up,
merges rather than overwrites, asks before replacing an existing statusLine, and
warns if `node` isn't on your PATH). The script also
prints a usable status line (model + 5h/7d %). Every open Claude Code window
writes its own capture file and the widget **aggregates them** (highest reading
in the current window wins), so running 20 sessions at once keeps the numbers
fresh instead of flickering — it never dips below the truth. Trade-off: the
numbers only refresh **while a Claude Code session is generating** (idle sessions
don't update, so the "updated HH:MM" line grows a `· 14m` age once it starts
trailing), they don't include usage from the web/desktop apps, and this source
carries no paid extra-usage or per-model
limit data — those surfaces show as **N/A** in the detailed view (so you can tell
"none" apart from "this source can't see it") — to get real numbers there, switch
to the **endpoint** source (opt-in, with the Terms caveat above).

**Upgrading from an earlier version?** If you were already on the endpoint, the
widget keeps you there so your data source doesn't change under you — the new
statusLine default only applies to fresh installs. Switch either way, any time,
in Settings → Data source.

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
