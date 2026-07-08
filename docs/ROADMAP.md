# Bacta — Current State & Roadmap

> **Issue tracking:** Discrete bugs and polish items are tracked as [GitHub Issues](https://github.com/bridgemouse/Bacta/issues). Labels: `bug`, `enhancement`, `polish`, plus gating labels `blocked`/`needs-design`/`needs-human-decision` (filtered out of `bacta-headless`'s queue). File issues with the `/bacta-issues` skill — it converts freeform notes into triage-gated issues ready for `bacta-headless` to pick up. Review and merge the resulting PRs with the `/bacta-pr-review` skill — codifies the fresh-context `/code-review`-per-PR + fix-confirmed-bugs-in-branch pattern that caught real bugs in ~2/3 of the first PR backlog. This roadmap covers milestones and section-level progress only.

## Feature Inventory (as of Jun 16, 2026)

### Complete and Live

**App shell and navigation:**
- `AppShell.tsx` — fixed iOS viewport shell with global texture overlay
- `TopBar.tsx` — home and section modes; MX-4 ONLINE indicator
- `BottomBar.tsx` — Ask MX-4 button, Overview/Trends toggle, nav circle; always MX-4 cyan
- `BottomSheet.tsx` — All Systems nav sheet with 2-column channel grid
- `AskSheet.tsx` — Ask MX-4 sheet: greeting, suggested prompts, input bar; full-width assistant messages with left accent line; real-time tool activity indicators (Jun 17)
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

**MX-4 system — Chat UX complete (Jun 17, 2026):**
- `server/api/mx4.ts` — `toolLabel()` function: Star Wars-themed real-time droid comms labels per tool/args (metric name from SQL, query for research/vault, page name for wiki writes); chat SSE loop switched `textStream` → `fullStream`, emits `{"tool":"LABEL"}` on tool-call events
- `server/api/mx4.ts` — `categorizeError()` function: four-branch error categorization (unconfigured provider, rate limit, timeout, generic fallback); both the catch block and the empty-response path route through it
- `client/src/hooks/useChat.ts` — `toolCalls: string[]` state; parses tool SSE events, keeps last 3, clears on first text delta and in `finally`; SSE error branch passes server string through to UI; outer catch shows connection-drop guidance
- `AskSheet.tsx` — full-width assistant message layout (left accent line, no bubble, matches Claude Desktop); tool indicator rows stack above content while streaming, blink on active row
- `client/src/hooks/useChat.ts` — `loadMessages` crash fix: `r.ok ? r.json() : []` guard + `Array.isArray(msgs)` check prevents crash on 401 response body
- Branch: `mx4-tweaks`, PR: https://github.com/bridgemouse/Bacta/pull/new/mx4-tweaks

**Codebase cleanup (Jun 18, 2026):**
- Depersonalized all hardcoded user references across server source, AI docs, and public docs — repo is public and should not assume a named user
- Refactored duplicate/stale hardcoded lists: `VALID_LOGOS` now single export in `settings.ts`; `VALID_RUN_SECTIONS` derives from `SECTIONS.map()`; phantom metrics removed from `VALID_METRICS` in `garmin.ts`; metric list removed from `queryDb` tool description (MX-4 now uses `SELECT DISTINCT` for discovery)
- Removed hardcoded metric list from `mx4/system-prompt.md` (same self-discovery pattern)
- Added `## Chat` section to `mx4/system-prompt.md` — MX-4 now knows conversational replies are proportional and non-repetitive; tool use unconstrained; briefing structure reserved for briefings

**MX-4 chat engagement (Jun 23, 2026):**
- Rewrote `## Chat` section in `mx4/system-prompt.md` — original was all restraint rules; MX-4 was responding "Noted" to conversational observations
- Added positive engagement mandate: ban on "Noted", curiosity applies in chat, corroborate/contradict data, use DB as background awareness not a report dump
- Added concrete good/bad examples (same mechanism as the Voice register examples — models follow examples more reliably than prose rules)
- Completed depersonalization of `mx4/system-prompt.md`: all "Ethan" references replaced with "the user"; personal context (name, profile, goals) belongs in HEARTBEAT.md (gitignored)

**MX-4 voice guardrails + context injection (Jun 23, 2026):**
- Created `docs/MX4_DROID_VOICE.md` — canonical speech patterns grounded in verbatim TC-99 (*Masters of Evil*) and Two-Boots (*Maul: Shadow Lords*) quotes; 10 modeled MX-4 scenarios covering direct opinion, Two-Boots deference, TC-99 unprompted surfacing, dry acknowledgment, protocol transparency
- `server/lib/ai/prompt.ts` — now injects `mx4_personal_identity_record.md` and `MX4_DROID_VOICE.md` alongside `MX4_REFERENCE.md` on every run (briefings + chat); Gemini 1M context window makes this essentially free
- `mx4/system-prompt.md` — 4 rounds of voice tightening: direct address ("speak to the person, not about their system"), opinion framing ("That's not a good idea" over protocol citations), Two-Boots deference examples ("Your call"), TC-99 unprompted surfacing, expanded banned phrase list, chat output format clarified (no JSON, no ## headers, no summary/body labels)
- Stale `mx4/wiki/reference/MX4_REFERENCE.md` removed — redundant with authoritative injection, was feeding contradictory stale table names as low-trust wiki content
- Wiki pattern pages cleared via Settings — breaks the adjective-drift feedback loop; MX-4 rebuilds pages under new voice guardrails on next briefing run

**MX4_REFERENCE.md table name fix (Jun 23, 2026):**
- `MX4_REFERENCE.md` still referenced `garmin_snapshots`, `garmin_activities`, `garmin_activity_legs` — not updated during the multi-device table rename
- Since this doc is injected into MX-4's system prompt every run, he generated SQL against non-existent tables; Recovery and Home briefings reported "Biometric Database Inaccessible"
- Fixed all 5 stale references to `health_snapshots`, `health_activities`, `health_activity_legs`
- Root cause: `queryDb` swallows SQLite errors silently (by design, to avoid schema leakage) — so MX-4 gets a generic failure and assumes the DB is down

**Tests:**
- 407 tests passing (237 server + 170 client, last verified Jun 24, 2026 — Plan 2 Phases 1–3 integration layer: 6 providers, 44 new server tests)
- Coverage: all page components, all viz components, all hooks (server-mocked), all API routes, settings CRUD, AI provider, MX-4 tools, chat API, wiki module, orchestrator, wrap session, message compression, vault client, custom skills API, toolLabel (13 cases), categorizeError (7 cases), useChat SSE parsing (5 cases)

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
2. **Multi-device integration — DONE (2026-06-28, PR #6 merged to main).** Plans 1–3 complete: table migrations, 6-provider OAuth/API-key integration layer, Settings UI (CONNECTED DEVICES + DATA PRIORITY rails), source badges on Recovery + Sleep, Garmin as full peer. 445 tests. See below for full detail. **Caveat found in the 2026-07-07 codebase audit:** "DONE" covers the integration layer and manual-sync UI, not full automation or data correctness — connected providers other than Garmin have no background sync at all (issue #81; the `scripts/health_poller.py` dispatcher this was meant to run through is dead code, never wired to any timer/cron), and Oura/Whoop/Polar (partly Withings) write sleep/SpO2/respiration metrics under names the client never reads, making that data permanently invisible (issue #83).
3. **Post-sweep infrastructure runbook (operator-executed)** — `docs/SECURITY.md` §4 + `docs/OPERATIONS.md` §1. Includes the PHI git-history scrub + force-push, firewall/Tailscale, encryption at rest, systemd hardening, NFS/vault-MCP lockdown, TLS, and installing the backup timer + off-box copy. *(Runner hardening removed — self-hosted runner decommissioned 2026-06-17; CI now runs on GitHub cloud runners only.)*
4. **Tag v1.1.0** — multi-device integration is a meaningful milestone worth a version tag.
5. **LogEntry Phase C** — expand the activity log panel with training effect bars and HR zone distribution. Currently behind `hasContent = false` flag in `LogEntry.tsx`.
6. **Autonomous headless development — DONE (2026-06-29 to 2026-07-01, `bacta-headless` skill).** Three sessions produced 14 PRs (#22–#35); all reviewed with `/code-review` at high effort and merged to `main` on 2026-07-01. Fixes shipped: Body Battery stale-after-sync (extended to Sleep/Training tiles too), briefing-regen stale-polling and `FAILED`-state feedback, `\N` escape-sequence normalization + empty-`## DIRECTIVE` fallback in Full Analysis, vault-unreachable chat resilience (plus a retry-on-reconnect fix found in review), Full Analysis UTC-midnight session mismatch (root-caused to a duplicated `chat-${date}` formula, now a shared `getChatSessionId()` helper), configurable automatic background Garmin sync (`server/lib/garminSync.ts`, 15min–24h via Settings — a cron-expression bug for the 2h/4h options was caught and fixed in review), 7-day cumulative sleep debt, in-app log viewer (`app_logs` table + Settings → Diagnostics → Logs), a toast notification system for previously-silent sync/AI-provider failures (a stale-error-on-409 bug caught and fixed in review), sleep score inside the Home ring dial, crossfade animation on metric-value refresh (`FadeValue` primitive), and swipe-down-to-dismiss on bottom sheets (a stale-drag-offset bug caught and fixed in review). Review also caught and fixed a stale-timer race in the refresh-retry flow (#10/PR #28) not directly tied to its own stated fix. See `docs/ROADMAP.md` git history or PR #22–#35 descriptions for full detail per-fix.
7. **Second headless batch — DONE (2026-07-01 to 2026-07-02, issues #37–#43, PRs #36 + #44–#50).** All 8 reviewed with `/bacta-pr-review` and merged to `main` on 2026-07-02. Issue #21 (light sleep vs Garmin Connect mismatch), previously triaged-and-skipped for lack of a repro, turned out to be a real bug: `sleepLevels[].startGMT/endGMT` have no timezone suffix despite the name, so `new Date()` parsed them as server-local time — fixed by parsing explicitly as UTC (PR #36). Also shipped: same-day activity context in MX-4 briefing prompts (review caught the fix itself using UTC-not-local "today", which would've silently dropped evening activities — the exact bug the PR existed to fix), a real training-status freshness sub-label replacing the dead "Block 4 of 8" stub, compact-card overlay truncation fix on Recovery's RHR/Stress pair, View Transitions + a session data cache for pop-in-free section navigation (review caught a missing `flushSync` that would've silently no-op'd the crossfade, plus a test-isolation gap only visible after combining with an already-merged PR), a staged progress bar for refresh-all MX-4 regeneration, 17 new per-activity Garmin fields via an idempotent column migration, and collapsible Settings groups defaulting to collapsed (review caught an unrelated, undisclosed regression bundled into the diff — two API-key inputs defaulting to plaintext instead of masked, and the custom-skills add-form defaulting open).
8. **Silent-failure sweep — PRs open, pending review (2026-07-08, issues #63, #65–#72 from the 2026-07-07 codebase audit, PRs #86–#94).** Not yet merged. Closes a cluster of "caught but never logged" gaps found in the audit: orchestrator + chat vault-tool failures, poll/force-sync and provider-sync and OAuth-callback failures, chat compression failures, sleep-hypnogram parse/shape failures, and nightly-cron failures now all write to `app_logs` instead of `console.error`-only or silent swallowing; `/api/garmin/activities?days=` also got a missing lower-bound clamp (`days=-5` no longer silently returns empty). Each PR is TDD (RED commit shows the pre-fix failing test) with full suite + typecheck green. 11 more open issues from the same audit (#73–79, #82, #83, #85) remain queued for a future session.

> ⚠️ **PHI in git (still requires the operator):** `mx4/wiki/` and `mx4/HEARTBEAT.md` are now untracked + gitignored, but they remain in history. Run the `git filter-repo` scrub + force-push from `docs/SECURITY.md` §4.1 before pushing to any shared remote, and rotate exposed secrets.

---

## Near-Term (Deferred with Clear Path)

### Nutrition Section

**Scope:** Custom-built nutrition tracker — not a third-party integration. This is a major feature: food logging UI, macro/calorie tracking, meal history, and a Bacta-native data model.  
**Path:** Design session first (data model + UI) → build logging interface → wire to nutrition table → build `NutritionPage.tsx` → wire MX-4 briefing.  
**DB:** `macrofactor_snapshots` table exists as a placeholder, confirmed empty (0 rows) as of 2026-07-08 and superseded — `NUTRITION_PLAN.md` §3 resolves this to a straight drop (new `foods`/`food_log_entries`/`nutrition_targets` tables instead), not a repurpose, since its EAV shape can't represent multi-item-per-day food logging.  
**Plan drafted (2026-07-08):** `docs/NUTRITION_PLAN.md` (data model, API design, 8-phase backend sprint plan, self-critique pass) and `docs/NUTRITION_DESIGN_BRIEF.md` (accent color + data-types brief for the Claude Design handoff session) are done. Design session and implementation have not started — see `NUTRITION_PLAN.md` §7 for open product decisions (TypeScript vs. Python for bulk import, how much USDA/OFF reference data to import, `home` cross-channel synthesis, meal-type vocabulary, unit conversion, micronutrients) that need a human call before Phase 1 begins.

### Blood Work Section

**Blocker:** Waiting on actual lab results.  
**Path:** Receive PDF lab report → parse markers → import to `blood_work` table → build `BloodWorkPage.tsx`.  
**DB ready:** `blood_work` table exists with `marker`, `value`, `unit`, `reference_range`, `source_file` columns.

### Daily Log Section

**Blocker:** No data source and no input UI.  
**Path:** Define what "daily log" means for this user (caffeine? mood? readiness? supplements?) → build input form (possibly in AskSheet or a dedicated input view) → wire to `manual_inputs` table → build `DailyLogPage.tsx`.  
**DB ready:** `manual_inputs` table has `readiness` (1–5), `caffeine_mg`, `supplements` columns.

### Multi-Device Wearables Integration

**Status: MERGED to `main` as PR #6 on 2026-06-28.** Plans 1–3 complete.

**Branch:** `feature/multi-device` — Plan 1 (Foundation) complete Jun 23, 2026.

**Plan 1 complete:**
- `garmin_snapshots` → `health_snapshots` (+ `source TEXT NOT NULL DEFAULT 'garmin'`, `UNIQUE(date, metric, source)`)
- `garmin_activities` → `health_activities` (composite PK `activity_id TEXT + source TEXT`)
- `garmin_activity_legs` → `health_activity_legs` (+ `source` column)
- Idempotent migrations in `server/db/migrate.ts` — existing Garmin data preserved
- All Python pollers updated to new table names; Garmin scripts relocated to `scripts/providers/garmin/`
- `scripts/health_poller.py` dispatcher — runs Garmin always + OAuth providers when enabled
- `server/lib/integrations/shared/metricMap.ts` — canonical metric registry + `PROVIDER_LABELS`
- `server/lib/integrations/shared/sourceResolver.ts` — `resolveSource()` priority utility
- 329 tests passing

**Plan 2 Phase 1 (Strava + Hevy integration) — complete Jun 24, 2026, on `feature/multi-device`:**
- `server/lib/integrations/shared/encryption.ts` — AES-256-GCM encrypt/decrypt; key from `BACTA_ENCRYPTION_KEY`
- `server/lib/integrations/shared/types.ts` — `ProviderTokens`, `tokensExpired()`, `daysAgo()`, `toEpoch()`
- `server/lib/settings.ts` — `PROVIDERS` const, all 6 provider setting defaults + `base_url` + `source_priority`; `SECRET_SETTING_KEYS` expanded (tokens, secrets, oauth_state for all 6 providers)
- `server/api/settings.ts` — `ENCRYPTED_SETTING_KEYS` set; PUT handler encrypts client secrets + hevy_api_key at write
- `server/lib/integrations/strava/` — OAuth, token refresh, paginated activity fetch, `health_activities` + daily distance rollup writes
- `server/lib/integrations/hevy/` — API key auth, workout fetch, `health_activities` writes
- `server/api/integrations.ts` — unified router: `GET /status`, `GET /:provider/authorize`, `GET /:provider/callback` (CSRF state), `GET /:provider/status`, `POST /:provider/disconnect`, `POST /:provider/sync` (accepts internal token OR session cookie)
- `scripts/providers/strava/poller.py` + `scripts/providers/hevy/poller.py` — thin HTTP callers
- `BACTA_ENCRYPTION_KEY` + `BACTA_INTERNAL_TOKEN` generated and written to `/opt/bacta/.env`
- systemd `bacta-api.service` updated with `EnvironmentFile=/opt/bacta/.env`
- 363 tests passing (193 server + 170 client); zero type errors

**Plan 2 Phase 2 (Oura + Whoop) — complete Jun 24, 2026, on `feature/multi-device`:**
- `server/lib/integrations/oura/` — OAuth (HTTP Basic auth for tokens), token refresh, parallel fetch of sleep/readiness/activity; processor writes 11 metrics to `health_snapshots` (source=`'oura'`)
- `server/lib/integrations/whoop/` — OAuth v2 (form-body creds, hourly expiry), parallel fetch of recovery/sleep/workout; processor writes recovery + sleep snapshots + workout activities (source=`'whoop'`)
- `scripts/providers/oura/poller.py` + `scripts/providers/whoop/poller.py`
- `server/api/integrations.ts` extended: authorize/callback/runSync switches now handle oura + whoop
- 385 tests passing (215 server + 170 client); zero type errors

**Plan 2 Phase 3 (Polar + Withings) — complete Jun 24, 2026, on `feature/multi-device`:**
- `server/lib/integrations/polar/` — OAuth (HTTP Basic auth, long-lived tokens, XML user-registration at callback), parallel fetch of exercises/sleep/nightly-recharge; processor writes sleep metrics + nightly recharge + exercises (source=`'polar'`)
- `server/lib/integrations/withings/` — OAuth (non-standard `action=requesttoken` endpoint, wrapped `{status,body}` responses), measurement fetch (weight_kg, resting_hr, spo2); processor uses `value * 10^unit` formula (source=`'withings'`)
- `scripts/providers/polar/poller.py` + `scripts/providers/withings/poller.py`
- `server/api/integrations.ts` extended: all 3 switch statements now cover all 6 providers
- 407 tests passing (237 server + 170 client); zero type errors (Plan 2 baseline — 445 after Plan 3)

**Plan 3 (Settings UI + Source Attribution) — complete Jun 25–26, 2026, on `feature/multi-device`:**
- `client/src/components/ProviderCard.tsx` — new shared component; OAuth (Client ID + Secret) and API-key (single input) flows; connected/disconnected states; `syncStatus` union (`idle | syncing | synced | error`) with SYNC NOW / SYNCED ✓ / RETRY / amber-error states; DISCONNECT button; `noCredentials` prop for poller-managed providers
- `SettingsPage.tsx` — three new rails: INSTANCE (`base_url` text input, save-on-blur, SAVED indicator), CONNECTED DEVICES (one ProviderCard per provider — Garmin first with no credential form, Hevy uses API-key flow, others use OAuth), DATA PRIORITY (up/down reorder for `source_priority` JSON array with 7 providers)
- `server/api/integrations.ts` — Hevy connected-status fix; `isConnected()` helper; Garmin as full peer in PROVIDERS (sync fires poller detached, lastSync falls back to DB MAX(date)); `oauth_state` encrypted at write/decrypted at compare; `addToSourcePriority`/`removeFromSourcePriority` called on connect/disconnect
- `server/lib/settings.ts` — Garmin added to PROVIDERS with `garmin_enabled: 'true'` + `garmin_last_sync` defaults; `basicAuth()` extracted to `shared/types.ts`
- `server/api/garmin.ts` — `GET /api/garmin/sources` route; returns `{metric: source}` map
- `client/src/lib/garminApi.ts` — `fetchSources(): Promise<Record<string, string>>` helper
- `useRecoveryData` + `useSleepData` hooks — `sources: Record<string, string>` added; `fetchSources()` called in `Promise.all`
- `RecoveryPage.tsx` + `SleepPage.tsx` — file-local `SourceBadge` (amber pill, invisible for Garmin data); badges on HRV, RHR, Body Battery, Recovery Score, SpO₂, Respiration (Recovery); Sleep Score, Sleep HR, SpO₂ (Sleep)
- `server/index.ts` — `requireAuth` accepts `BACTA_INTERNAL_TOKEN` Bearer header; `trust proxy: 1` for NPM `X-Forwarded-For` (was silently 500ing MX-4 refresh)
- 445 tests passing (205 client + 240 server); zero type errors

**Providers:** Polar, Oura, Whoop, Withings, Strava, Hevy — all direct OAuth 2.0 (no intermediary). Fitbit skipped (API deprecated Sept 2026). Apple Health / Google Health Connect deferred to native app.

**Open Wearables** — deferred as optional upstream adapter, not a v1 dependency.

### Docker Support

**Scope:** Containerise the app so users can spin it up with a single `docker compose up`. Currently requires manual host setup (Node, Python, systemd). Docker would lower the barrier significantly for self-hosters.  
**Path:** Write `Dockerfile` for the Node server + client build → `docker-compose.yml` with volume mounts for `data/` and `mx4/` → document in self-hosting guide.  
**Note:** The Garmin poller is Python and runs on a cron/systemd schedule — either include it as a second container or document it as a sidecar.

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

**Legacy EAV activity metrics.** `act_duration_s`, `act_distance_m`, `act_calories`, `act_avg_hr` rows exist in `health_snapshots` from before the `health_activities` table existed. They're no longer written but still queried by nothing. They could be removed from VALID_METRICS and eventually deleted from the DB.

**`mx4/sections.py` section IDs don't match API route section names.** The sections in `sections.py` are `recovery`, `sleep-quality`, `training-week`, `vo2-fitness`. The section names in `insights.ts` VALID_SECTIONS are `home`, `recovery`, `training`, `sleep`, `nutrition`, `bloodwork`, `dailylog`. These naming schemes don't align. A decision is needed about what section IDs the orchestrator should use.
