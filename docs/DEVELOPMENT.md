# Bacta — Development Guide & Standards

## Environment Setup

**Prerequisites:** Node.js 20+, Python 3.13, Git access to `github.com/bridgemouse/bacta`.

```bash
# Clone and install
git clone git@github.com:bridgemouse/bacta.git /opt/bacta
cd /opt/bacta
npm ci

# Garmin authentication (required for data sync)
python3 scripts/garmin_auth.py
# Tokens stored at ~/.garminconnect — re-run if sync fails with auth errors

# Verify database exists (populated by poller or ingest script)
ls -lh data/bacta.db
# Query row counts via the bacta-sqlite MCP: ask Claude to SELECT COUNT(*) FROM garmin_snapshots

# Start dev servers (two terminals)
npm run dev:server   # Express on :3001
npm run dev:client   # Vite on :5173 (proxies /api/* to :3001)
```

---

## Dev Commands

Verified from `package.json`.

| Command | What it does |
|---|---|
| `npm run dev:server` | Express dev server with tsx watch (hot reload) |
| `npm run dev:client` | Vite dev server with HMR |
| `npm test` | All tests (server + client) |
| `npm run test:server` | Vitest server tests only |
| `npm run test:client` | Vitest client tests only |
| `npm run build` | TypeScript compile + Vite bundle → `dist/` |
| `npm start` | Run built production server from `dist/` |
| `npx tsc --noEmit` | Type check client |
| `npx tsc -p tsconfig.server.json --noEmit` | Type check server |

**Historical ingest** (re-populates from scratch, ~35 min):
```bash
python3 scripts/garmin_ingest.py --days 365
```

---

## Coding Standards

### Inline Styles Only

No CSS files in components. No Tailwind utility classes in components. No CSS modules. All component styles are inline React style objects.

`client/index.css` is the one CSS file. It defines global resets and the MX-4 keyframe animations. Components reference keyframe names in `animation` strings — that is the only interaction with this file.

### TypeScript

- Strict mode is on (`tsconfig.json`). No `any` unless genuinely unavoidable.
- Component props are typed with interfaces. Hook return types are inferred from the return value.
- Server types use `better-sqlite3`'s types directly.

### File naming

- PascalCase: React components, TypeScript interfaces (`LogEntry.tsx`, `ActivityLeg`)
- camelCase: hooks, utilities, server files (`useTrainingData.ts`, `garminApi.ts`)
- kebab-case: scripts (`garmin_poller.py`), documentation (`DEVELOPMENT.md`)

### Comments

Only when the WHY is genuinely non-obvious. Never explain what the code does — well-named identifiers do that. Appropriate: a hidden Garmin API constraint, a workaround for a specific bug, a non-obvious ordering requirement. Inappropriate: "fetch activities from API," "return the formatted value."

### Commit strategy

Direct to `main`. No feature branches unless the work is explicitly multi-session. Commits go in after each logical unit of work, not batched at the end. Squashing or amending published commits is not done.

### DB write patterns

- `INSERT OR IGNORE` for `garmin_snapshots` — metrics are immutable once stored; ignore re-inserts
- `INSERT OR REPLACE` for `garmin_activities` — re-syncs should overwrite stale activity data
- Never use raw string interpolation in SQL — use parameterized queries

### Express route ordering

Define specific routes (`/activities`, `/sync/status`, `/weekly-volume`) **before** the `/:metric` wildcard in the same router, or Express will match the wildcard and the specific routes become unreachable. This has caused real bugs.

### Python syntax validation

Before committing any Python script change:
```bash
python3 -c "import py_compile; py_compile.compile('scripts/garmin_poller.py', doraise=True)"
```

### No multi-line terminal paste

Use scripts or temp files. The terminal session does not handle multi-line paste reliably.

### Prefer editing existing files

Do not create new components if an existing one can be extended. Do not create new utility functions if `hexA` or `bactaTexture` already solve the problem.

---

## Adding a New Section

When a new data source becomes available (MacroFactor, Blood Work, Daily Log):

1. **Design first.** Use Claude Design with `design_bacta-handoff-package/` as the visual baseline reference (open `Bacta - Prototype v3.html`). Get a new handoff package before writing code.

2. **Backend — data pipeline:**
   - Add metric extraction to `scripts/garmin_poller.py` (or the relevant poller for the data source)
   - Verify storage with a Python DB query
   - Add new metric names to `VALID_METRICS` in `server/api/garmin.ts`
   - Add any needed Express routes following the existing pattern in `server/api/garmin.ts`

3. **Frontend — hook:**
   - Create `client/src/hooks/use{Section}Data.ts`
   - Fetch from `/api/garmin/summary` and any section-specific endpoints
   - Return typed data in the same shape the section page expects

4. **Frontend — page:**
   - Replace `SectionShell` in `client/src/pages/{Section}Page.tsx` with the real content
   - Use `SECTION_ACCENTS['{section}']` for the accent color
   - Use `MX4Briefing` at the top with the section's `BRIEFS['{section}']` stub (or live insight if available)
   - Wire the Overview/Trends tab via `useContext(TabContext)`

5. **Router:** Section already has a route in `App.tsx` — no change needed.

6. **NavSheet:** Section entry already exists in `BottomSheet.tsx` — update the live value shown in the nav card.

7. **BUILT_SECTIONS:** Add the section key to `BUILT_SECTIONS` in `client/src/theme.ts` so the Overview/Trends toggle appears.

8. **Tests:** Add tests to `tests/client/` for the new page and hook.

---

## Adding a New Visualization Component

1. Create `client/src/components/viz/{ComponentName}.tsx`
2. Accept `accent: string` as a prop — derive all accent-tinted colors with `hexA(accent, alpha)`
3. Use `FONT_MONO` for all numbers and labels, `FONT_UI` for narrative text
4. Export a named function (not default)
5. Add to the component catalog in `docs/DESIGN_SYSTEM.md`

File ownership note: some files in `client/src/components/viz/` are owned by root from initial scaffold. If `Edit` fails with EACCES:
```bash
sudo chown wheat:wheat client/src/components/viz/{ComponentName}.tsx
```

---

## Adding a New Garmin Metric

1. **Find the field:** Query `source_json` from `garmin_snapshots` for a related metric to see the raw API response structure. Use the `bacta-sqlite` MCP — ask Claude: *"Show me the source_json for metric 'hrv', one row."*

2. **Add to poller:** In `scripts/garmin_poller.py`, extract the field in the relevant daily sync section. Follow the existing pattern — see how `recovery_time_h` or `fitness_age_achievable` are extracted.

3. **Validate Python syntax:**
   ```bash
   python3 -c "import py_compile; py_compile.compile('scripts/garmin_poller.py', doraise=True)"
   ```

4. **Add to API whitelist:** In `server/api/garmin.ts`, add the metric name to `VALID_METRICS`.

5. **Add to TypeScript interface:** If the metric is used in a hook, add it to the relevant `GarminSummary` interface in the hook file.

6. **Update `docs/MX4_REFERENCE.md`:** Add a row to the Data Dictionary table with the metric name, display name, meaning, unit, and typical range. This is the authoritative reference MX-4 uses to interpret data — keep it in sync with the poller.

7. **Test with manual sync:** `POST /api/garmin/sync` or run the poller directly.

---

## Server & DB Gotchas

**DB queries:** Use the `bacta-sqlite` MCP — ask Claude to run any SQL directly against `/opt/bacta/data/bacta.db`. The `sqlite3` CLI is not installed on LXC 109 and the Python one-liner wrapper is no longer needed.

**Express wildcard swallowing.** Define specific routes before `/:param` wildcards in the same router. The specific routes `/activities`, `/sync/status`, `/weekly-volume`, `/weekly-intensity`, `/weekly-avg-hr`, `/activities/:id/legs` in `garmin.ts` must appear before `/:metric`. This caused a real bug when a route was added after the wildcard.

**File ownership.** Some files in `client/src/components/viz/` are owned by root. If `Edit` fails with EACCES:
```bash
sudo chown wheat:wheat <file>
```

**Playwright `fullPage` screenshots.** The app shell is `position: fixed; overflow: hidden`. Playwright's `fullPage` option only captures the viewport height, not scrolled content. To screenshot content below the fold:
```javascript
// Set scrollTop on the scrollable content zone
await browser_evaluate('document.querySelector("[style*=\\"overflow-y\\"]").scrollTop = 500')
// Then take screenshot normally (not fullPage)
```

**`garmin_ingest.py` vs `garmin_poller.py` variable names.** The two scripts use different variable names for similar things. `garmin_ingest.py` uses `errors` (not `err`), `SLEEP_PER_CALL` (not `SLEEP_BETWEEN`), and has no `ok.append()`. Match the existing pattern in whichever file you're editing — don't assume they share variable names.

**Ingest CLI flag.** The ingest script uses `--days`, not a positional arg:
```bash
python3 scripts/garmin_ingest.py --days 30
```

**`mx4spin` is a global keyframe.** Do not define it in a component's inline style or try to import it. Reference by name: `animation: 'mx4spin 14s linear infinite'`. It's in `client/index.css`.

**sections.py has stale metric names.** As of Jun 2026, `mx4/sections.py` references metric names that don't match the database: `hrv_5min_high` (doesn't exist), `recovery_time_hours` (stored as `recovery_time_h`), `stress_score` (stored as `stress_avg`), `body_battery` (split into `body_battery_charged/drained/wake/current`). These need to be updated before the orchestrator is run for the first time.

**insights.ts / orchestrator format mismatch.** `server/api/insights.ts` reads `{section}.json` files from `insights/`. The orchestrator writes `{section}.html` files. The frontend currently uses stub text from `stubData.ts` and does not consume the insights API. The format mismatch must be resolved when implementing the orchestrator's first run.

---

## Running MX-4 Manually

MX-4's intelligence is the **live TypeScript pipeline** (`server/lib/ai/orchestrator.ts`).
The Python `mx4/orchestrator.py` / `check_signal.py` path is **deprecated — do not run it.**

**Prerequisites:**
- `ai_api_key` set in Settings (Google / `gemini-2.5-flash` is the v1.0 pin).
- Optional: `vault_enabled=true` + `vault_url` for external-vault context; `research_provider`/`research_api_key` for the web research backend (the scholarly OpenAlex backend needs no key).

**Trigger a full run** (writes briefings to the `mx4_briefings` table):
```bash
curl -s -X POST http://localhost:3001/api/mx4/run        # 202; 409 if one is already running
curl -s -X POST http://localhost:3001/api/mx4/run/recovery   # or one section
```

**Watch progress / verify:**
```bash
journalctl -u bacta-api -f | grep '\[mx4\]'              # "recovery briefing written" ... "orchestrator run complete"
# no sqlite3 CLI on the host — use the bacta-sqlite MCP or node:
node -e "const d=require('better-sqlite3')('data/bacta.db',{readonly:true});console.log(d.prepare('SELECT section,generated_at FROM mx4_briefings').all())"
```

**Nightly schedule:** in-process via node-cron (`server/lib/ai/scheduler.ts`) when
`mx4_nightly_enabled=true` at `mx4_nightly_time` (server-local/UTC). No crontab entry needed.
The Garmin poller is the separate `bacta-garmin.timer` at 03:00.

---

## TypeScript Config Quick Reference

| Config | Purpose |
|---|---|
| `tsconfig.json` | Client TypeScript (Vite) |
| `tsconfig.server.json` | Server TypeScript (tsx/node) |

Both use strict mode. The server config excludes the `client/` directory and vice versa.
