# Bacta — Current State & Roadmap

## Feature Inventory (as of Jun 11, 2026)

### Complete and Live

**App shell and navigation:**
- `AppShell.tsx` — fixed iOS viewport shell with global texture overlay
- `TopBar.tsx` — home and section modes; MX-4 ONLINE indicator
- `BottomBar.tsx` — Ask MX-4 button, Overview/Trends toggle, nav circle; always MX-4 cyan
- `BottomSheet.tsx` — All Systems nav sheet with 2-column channel grid
- `AskSheet.tsx` — Ask MX-4 sheet with greeting, suggested prompts, input bar
- `Sheet.tsx` — shared animated bottom-sheet wrapper
- Tab toggle state via `TabContext` — persists Overview/Trends per app session, resets on section change

**Home section:**
- Overview: MX4Briefing + SystemCard 2×2 grid (Recovery/Training live, Sleep live; Nutrition/BloodWork/DailyLog as PendingCards)
- Trends: cross-channel TrendRow week view (Recovery, HRV, Sleep, Training Load, Intensity)
- Live data via `useHomeData` hook

**Recovery section:**
- Overview: gauge (Recovery Score), HRV HeadlineCard, vitals 2×2 (RHR/Stress/SpO2/Respiration), HealthStatusTile for overnight vitals, Sleep Stress card (added Jun 11)
- Trends: 8 TrendRow rows including Sleep Stress and Recovery Time
- Live data via `useRecoveryData` hook

**Sleep section:**
- Overview: Sleep Score gauge, duration display, SleepDepth topographic chart, StageDistribution + StageLegend, SpO2/Respiration tiles
- Trends: duration Bars7, Sleep Score TrendRow, SpO2/Stress trend rows
- Live data via `useSleepData` hook

**Training section (v3 layout):**
- Overview: Training Status banner, VO2max/Fitness Age headline, ACWR/Load band with optimal zone, Intensity bar, ZoneDistribution, Activity log with LogEntry per activity
- Trends: Intensity bars, Training Load, VO2max, ACWR trend rows; Fitness Age annotation with achievable goal target (added Jun 11)
- Live data via `useTrainingData` hook

**Data pipeline:**
- `garmin_poller.py` — nightly 3AM via `bacta-garmin.timer` systemd unit
- `garmin_ingest.py` — historical import script
- All current API endpoints live and tested
- Database current through today (~4,500 snapshots, ~64 activities)
- Body battery metrics renamed from max/min to charged/drained (database migration Jun 11)

**MX-4 system (infrastructure only):**
- `mx4/orchestrator.py` — complete, never run
- `mx4/system-prompt.md` — **rewritten Jun 11, 2026** (replaced AZI-3 fabrication with correct identity)
- `mx4/sections.py` — defined but has stale metric names
- `mx4/data_fetcher.py`, `mx4/db_query_server.py`, `mx4/vault_query_server.py` — complete
- `mx4/check_signal.py` — signal file watcher complete
- `server/api/mx4.ts` — `POST /api/mx4/run` signal endpoint live
- `insights/` — directory exists with `.gitkeep`; no actual insight files

**Tests:**
- 180+ tests passing (last verified Jun 11, 2026)
- Coverage: all page components, all viz components, all hooks (server-mocked), all API routes

### Present but Untested (Never Run)

- **MX-4 orchestrator** — `python3 mx4/orchestrator.py` has never been executed. The full pipeline is implemented but dormant.
- **`POST /api/poll/force`** — poll signal endpoint; counterpart `check_signal.py` has not been verified in production
- **MX-4 cron entries** — neither the orchestrator cron nor the check_signal cron are installed on LXC 109

### Placeholder / Calibrating

- **Nutrition** (`NutritionPage.tsx`) — `SectionShell` with STANDBY state; no data source
- **Blood Work** (`BloodWorkPage.tsx`) — `SectionShell`; `blood_work` table exists but empty
- **Daily Log** (`DailyLogPage.tsx`) — `SectionShell`; `manual_inputs` table exists but empty and no input UI

---

## Immediate Priorities

### 1. MX-4 Orchestrator — First Run

**Why this is first:** The static stub briefing text in `stubData.ts` has been on screen since May 29. Every section shows the same canned assessment from before any real data existed. Running the orchestrator for the first time replaces all of that with data-grounded briefings in MX-4's actual voice. This is the highest-visibility remaining work in the project.

**Blockers before first run:**
1. Fix stale metric names in `mx4/sections.py`:
   - `hrv_5min_high` → doesn't exist in DB (remove or replace with `hrv_baseline_high`)
   - `recovery_time_hours` → stored as `recovery_time_h`
   - `stress_score` → stored as `stress_avg`
   - `body_battery` → split into `body_battery_charged`, `body_battery_drained`, `body_battery_wake`, `body_battery_current`
2. Verify `claude -p` is authenticated on LXC 109
3. Verify `/mnt/vault/wiki` is accessible
4. Resolve format mismatch: orchestrator writes `.html`; `insights.ts` reads `.json`. Decision needed: either change the orchestrator to write JSON with an HTML payload, or change the insights API to serve HTML files directly, or add a conversion step

**Steps:** See `docs/DEVELOPMENT.md` — "Running MX-4 Manually."

**After first run:** Install the cron entries (orchestrator at 4AM, check_signal every minute).

### 2. Body Battery in Recovery Overview

`useRecoveryData` fetches `body_battery_wake` and `body_battery_current` into `rec.battery`, but `RecoveryPage` never renders it. The `HeadlineCard` and `BodyBattery` components are both built and available. Adding a Body Battery card beside the HRV HeadlineCard completes the Recovery Overview's data density.

**Where:** `client/src/pages/RecoveryPage.tsx`  
**What:** Add a `HeadlineCard` using `rec.battery.wake` (PEAK) and `rec.battery.current` (NOW), with a `BodyBattery` component in the card footer.

### 3. LogEntry Phase C — Expand Panel Content

`LogEntry.tsx` has an expand panel that currently renders nothing because `hasContent = false`. The intention was to show training effect (aerobic/anaerobic TE) and HR zones per activity in the expanded view. The activity data already includes `aerobic_te`, `anaerobic_te`, `zone1_s` through `zone5_s` from the API.

**Where:** `client/src/components/viz/LogEntry.tsx`  
**What:** Set `hasContent` based on whether the activity has non-null TE values, and render TE + zone distribution in the expand panel.

---

## Near-Term (Deferred with Clear Path)

### Nutrition Section

**Blocker:** No MacroFactor account. MacroFactor is the likely data source (nutrition tracking app with CSV/API export).  
**Path:** Create MacroFactor account → implement import script → wire to `macrofactor_snapshots` table → build `NutritionPage.tsx` (design session first).  
**DB ready:** `macrofactor_snapshots` table exists.

### Blood Work Section

**Blocker:** Waiting on actual lab results.  
**Path:** Receive PDF lab report → parse markers → import to `blood_work` table → build `BloodWorkPage.tsx`.  
**DB ready:** `blood_work` table exists with `marker`, `value`, `unit`, `reference_range`, `source_file` columns.

### Daily Log Section

**Blocker:** No data source and no input UI.  
**Path:** Define what "daily log" means for this user (caffeine? mood? readiness? supplements?) → build input form (possibly in AskSheet or a dedicated input view) → wire to `manual_inputs` table → build `DailyLogPage.tsx`.  
**DB ready:** `manual_inputs` table has `readiness` (1–5), `caffeine_mg`, `supplements` columns.

### HEARTBEAT.md — Standing Orders File

The standing orders mechanism is documented and referenced in multiple places but the file doesn't exist. Creating it (even empty with format documentation) enables future behavioral adjustments to MX-4 without touching his system prompt.

---

## Sparse / Missing Metrics

| Metric | Current Rows | Issue | Remediation |
|---|---|---|---|
| `vo2max` | 11 | Only updates when a GPS running activity with sufficient exertion is recorded | Keep training consistently; nothing to fix in code |
| `spo2_avg` | 11 | Requires all-day pulse oximetry enabled | Device setting / battery tradeoff decision |
| `sleep_spo2` | 10 | Same device requirement as `spo2_avg` | Same as above |
| `endurance_score` | 0 | Not returned by Garmin for this device/plan level | May not be available; confirm with Garmin API probe |
| `fitness_age_achievable` | 41 | Added Jun 11, 2026 — populated by poller but UI annotation not yet verified | Verify annotation appears in Training Trends after next poller run |
| `recovery_time_h` | 41 | Added Jun 11, 2026 — needs post-poller verification | Check DB after next 3AM run |

---

## Open Questions & Observed Inconsistencies

**insights.ts / orchestrator format mismatch.** `server/api/insights.ts` reads `{section}.json`. The orchestrator writes `{section}.html`. The mock fallback returns JSON with `summary/tone/flags` shape. The frontend does not use the insights API at all currently — it uses stub text from `stubData.ts`. The entire insights delivery pipeline needs design decisions before the orchestrator's output can reach the UI.

**`HEARTBEAT.md` referenced but absent.** Multiple places in docs and CLAUDE.md reference this file. It does not exist. See Roadmap near-term items.

**`sections.py` metric names are stale.** Documented in Immediate Priorities above.


**Spec files reference LXC 107 and Docker.** Early design specs (`docs/superpowers/specs/2026-04-25-bacta-design.md`) targeted LXC 107 with Docker Compose. The actual deployment is LXC 109 with no Docker. The specs are historical documents — do not treat them as authoritative for infrastructure.

---

## Known Technical Debt

**Static stub briefing text.** All four built sections show the same five-week-old stub text from `stubData.ts BRIEFS`. This is the most visible rough edge in the product and resolves entirely when the MX-4 orchestrator runs for the first time.

**`MX4Card` deprecated component.** `client/src/components/MX4Card.tsx` exports `MX4Card` which returns `null`. It's deprecated and left in place to avoid import breakage. Once no imports of `MX4Card` (the deprecated version, not `MX4Briefing`) exist, it can be removed.

**Legacy EAV activity metrics.** `act_duration_s`, `act_distance_m`, `act_calories`, `act_avg_hr` rows exist in `garmin_snapshots` from before the `garmin_activities` table existed. They're no longer written but still queried by nothing. They could be removed from VALID_METRICS and eventually deleted from the DB.

**`mx4/sections.py` section IDs don't match API route section names.** The sections in `sections.py` are `recovery`, `sleep-quality`, `training-week`, `vo2-fitness`. The section names in `insights.ts` VALID_SECTIONS are `home`, `recovery`, `training`, `sleep`, `nutrition`, `bloodwork`, `dailylog`. These naming schemes don't align. A decision is needed about what section IDs the orchestrator should use.
