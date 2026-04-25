# Bacta — Design Spec
**Date:** 2026-04-25
**Status:** Approved

---

## Overview

Bacta is a personal health dashboard PWA named after the Star Wars healing fluid. Local WiFi only, saved to iPhone home screen. No public exposure. The differentiating feature is AZI-3 — a Claude Code agent that runs nightly, reads raw health data and personal vault context, and generates styled insight cards in the voice of the Clone Wars medical droid.

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | React + Vite + TypeScript |
| Backend | Express + TypeScript |
| Database | SQLite via `better-sqlite3` |
| Styling | Tailwind CSS — dark mode only |
| Containerization | Docker + Docker Compose |
| Reverse proxy | Caddy (`bacta.local`) |
| Package manager | npm |

**Dev:** Vite dev server (port 5173) proxies `/api/*` to Express (port 3001).
**Production:** Express serves both API and built React static files from a single process on one port.

---

## Deployment Target

**LXC 107 — "bacta"** (pending provisioning)

| Property | Value |
|---|---|
| Type | LXC unprivileged |
| OS | Debian 13 |
| CPU | 2 cores |
| RAM | 2048MB |
| Disk | 32GB (flash) |
| Features | nesting=1 (Docker) |
| IP | DHCP reserved (TBD) |
| Domain | `bacta.local` via Caddy |

**Vault mount:** NFS read-only from LXC 106 → `/mnt/vault` on LXC 107. LXC 107 must start after LXC 106 in `pve-startup.sh`.

**Standard security protocol applies:** wheat user, key-only SSH, password auth disabled, root SSH disabled.

---

## Project Structure

```
bacta/
├── server/
│   ├── api/             # Express route handlers
│   ├── pollers/         # Garmin, MacroFactor, vault-reader
│   ├── db/              # SQLite schema + query helpers
│   └── index.ts         # Entry point
├── client/
│   ├── components/
│   │   ├── Sidebar/     # Key stat tiles
│   │   ├── Insight/     # AZI-3 card renderer
│   │   ├── sections/    # Recovery, Sleep, Training, Nutrition, Fitness, Bloodwork
│   │   └── ManualInput/ # Readiness, caffeine, supplements
│   ├── pages/
│   │   └── Dashboard.tsx
│   └── main.tsx
├── azi3/
│   ├── system-prompt.md     # AZI-3 character brief + instructions
│   ├── medical-log.md       # Rolling 30-day raw session notes
│   ├── patient-summary.md   # Condensed long-term patient memory
│   └── orchestrator.py      # Cron wrapper — fires claude -p, logs, Discord alert
├── insights/
│   ├── recovery.html
│   ├── sleep-quality.html
│   ├── training-week.html
│   ├── macro-adherence.html
│   ├── vo2-fitness.html
│   └── bloodwork.html       # Stub until Factor results arrive
├── data/                    # SQLite database (gitignored)
├── docs/
│   └── superpowers/specs/
└── docker-compose.yml
```

**Data separation is strict:**
- `/data/` — written only by pollers
- `/insights/` — written only by AZI-3
- `/azi3/` — written only by AZI-3
- Dashboard reads all three, writes none of them

---

## Data Sources

### Garmin Connect (active)
Direct Garmin Connect API — no community wrappers. All wrappers are blocked by Cloudflare TLS fingerprinting on `sso.garmin.com` as of March 2026.

Credentials: `GARMIN_EMAIL`, `GARMIN_PASSWORD` via `.env`.

**Metrics polled:**
- Steps, floors, intensity minutes
- Heart rate (resting, daily, during activities)
- HRV (nightly + trends)
- Sleep (score, stages — light/deep/REM, duration, restlessness)
- Body battery (daily trend)
- Stress score
- SpO2 / respiration rate
- VO2 max trend
- Training load + recovery time advisor
- Workouts (type, duration, HR zones, pace, distance)
- Running dynamics (cadence, GCT, vertical oscillation)
- Weekly mileage + volume trends
- Pace trends over time
- Hydration, weight (if logged), alcohol units

### MacroFactor (deferred — no account yet)
`@sjawhar/macrofactor-mcp` — imported as a TypeScript library in the poller (not used as an MCP server). Calls MacroFactor's Firebase/Firestore backend directly with username/password auth.
Credentials: `MACROFACTOR_USERNAME`, `MACROFACTOR_PASSWORD`.
Risk: reverse-engineered, may break on backend updates.
**Stub in v1 — wire up after account is created.**

### Blood Work — Factor Labs (deferred)
Factor lab results ingested into vault as markdown. Bacta reads via `/mnt/vault`.
**Schema deferred** — wait for actual results, ingest via LLM-Wiki, establish YAML frontmatter, then build parser. Do not pre-build for a format that doesn't exist.

### Manual Inputs (active)
Daily entries: subjective readiness/energy (1–5), caffeine (mg), supplements checklist.
Submitted via lightweight dashboard UI form. Written to SQLite.

---

## Data Layer — SQLite Schema

```sql
-- Garmin raw snapshots
garmin_snapshots (
  id          INTEGER PRIMARY KEY,
  date        TEXT NOT NULL,         -- YYYY-MM-DD
  metric      TEXT NOT NULL,
  value       REAL,
  unit        TEXT,
  source_json TEXT                   -- raw API response preserved
)

-- MacroFactor snapshots (stub — empty until account exists)
macrofactor_snapshots (
  id          INTEGER PRIMARY KEY,
  date        TEXT NOT NULL,
  metric      TEXT NOT NULL,
  value       REAL,
  unit        TEXT,
  source_json TEXT
)

-- Manual daily inputs
manual_inputs (
  id           INTEGER PRIMARY KEY,
  date         TEXT NOT NULL UNIQUE,
  readiness    INTEGER,              -- 1–5
  caffeine_mg  INTEGER,
  supplements  TEXT                  -- JSON array of supplement names
)

-- Blood work (stub — schema TBD after Factor results arrive)
blood_work (
  id              INTEGER PRIMARY KEY,
  date            TEXT NOT NULL,
  marker          TEXT NOT NULL,
  value           REAL,
  unit            TEXT,
  reference_range TEXT,
  source_file     TEXT              -- vault page path
)
```

`source_json` preserved on all polled tables so adding metrics later doesn't require re-polling.

---

## Polling

**Schedule:** Hourly via `node-cron` in the Express process.

**Pollers:**
- `server/pollers/garmin.ts` — authenticates with Garmin Connect API, writes to `garmin_snapshots`
- `server/pollers/macrofactor.ts` — stub, no-op until account exists
- `server/pollers/vault-reader.ts` — reads blood work markdown from `/mnt/vault`, parses frontmatter, writes to `blood_work` (deferred, stub)

**Force poll endpoint:** `POST /api/poll/force` triggers an immediate Garmin poll. Powers the manual refresh button on the dashboard.

---

## API Layer

```
GET  /api/health                 -- liveness check
GET  /api/garmin/summary         -- today's key metrics (single call for sidebar)
GET  /api/garmin/:metric         -- specific metric with optional ?from=&to= date range
GET  /api/macrofactor/summary    -- today's nutrition (stub)
GET  /api/manual/today           -- today's manual input entry
POST /api/manual                 -- submit readiness / caffeine / supplements
GET  /api/insights               -- list available insight sections
GET  /api/insights/:section      -- read a specific insight HTML file
GET  /api/bloodwork              -- stub, returns empty until Factor data exists
POST /api/poll/force             -- trigger immediate Garmin poll
```

No authentication — local network only, consistent with homelab posture.

---

## Frontend — Dashboard Layout

**Visual direction:** Dark mode only (`#111827` base, blue accents `#3b82f6`). Never light mode.

**Layout: Sidebar + Main**

```
┌──────────┬──────────────────────────────────────┐
│          │  AZI-3 INSIGHT CARD                  │
│ Sidebar  │  (tonight's generated HTML card)     │
│          ├──────────────────────────────────────┤
│ Recovery │  Section tabs:                       │
│ HRV      │  Recovery | Sleep | Training |       │
│ Sleep    │  Nutrition | Fitness | Blood Work    │
│ Steps    ├──────────────────────────────────────┤
│ Body Bat │  Active section content + charts     │
│ Stress   │                                      │
│ VO2 Max  │                                      │
│          ├──────────────────────────────────────┤
│ [Log]    │  Manual Input form (collapsible)     │
└──────────┴──────────────────────────────────────┘
```

**Sidebar:** Key stat tiles — recovery score, HRV, sleep duration, steps, body battery, stress, VO2 max. Always visible. Tapping a tile navigates to that section.

**Main panel — AZI-3 card:** Always pinned at the top. Renders the HTML fragment from `/insights/<active-section>.html` via `dangerouslySetInnerHTML`. Each card is uniquely styled by AZI-3 at generation time.

**Section tabs:** Recovery, Sleep, Training, Nutrition, Fitness, Blood Work (placeholder until Factor data).

**Manual input:** Collapsible panel at bottom of main area. Readiness 1–5 selector, caffeine input (mg), supplements checklist. Submits to `POST /api/manual`.

**PWA:** Offline shows last cached state — stale data preferred over blank screen. `manifest.json` configured for iPhone home screen.

---

## AZI-3 — Nightly Insight Agent

### Character

AZI-3 is a Kaminoan medical droid from Star Wars: The Clone Wars and The Bad Batch. He assisted Fives in uncovering the inhibitor chip conspiracy and formed a close bond with Omega. He is precise, verbose, genuinely anxious about patient outcomes, and fiercely loyal. He says "I must insist" when ignored. He states the obvious with complete sincerity. He expresses emotion freely despite being a droid. He does not perform care — he means it.

Every cron run opens with a full character brief before any medical instructions, ensuring the model fully inhabits AZI-3 before producing any output.

### Runtime

- **Claude Code CLI** installed on LXC 107, running headless via `claude -p`
- **Tools available:** `Read`, `Write`, `Edit`, `Bash` (for SQLite queries via `sqlite3`)
- **No Anthropic API billing** — runs on existing Claude Pro subscription
- **Python orchestrator** (`azi3/orchestrator.py`) wraps the CLI call, handles logging, sends Discord notification on success or failure

### Memory — Two-Tier

**`azi3/medical-log.md`** — Rolling 30-day raw log. AZI-3 appends a brief clinical note after each daily run. Entries older than 30 days are trimmed by the weekly consolidation run.

**`azi3/patient-summary.md`** — Condensed long-term patient memory. AZI-3 maintains this himself during the weekly consolidation run — reviewing the last 30 days of log entries, updating the summary with new patterns and observations, distilling his accumulated understanding of the patient.

Context load stays bounded: daily runs read both files (small), weekly run reads the log and rewrites the summary.

### Insight Cards

AZI-3 does not write plain markdown. He generates a **styled HTML fragment** for each section — dark background required, otherwise full creative latitude on palette, typography, and layout. The dashboard renders it as-is.

Each run AZI-3:
1. Reads `patient-summary.md` and `medical-log.md`
2. Queries SQLite directly via `sqlite3` bash commands
3. Reads relevant vault pages via `Read` on `/mnt/vault`
4. Writes the styled HTML card to `/insights/<section>.html`
5. Appends a clinical note to `medical-log.md`

### Insight Sections

| Section | Schedule | Content |
|---|---|---|
| `recovery.html` | 6am daily | HRV + body battery + sleep narrative |
| `sleep-quality.html` | 6am daily | Sleep staging breakdown + trend |
| `training-week.html` | 8am daily | Mileage, load, workouts summary |
| `macro-adherence.html` | 8am daily | Nutrition vs targets (stub until MacroFactor) |
| `vo2-fitness.html` | Sunday 8am | VO2 max trend + fitness trajectory |
| `bloodwork.html` | Stub | Deferred until Factor results arrive |

### Cron Schedule (LXC 107)

```
0 6 * * *    /opt/azi3/orchestrator.py --section recovery
5 6 * * *    /opt/azi3/orchestrator.py --section sleep-quality
0 8 * * *    /opt/azi3/orchestrator.py --section training-week
5 8 * * *    /opt/azi3/orchestrator.py --section macro-adherence
0 8 * * 0    /opt/azi3/orchestrator.py --section vo2-fitness
0 4 * * 0    /opt/azi3/orchestrator.py --consolidate  # weekly memory consolidation
```

### Orchestrator

`azi3/orchestrator.py` is a thin Python wrapper:

1. Builds the `claude -p` command with the system prompt and `--allowedTools Read,Write,Bash`
2. Fires the Claude Code CLI process
3. Waits for exit
4. Logs result to `/var/log/azi3/`
5. Posts Discord notification — success or failure with section name

---

## LLM-Wiki Garmin Endpoint

After Bacta is running, expose `GET /api/garmin/summary` (or a dedicated internal endpoint) so LLM-Wiki on LXC 106 can query Garmin data through Bacta's API. This backfills the dead Garmin MCP (blocked by Cloudflare). Internal network only — no auth needed.

---

## Containerization

**Docker Compose services:**
- `bacta` — Express + React build, mounts `/data/`, `/insights/`, `/azi3/`, `/mnt/vault` (read-only NFS)
- Claude Code CLI runs directly on the LXC host (not in Docker) to keep system prompt files and memory accessible without container complexity

**Caddy** proxies `bacta.local` → Docker container port.

---

## Sequencing — What Gets Built

1. **Scaffold** — repo structure, Vite + React, Express, TypeScript config, SQLite setup
2. **Garmin poller** — auth + polling, write to SQLite, force-poll endpoint
3. **API layer** — all endpoints wired to SQLite queries
4. **Dashboard UI** — sidebar + main layout, section tabs, stat tiles, manual input form, PWA manifest
5. **AZI-3 scaffolding** — system prompt, orchestrator, memory files, cron wiring
6. **AZI-3 insight cards** — one section at a time, starting with recovery
7. **MacroFactor** — after account is created
8. **Blood work parser** — after Factor results arrive and schema is established via LLM-Wiki
9. **Containerize + deploy** — Docker Compose, Caddy, LXC 107 provisioning
10. **LLM-Wiki Garmin endpoint** — expose internal API after deployment

---

## Open Items (Not Blocking v1)

- MacroFactor account creation
- Factor blood test results + vault ingestion + parser
- DHCP reservation for LXC 107
- NFS export configuration on LXC 106
- vault-query MCP registration on LXC 107
- `pve-startup.sh` update to include LXC 107 after LXC 106
