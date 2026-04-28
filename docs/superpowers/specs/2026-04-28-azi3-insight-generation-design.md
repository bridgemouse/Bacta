# AZI-3 Insight Generation — Design Spec

**Date:** 2026-04-28
**Status:** Approved

---

## Overview

Plan 3 builds the AZI-3 insight generation system. AZI-3 is a Claude-powered medical analysis agent that runs nightly on LXC 107, reads 30 days of Garmin data from SQLite plus personal vault context, and writes styled HTML insight cards that the dashboard already serves. The differentiating goal: cards that go materially beyond Garmin Connect's own summaries — real physiological context, population comparisons, trend projections, and personalized commentary grounded in vault knowledge (training goals, timeline, history).

---

## Architecture

The orchestrator runs directly on LXC 107 (not in Docker). `claude -p` uses the Claude Pro subscription authenticated once via `claude auth login`. No Anthropic API key required.

```
LXC 107 host
├── cron: 0 3 * * *   → python3 /opt/bacta/azi3/orchestrator.py --scheduled
├── cron: * * * * *   → python3 /opt/bacta/azi3/check_signal.py
│
└── Docker Compose (unchanged)
    ├── bacta-api     POST /api/azi3/run → writes data/azi3_run_signal
    └── garmin-poller
```

**Scheduled run (3 AM daily):** Uses the previous day's complete settled data — sleep, HRV, recovery, steps. Silent on success. Discord alert on failure.

**Manual trigger:** User taps "Regenerate" button in HomeTab → `POST /api/azi3/run` → API writes `data/azi3_run_signal` → `check_signal.py` (runs every minute) picks it up, runs orchestrator → Discord completion notification sent.

Typical morning workflow: wake up → Garmin sync button → wait ~1 min → AZI-3 Regenerate button → cards refresh with last night's sleep data included.

---

## File Structure

```
azi3/
├── system-prompt.md          # AZI-3 character brief + output quality requirements
├── orchestrator.py           # Main entry point — fetches data, calls claude -p × 4, Discord
├── data_fetcher.py           # SQLite queries, formats 30-day metric history as structured text
├── sections.py               # SECTIONS dict: id → { metrics, prompt_addendum }
├── check_signal.py           # Signal file watcher — atomic delete then run orchestrator
├── mcp-config.json           # vault-query MCP registration for claude -p
└── vault_query_server.py     # Local copy of vault-query MCP server (VAULT_WIKI_ROOT=/mnt/vault/wiki)

server/api/azi3.ts            # New Express route: POST /api/azi3/run
client/src/tabs/HomeTab.tsx   # Add Regenerate button (POST /api/azi3/run) + loading state
client/src/api.ts             # Add triggerAzi3() helper
```

---

## Sections

Four sections, generated in this order each run:

| Section ID | Dashboard card | Metrics (30 days) |
|---|---|---|
| `recovery` | Recovery tab + Home briefing | `hrv`, `hrv_5min_high`, `recovery_score`, `recovery_time_hours`, `stress_score`, `body_battery`, `body_battery_charged`, `resting_hr`, `sleep_duration` |
| `sleep-quality` | Sleep tab | `sleep_duration`, `sleep_score`, `sleep_deep_minutes`, `sleep_rem_minutes`, `sleep_light_minutes`, `sleep_awake_minutes` |
| `training-week` | Training tab | `steps`, `intensity_minutes`, `training_load`, `recovery_time_hours`, `vo2max` + manual inputs (readiness, caffeine, supplements) |
| `vo2-fitness` | Fitness tab | `vo2max`, `resting_hr`, `recovery_score`, `training_load` |

---

## Orchestrator Flow

```python
# orchestrator.py — simplified pseudocode
def run(scheduled: bool):
    data = fetch_all_metrics(days=30)          # data_fetcher.py
    manual = fetch_manual_inputs(days=30)      # data_fetcher.py

    results = {}
    for section in SECTIONS:
        prompt = build_prompt(section, data, manual)
        html = run_claude(prompt)              # with retry logic
        if html:
            write("insights/{section}.html", html)
            results[section] = "ok"
        else:
            results[section] = "failed"

    notify_discord(results, scheduled)
```

**`run_claude(prompt)`:**
- Writes prompt to a temp file, then runs `claude -p --mcp-config azi3/mcp-config.json < prompt_file` via stdin — never passes the prompt as a shell argument (would hit OS arg length limits at multi-thousand tokens)
- On transient failure (non-zero exit, empty output): retry up to 3 times, 30-second delay between attempts
- On usage-limit error (detected via stderr): no retry, raise immediately with specific error tag
- Returns stdout string (the HTML) or None on total failure

---

## Retry and Error Handling

| Failure type | Detection | Action |
|---|---|---|
| Transient (timeout, empty output, exit ≠ 0) | exit code + empty stdout | Retry × 3, 30s delay |
| Usage limit | stderr contains "usage limit" / "rate limit" | No retry, fail immediately |
| Section total failure (all retries exhausted) | None returned | Skip write, keep existing HTML, log error |
| Scheduled run failure | Any section failed | Discord alert with failed section list |
| Manual run | Always | Discord completion notification (success or partial) |

---

## Discord Notifications

**Scheduled run — failure only:**
```
⚕ AZI-3 — Scheduled Run Failed (2026-04-28 03:04)
✅ recovery
✅ sleep-quality
❌ training-week — usage limit hit
✅ vo2-fitness
Runtime: 3m 12s
```

**Manual run — always:**
```
⚕ AZI-3 — Manual Run Complete (2026-04-28 07:43)
✅ recovery
✅ sleep-quality
✅ training-week
✅ vo2-fitness
Runtime: 5m 07s
```

Webhook URL: `DISCORD_WEBHOOK_URL` from `.env` (already in `.env.example`).

---

## System Prompt — `azi3/system-prompt.md`

The system prompt establishes:

**Character:** AZI-3 is a Clone Wars-era Republic medical droid — precise, analytical, dry wit, speaks with authority. Not a wellness app. Thinks like a physician who also happens to have read every sports science paper published since 2010.

**Output quality bar (non-negotiable):**
- **Physiological context** — explain what the metric actually means biologically, not just whether it's "good" or "bad"
- **Personal trend** — compare to the patient's own 30-day baseline, not a generic reference range
- **Population comparison** — use web search to find current norms for age 26, male, recreational runner/athlete
- **Forward projection** — given current trajectory, where does this metric land in 4–8 weeks?
- **Actionable recommendation** — one specific, concrete thing to do differently (or confirmation that current approach is correct)
- If the card could have been generated without knowing anything personal about this patient, it is not good enough. Rewrite it.

**Tools available:**
- `WebSearch` — use for current medical/sports science literature, population norms, research backing recommendations
- `vault-query` MCP — search and read vault pages for personal context (training goals, history, timeline)

**Output format:**
- Complete self-contained HTML fragment (no `<html>`, `<body>`, `<head>` tags)
- Inline styles — no external CSS dependencies
- Full creative freedom on visual design: charts, inline SVG, tables, progress indicators, whatever serves the data best
- Dark palette as a baseline suggestion: `#111827` page bg, `#1f2937` card bg, `#f9fafb` primary text — but AZI-3 may deviate for medical/clinical effect

---

## vault-query MCP Configuration

`azi3/mcp-config.json`:
```json
{
  "mcpServers": {
    "vault-query": {
      "command": "python3",
      "args": ["/opt/bacta/azi3/vault_query_server.py"],
      "env": {
        "VAULT_WIKI_ROOT": "/mnt/vault/wiki"
      }
    }
  }
}
```

`azi3/vault_query_server.py` — verbatim copy of `/mnt/d/ObsidianVault/mcp/vault_query/server.py`. The `VAULT_WIKI_ROOT` env var points it at `/mnt/vault/wiki` (the NFS read-only mount on LXC 107). Requires `mcp>=1.0.0` installed on LXC 107.

---

## API — `server/api/azi3.ts`

```typescript
POST /api/azi3/run
```

Writes the file at `AZI3_SIGNAL_PATH` (new `.env` var, e.g. `./data/azi3_run_signal`). Returns `{ ok: true }` immediately — the actual run is async on the host. The `check_signal.py` cron picks it up within 60 seconds.

---

## Dashboard Changes

**`client/src/api.ts`** — add:
```typescript
export async function triggerAzi3(): Promise<void> {
  await fetch('/api/azi3/run', { method: 'POST' })
}
```

**`client/src/tabs/HomeTab.tsx`** — add Regenerate button next to the existing Sync button in the header. Shows a spinner for 3 seconds after click (the run takes minutes; spinner is feedback that the signal was sent, not that the run is complete).

---

## LXC 107 Setup (one-time, not in this plan's implementation tasks)

1. `claude auth login` — authenticate Claude Pro on LXC 107
2. `pip install mcp` — for vault-query MCP server
3. Add crontab entries (replace `/opt/bacta` with wherever the repo is checked out on LXC 107):
   ```
   0 3 * * * cd /opt/bacta && python3 azi3/orchestrator.py --scheduled >> /var/log/azi3.log 2>&1
   * * * * * cd /opt/bacta && python3 azi3/check_signal.py >> /var/log/azi3.log 2>&1
   ```
4. Verify `/mnt/vault/wiki` is accessible (NFS mount from LXC 106)

These steps are documented here but executed as part of Plan 4 (containerization and deployment), since LXC 107 doesn't exist yet.

---

## Out of Scope for Plan 3

- LXC 107 provisioning (Plan 4)
- Docker deployment (Plan 4)
- Blood work section (waiting on Factor results)
- MacroFactor nutrition section (no account yet)
- AZI-3 medical log / patient summary rolling memory (future enhancement)
