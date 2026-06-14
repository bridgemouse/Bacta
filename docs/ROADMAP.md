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
- Overview: Training Status banner, VO2max/Fitness Age headline, Load Ratio card with range slider (optimal band 0.8–1.3, position dot), Intensity bar, ZoneDistribution, Activity log with LogEntry per activity
- LogEntry expand panel: Training Effect bars, HR zone distribution, Running Dynamics grid (Cadence/Stride/Vert Osc/GCT) — all four dynamics tiles have tappable info overlays (added Jun 12)
- Trends: Intensity bars, Training Load, VO2max, ACWR trend rows; Fitness Age annotation with achievable goal target (added Jun 11)
- Bars7 day labels computed dynamically from today — last bar always shows current day (fixed Jun 12)
- Live data via `useTrainingData` hook

**Data pipeline:**
- `garmin_poller.py` — nightly 3AM via `bacta-garmin.timer` systemd unit
- `garmin_ingest.py` — historical import script
- All current API endpoints live and tested
- Database current through today (~4,500 snapshots, ~64 activities)
- Body battery metrics renamed from max/min to charged/drained (database migration Jun 11)

**MX-4 system — Phase 1 complete (Jun 14, 2026):**
- `app_settings`, `mx4_briefings`, `mx4_chat_messages` DB tables — schema + auto-migration via `initSettings()`
- `server/lib/settings.ts` — pure DB helpers (`getSetting`/`setSetting`/`initSettings`) with 7 defaults (google, gemini-2.5-flash, 04:00, etc.)
- `server/api/settings.ts` — `GET /api/settings` (API key masked), `PUT /api/settings/:key`, `POST /api/settings/test-connection`
- `server/lib/ai/provider.ts` — Vercel AI SDK wrapper, reads settings at call time, supports google/anthropic/openai
- `server/lib/ai/tools.ts` — 6 MX-4 tools: `queryDb`, `readVault`, `readAllWikiPages`, `writeWikiPage`, `listWikiPages`, `archiveWikiPage`
- `SettingsPage.tsx` — 3-rail settings UI (AI PROVIDER, MX-4 INTELLIGENCE, GARMIN placeholder); accessible from NavSheet under SYSTEM divider
- `mx4/system-prompt.md` — rewritten Jun 11, 2026 (replaced AZI-3 fabrication with correct identity)
- `server/api/mx4.ts` — `POST /api/mx4/run` signal endpoint live
- `insights/` — directory exists with `.gitkeep`; no actual insight files
- **Superseded:** `mx4/orchestrator.py` (Python/`claude -p` approach) replaced by TypeScript/Vercel AI SDK pipeline

**Tests:**
- 213 tests passing (55 server + 158 client, last verified Jun 14, 2026)
- Coverage: all page components, all viz components, all hooks (server-mocked), all API routes, settings CRUD, AI provider, all 6 MX-4 tools

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

### 1. MX-4 Phase 2 — Orchestrator + Wiki + Briefing Delivery

**Why this is next:** Phase 1 built the AI provider layer and settings. Phase 2 wires it all together into a working nightly briefing pipeline — replacing the static stub text with live, data-grounded MX-4 voice across all sections.

**What Phase 2 builds:**
- `mx4/wiki/` — initial wiki pages: `ethan-profile.md`, `hrv-patterns.md`, `sleep-patterns.md`, `training-patterns.md`, `weekly-observations.md`, `correlations.md`, `SCHEMA.md`
- `server/lib/ai/sections.ts` — metric definitions per section (port from `mx4/sections.py` with corrected metric names)
- `server/lib/ai/orchestrator.ts` — two-step: `generateText` with tools → `generateObject` for structured briefing JSON; writes to `mx4_briefings` table
- `server/lib/ai/wrap.ts` — post-session wiki maintenance (list pages → archive + rewrite if over token limit)
- `server/lib/ai/wiki.ts` — wiki utilities (read all, write page, list with sizes)
- `mx4/HEARTBEAT.md` — standing orders file (create now even if minimal)
- `node-cron` scheduler in `server/index.ts` — nightly at configured time + stale-detection on sync
- `GET /api/insights/:section` — serve briefings from `mx4_briefings` table
- Section pages wired to briefing API (replace stub text with live `MX4Briefing` data)

**Spec:** `docs/superpowers/specs/2026-06-14-mx4-intelligence-design.md`

### 2. Body Battery in Recovery Overview

`useRecoveryData` fetches `body_battery_wake` and `body_battery_current` into `rec.battery`, but `RecoveryPage` never renders it. The `HeadlineCard` and `BodyBattery` components are both built and available. Adding a Body Battery card beside the HRV HeadlineCard completes the Recovery Overview's data density.

**Where:** `client/src/pages/RecoveryPage.tsx`  
**What:** Add a `HeadlineCard` using `rec.battery.wake` (PEAK) and `rec.battery.current` (NOW), with a `BodyBattery` component in the card footer.

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

**insights.ts serves files; briefings now live in DB.** `server/api/insights.ts` reads from flat files in `insights/`. The new pipeline writes briefings to the `mx4_briefings` SQLite table. Phase 2 will add `GET /api/insights/:section` that reads from the table. The old file-based endpoint is not broken but is no longer the target delivery path.

**`HEARTBEAT.md` referenced but absent.** Multiple places in docs and CLAUDE.md reference this file. It does not exist. Phase 2 will create it.

**`sections.py` metric names are stale.** The Python orchestrator (`mx4/sections.py`) has stale metric names. The TypeScript replacement (`server/lib/ai/sections.ts`) will be written with correct names in Phase 2 — `sections.py` can be left as-is (it's superseded).

**Spec files reference LXC 107 and Docker.** Early design specs (`docs/superpowers/specs/2026-04-25-bacta-design.md`) targeted LXC 107 with Docker Compose. The actual deployment is LXC 109 with no Docker. The specs are historical documents — do not treat them as authoritative for infrastructure.

---

## Known Technical Debt

**Static stub briefing text.** All four built sections show the same five-week-old stub text from `stubData.ts BRIEFS`. This is the most visible rough edge in the product and resolves entirely when the MX-4 orchestrator runs for the first time.

**`MX4Card` deprecated component.** `client/src/components/MX4Card.tsx` exports `MX4Card` which returns `null`. It's deprecated and left in place to avoid import breakage. Once no imports of `MX4Card` (the deprecated version, not `MX4Briefing`) exist, it can be removed.

**Legacy EAV activity metrics.** `act_duration_s`, `act_distance_m`, `act_calories`, `act_avg_hr` rows exist in `garmin_snapshots` from before the `garmin_activities` table existed. They're no longer written but still queried by nothing. They could be removed from VALID_METRICS and eventually deleted from the DB.

**`mx4/sections.py` section IDs don't match API route section names.** The sections in `sections.py` are `recovery`, `sleep-quality`, `training-week`, `vo2-fitness`. The section names in `insights.ts` VALID_SECTIONS are `home`, `recovery`, `training`, `sleep`, `nutrition`, `bloodwork`, `dailylog`. These naming schemes don't align. A decision is needed about what section IDs the orchestrator should use.
