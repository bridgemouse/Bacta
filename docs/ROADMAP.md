# Bacta — Current State & Roadmap

## Feature Inventory (as of Jun 16, 2026)

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
- `server/lib/ai/tools.ts` — 5 MX-4 tools: `queryDb`, `readAllWikiPages`, `writeWikiPage`, `listWikiPages`, `archiveWikiPage` (`readVault` removed Jun 16)
- `SettingsPage.tsx` — settings UI; accessible from NavSheet under SYSTEM divider
- `mx4/system-prompt.md` — rewritten Jun 11, 2026 (replaced AZI-3 fabrication with correct identity)
- `server/api/mx4.ts` — `POST /api/mx4/run` signal endpoint live
- **Superseded:** `mx4/orchestrator.py` (Python/`claude -p` approach) replaced by TypeScript/Vercel AI SDK pipeline

**MX-4 system — Phase 2 complete (Jun 14, 2026):**
- `server/lib/ai/sections.ts` — metric definitions per section with corrected Garmin schema names
- `server/lib/ai/wiki.ts` — sync wiki utilities (read all pages, write page, list with sizes); reset functions for data management
- `server/lib/ai/wrap.ts` — post-session wiki maintenance: oversized page detection → AI synthesis → archive + rewrite
- `server/lib/ai/orchestrator.ts` — two-step pipeline: `generateText` with all 6 tools → `generateObject` for structured briefing JSON; writes to `mx4_briefings` table; triggered via `POST /api/mx4/run`
- `server/lib/ai/chat.ts` — `loadChatHistory(sessionId)` → `CoreMessage[]` for chat context
- `server/api/mx4.ts` — `GET /api/chat/:sessionId` (history), `POST /api/chat` (SSE streaming with all 6 tools available)
- `client/src/hooks/useChat.ts` — session state, streaming fetch via `ReadableStream`, history restore on open
- `AskSheet.tsx` — live chat UI: user/MX-4 message bubbles, streaming token-by-token rendering, date-based session IDs, history persists across opens; error event on empty stream
- Section pages (Recovery, Sleep, Training) wired to `useBriefing` hook — live `MX4Briefing` data replaces stubs
- `node-cron` scheduler in `server/index.ts` — nightly run at configured time (default 04:00)
- `mx4/wiki/` — wiki directory initialized; pages written by MX-4 on first orchestrator run

**MX-4 system — Phase 3 complete (Jun 15, 2026):**
- **Orchestrator first run executed** — all 3 sections (recovery, sleep, training) producing live briefings with real Garmin data
- `mx4/HEARTBEAT.md` created — standing orders injected on every orchestrator run and every chat turn
- `mx4/system-prompt.md` rewritten — voice-register examples, explicit output format spec (summary + body fields), removed clinical checklist
- `server/lib/ai/sections.ts` rewritten — directive prompts, both `summary` (3–5 prose sentences for card) and `body` (structured markdown for FULL ANALYSIS) fields
- `BriefingResult` schema: `summary` field added — cards show summary by default, body only in FULL ANALYSIS
- `POST /api/mx4/chat/seed` — seeds assistant message directly into chat session (used by FULL ANALYSIS flow)
- `AskSheetContext` — React context so deep components (MX4Card) can open AskSheet without prop drilling
- FULL ANALYSIS › button on `MX4Briefing` — seeds briefing body into chat, opens AskSheet
- `AskSheet` — ReactMarkdown rendering for assistant messages; reloads history on open to catch seeded messages; SYNC WIKI › pill (now a seeded custom skill, not hardcoded)
- Message compression — `compressSessionIfNeeded()` runs before chat, summarizes oldest messages when threshold exceeded
- `SettingsPage.tsx` — compression threshold row added to MX-4 INTELLIGENCE rail; DATA MANAGEMENT rail with 3 protected clear actions (chat history, wiki patterns, full wiki)
- `server/lib/ai/tools.ts` — `queryDb` tool description enriched with full metric name vocabulary
- `client/src/pages/HomePage.tsx` — MX4Briefing wired to `useBriefing('home')` live data
- `server/lib/ai/sections.ts` — `home` section added (Jun 15); queries `mx4_briefings` for cross-channel synthesis; runs last so recovery/sleep/training briefings are available
- `server/lib/ai/tools.ts` — `mx4_briefings` table added to `queryDb` description so MX-4 can query his own completed briefings
- `docs/VAULT_SETUP.md` — NFS mount runbook for LXC 106 → LXC 109

**MX-4 system — Phase 4 complete (Jun 16, 2026):**
- **Custom Skills** — `mx4_custom_skills` JSON array in `app_settings`; SYNC WIKI seeded as default; `GET /api/settings/custom-skills`; CUSTOM SKILLS rail in Settings (add/delete user skills; all skills incl. SYNC WIKI editable via inline form showing label+prompt; SYNC WIKI not deletable but shows prompt as guidance template); AskSheet carousel (3 per swipeable page, page dots when >3); iOS zoom fix (fontSize 16 on all inputs)
- **Vault Integration** — `@modelcontextprotocol/sdk` MCP client singleton in `server/lib/ai/vaultClient.ts`; 4 tools: `search_wiki`, `read_wiki_page`, `list_wiki_pages`, `get_wiki_index`; `vault_enabled`/`vault_url` settings; VAULT rail in Settings (toggle, URL input, TEST CONNECTION with domain/page count); vault tools merged conditionally into orchestrator + chat; `readVault` filesystem tool removed
- **Tech debt cleared** — `MX4Card`/`MX4Insight` stub deleted; ARCHITECTURE.md briefing pipeline notes updated; `mx4/sections.py` and `mx4/orchestrator.py` marked deprecated
- **Home body battery fix** — Recovery tile now reads `body_battery_current ?? body_battery_wake ?? 74`; was showing start-of-day wake value instead of live intraday reading

**Tests:**
- 278 tests passing (113 server + 165 client, last verified Jun 16, 2026)
- Coverage: all page components, all viz components, all hooks (server-mocked), all API routes, settings CRUD, AI provider, MX-4 tools, chat API, wiki module, orchestrator, wrap session, message compression, vault client, custom skills API

### Present but Untested (Never Run)

- **`POST /api/poll/force`** — poll signal endpoint; counterpart `check_signal.py` has not been verified in production
- **MX-4 cron** — `node-cron` scheduler is wired in `server/index.ts` but nightly run has not been verified end-to-end in production yet (first orchestrator run was manual)

### Placeholder / Calibrating

- **Nutrition** (`NutritionPage.tsx`) — `SectionShell` with STANDBY state; no data source
- **Blood Work** (`BloodWorkPage.tsx`) — `SectionShell`; `blood_work` table exists but empty
- **Daily Log** (`DailyLogPage.tsx`) — `SectionShell`; `manual_inputs` table exists but empty and no input UI

---

## Immediate Priorities

1. **v1.0 release-readiness sweep — DONE (2026-06-17).** Executed on branch `e2e-release-sweep`; report at `docs/release-test/findings-2026-06-17.md`. Shipped: app auth (PIN→token), read-only `queryDb`, prompt-injection defense, helmet/CSP + input validation + rate limits, the provider-agnostic `research` tool, `docs/MX4_REFERENCE.md` (injected), DB backup+restore, failure notifications, the `recovery_time_h` unit fix, and data cleanup. MX-4 verified end-to-end (grounded briefings, vault use, real research citations, zero persona hard-fails).
2. **Post-sweep infrastructure runbook (operator-executed)** — `docs/SECURITY.md` §4 + `docs/OPERATIONS.md` §1. Includes the PHI git-history scrub + force-push, firewall/Tailscale, encryption at rest, systemd hardening, NFS/vault-MCP lockdown, runner hardening, TLS, and installing the backup timer + off-box copy.

> ⚠️ **PHI in git (still requires the operator):** `mx4/wiki/` and `mx4/HEARTBEAT.md` are now untracked + gitignored, but they remain in history. Run the `git filter-repo` scrub + force-push from `docs/SECURITY.md` §4.1 before pushing to any shared remote, and rotate exposed secrets.

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

**`sections.py` metric names are stale.** The Python orchestrator (`mx4/sections.py`) has stale metric names. The TypeScript replacement (`server/lib/ai/sections.ts`) will be written with correct names in Phase 2 — `sections.py` can be left as-is (it's superseded).

**Spec files reference LXC 107 and Docker.** Early design specs (`docs/superpowers/specs/2026-04-25-bacta-design.md`) targeted LXC 107 with Docker Compose. The actual deployment is LXC 109 with no Docker. The specs are historical documents — do not treat them as authoritative for infrastructure.

---

## Known Technical Debt

**Home section briefing live** — resolved Jun 15, 2026. All four sections (home, recovery, sleep, training) produce live briefings.

**`MX4Card` deprecated component.** `client/src/components/MX4Card.tsx` exports `MX4Card` which returns `null`. It's deprecated and left in place to avoid import breakage. Once no imports of `MX4Card` (the deprecated version, not `MX4Briefing`) exist, it can be removed.

**Legacy EAV activity metrics.** `act_duration_s`, `act_distance_m`, `act_calories`, `act_avg_hr` rows exist in `garmin_snapshots` from before the `garmin_activities` table existed. They're no longer written but still queried by nothing. They could be removed from VALID_METRICS and eventually deleted from the DB.

**`mx4/sections.py` section IDs don't match API route section names.** The sections in `sections.py` are `recovery`, `sleep-quality`, `training-week`, `vo2-fitness`. The section names in `insights.ts` VALID_SECTIONS are `home`, `recovery`, `training`, `sleep`, `nutrition`, `bloodwork`, `dailylog`. These naming schemes don't align. A decision is needed about what section IDs the orchestrator should use.
