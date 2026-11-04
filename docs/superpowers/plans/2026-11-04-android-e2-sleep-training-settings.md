# Android Phase E2 (Sleep, Training, Settings) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Docs are the source of truth, the web code is only a hint** (same rule as the E1 plan). Every task starts with a docs step: `android docs search/fetch kb://…` on the dev VM (`ssh wheat@bacta-android`), Chromium (Playwright MCP) if a docs page 404s. Verify any Garmin claim against the live database via the `bacta-sqlite` MCP before encoding it.

**Goal:** Sleep, Training and Settings screens in the native app, on real data only, so that with the already-built Home and Recovery the owner can run the PWA's day-to-day views on the phone. MX-4 chat is a separate plan (E2b), because it is a streaming subsystem and MX-4 is offline.

**Architecture:** Unchanged from E1 (`docs/superpowers/plans/2026-11-03-android-first-build.md`): repositories over Retrofit, pure `domain` rules, one `@HiltViewModel` per screen exposing `StateFlow<UiState>`, screens rendered from UI models by the reusable card templates in `ui/designsystem/components`. New work adds a few templates only where a new visual form is needed (hypnogram, stage breakdown, zone bars, activity row, setting rows).

**Tech Stack:** As E1 (Kotlin 2.4.21, AGP 9.5.0, Compose BOM 2026.09.00, Hilt, Navigation 3, Retrofit 3, kotlinx-serialization, JUnit4 + coroutines-test + Turbine + MockWebServer).

**Spec:** `docs/superpowers/specs/2026-11-02-android-native-app-design.md` (§9 scope: Sleep, Training, in-use Settings; chat is E2b). Design source: the live PWA and `design_bacta-handoff-package/` for what each screen shows; Claude does not invent visuals.

## Global Constraints

- `minSdk 34`, `targetSdk 37`, `compileSdk { version = release(37) { minorApiLevel = 0 } }`, applicationId `io.github.bridgemouse.bacta`, AGP 9.5.0 built-in Kotlin (never apply `org.jetbrains.kotlin.android`).
- Dark UI only; section accents from `BactaPalette.accent(Section)`; text floor 11sp; 48dp touch targets; charts carry screen-reader descriptions.
- No fake numbers or fallbacks: missing data is `null` and renders as a dash; failures are explicit states. No stub briefings.
- The repo is **public** and the data is health data: fixtures and previews use synthetic values only; never commit real values or real-data screenshots.
- Work in `worktrees/<name>` on `feature/<name>`; PR + squash-merge with CI green; never commit to `main`; never check out branches in `/opt/bacta`.
- After `git add`, run `git status --ignored` for new source directories (a `.gitignore` rule once swallowed `data/`; now anchored to `/data/`).
- Commit trailer `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`; PR bodies follow `.github/pull_request_template.md`, include "Docs consulted" and "Where this deliberately differs from the web client, and why", and end with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.
- Claude cannot create tags; the owner pushes `android-v*`. Announce before anything foregrounds the app on the Fold and wait for "go".

## Port audit: web artifacts we do NOT carry over

| Web artifact | Android decision |
|---|---|
| `?? SLEEP.score.value`, `SLEEP.stages`, `SLEEP.hypno`, `SLEEP.resp.avg` stub fallbacks; `STUB`/`TRAINING.*` fallbacks (`useSleepData.ts`, `useTrainingData.ts`); "keep stub on error" | Nulls and explicit `Loading/Content/Error`; a missing hypnogram omits that card. |
| Sleep score bands `85 / 70` ("Excellent/Good/Fair") | Verify against Garmin's published bands before encoding (Task 2); record a ruling. |
| `loadState` default `TRAINING.load.state`, `statusLabel ?? 'Maintaining'` for unknown codes | Unknown/absent status shows nothing (only the five verified codes are labelled, see `TrainingStatus`). |
| Hardcoded daily goals `goal={8}` km, `2500` kcal, `600` active kcal (`TrainingPage.tsx`) | Only server-provided goals (`steps_goal`, `floors_goal`) draw a ring; other tiles show the value alone. |
| Intensity goal `150` and sleep target `480` min embedded in hooks | Named constants in `domain` with a comment citing the source (WHO guideline; 8 h convention), unit-tested. |
| Overnight stage trend built from deep-sleep seconds mislabelled as duration (`duration.trend = deepTrendMins`) | Duration trend uses total sleep (`sleep_s`, else stage sum), not deep minutes. |
| Day-of-week chart labels impossible because trend fetches drop dates | `MetricsRepository.points()` keeps dates; bars get real day labels. |
| UTC `toISOString()` date math | Device-local `LocalDate` (as E1). |
| Per-metric trend fetch fan-out repeated per hook | One concurrent batch per screen (as E1); a batch endpoint stays issue #248. |

## Review Focus

1. **Stale "latest" data.** The summary is the per-metric latest value, so if last night was not recorded Sleep silently shows an older night. Show which night the data is from and a stale marker when it is older than yesterday (Task 3 test `staleNightIsLabelled`).
2. **Hypnogram unavailable or malformed.** The server returns an empty list (or logs a shape error) for some nights: omit the card, never draw a default (Task 4 test `missingHypnogramOmitsTheCard`).
3. **Garmin local timestamps.** `sleepStartTimestampLocal` is "local time as if UTC" milliseconds; formatting with the device zone shifts axis labels. Format with UTC and test under a non-UTC default zone (Task 2 test `axisLabelsIgnoreTheDeviceZone`).
4. **Secrets in Settings.** `GET /api/settings` returns secrets masked (`••••abcd`). Writing that back would overwrite the real key. The key field is write-only, never prefilled, and an unchanged field sends nothing (Task 8 test `secretValuesAreMaskedAndNeverWrittenBack`).
5. **Unknown activity types and partial activities.** `typeKey` values beyond the common list, null distance/duration/HR rows must render a readable label and dashes, not blanks or crashes (Task 6 test `unknownActivityTypeGetsAReadableLabel`).

---

### Task 1: Data groundwork shared by Sleep and Training

**Files:** Modify `data/network/{BactaApi,Dtos}.kt`, `data/repository/{Models,MetricsRepository}.kt`; Create `data/repository/ActivityRepository.kt`; Test `data/repository/{MetricsPointsTest,ActivityRepositoryTest}.kt`, `data/network/DtoDecodingTest.kt` + fixtures under `src/test/resources/fixtures/`.

**Interfaces:**
- `data class TrendPoint(val date: LocalDate, val value: Double)`; `MetricsRepository.points(metrics: Set<Metric>, days: Int, today: LocalDate = LocalDate.now()): Map<Metric, Result<List<TrendPoint>>>` (same concurrency and isolation as `trends`; `trends` becomes a thin map over it, keeping its signature and tests).
- `Metric` gains `SleepSeconds("sleep_s")`, `SleepDeep("sleep_deep_s")`, `SleepAwake("sleep_awake_s")`, `SleepResp("sleep_resp")`, `SleepSpo2("sleep_spo2")`, `Vo2Max("vo2max")`, `FitnessAge("fitness_age")`, `Steps("steps")`, `CaloriesTotal("calories_total")`.
- `Summary` gains the fields Sleep and Training read: stage seconds (deep, light, rem, awake), `sleepSpo2`, `sleepResp`, `distanceMeters`, `steps`, `stepsGoal`, `caloriesTotal`, `caloriesActive`, `floorsUp`, `floorsGoal`, `vo2max`, `fitnessAge`, `fitnessAgeAchievable`, `trainingLoadMin/Max`, `hrZoneMinutes: List<Double?>` (zones 1–5). `SummaryDto` mirrors them (`@SerialName` snake_case, all nullable).
- `BactaApi`: `GET api/garmin/sleep-hypno` → `HypnoDto(hypno: List<Int>, startLocal: Long?, endLocal: Long?)`; `GET api/garmin/activities?days=` → `ActivitiesDto(activities: List<ActivityDto>)`; `GET api/garmin/weekly-volume?weeks=` → `WeeksDto`; `GET api/garmin/weekly-intensity` → `IntensityDto(moderate, vigorous)`; `GET api/garmin/weekly-avg-hr?weeks=`. Read the server routes (`server/api/garmin.ts`) and capture real response *shapes* with the internal token; write synthetic fixtures by hand.
- `interface ActivityRepository { suspend fun activities(days: Int): Result<List<Activity>>; suspend fun weeklyVolume(weeks: Int): Result<List<WeekValue>>; suspend fun weeklyAvgHr(weeks: Int): Result<List<WeekValue>>; suspend fun weeklyIntensity(): Result<WeeklyIntensity> }` with `Activity(id, typeKey, name?, start: Instant, durationSeconds?, distanceMeters?, avgHr?, calories?)`.

- [ ] **Step 0: Docs first.** Re-read the data-layer and Retrofit pages used in E1 only for anything that changed; check `kb://android/topic/architecture/data-layer` (404 in E1, try the live site) for repository guidance on pagination/caching. Record pages for the PR.
- [ ] **Step 1: Failing tests:** `pointsKeepDatesAndDropNullValues`; `trendsStillReturnsPlainValues` (existing assertions unchanged); `summaryCarriesSleepAndTrainingFields` (fixture decode, absent → null, `hrZoneMinutes` has five slots); `activitiesDecodeFixtureAndMapToDomain`; `oneWeeklyCallFailingDoesNotFailTheOthers`.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** Run → PASS (`bash scripts/android-build.sh build testDebugUnitTest`). **Step 5:** Commit.

### Task 2: Sleep domain rules

**Files:** Create `domain/{SleepRules,Stages}.kt`; Test `domain/SleepRulesTest.kt`.

**Interfaces (all pure):** `SleepRules.scoreBand(score: Double?): Band?`; `SleepRules.debtMinutes(nightMinutes: List<Int>): Int` (sum of `max(0, TARGET - night)`; `TARGET_MINUTES = 480`); `SleepRules.efficiencyPercent(asleepMin: Int, awakeMin: Int): Int?`; `SleepRules.stagePercents(deep, light, rem: Int): List<Int>` (largest-remainder rounding to exactly 100); `SleepRules.architecture(deep, rem, awake, total: Int): Architecture?` with `Architecture(score, deepShare, remShare, awakeShare)` using targets 20% deep / 22% REM, 5% awake, weights 0.4/0.4/0.2; `Hypnogram.axisLabels(startLocalMs: Long?, endLocalMs: Long?): List<String>` (UTC formatting of Garmin's local-as-UTC values); `Hypnogram.stage(level: Int): SleepStage?` for the server's resampled values (live-verified: Garmin level 0 deep, 1 light, 2 REM, 3 awake, the server emits `3 - level`).

- [ ] **Step 0: Docs first.** Fetch Garmin's own description of the sleep score ranges and sleep stages (Chromium on the Garmin support site) and `docs/GARMIN.md`; check the stage-level mapping against `sleepLevels` in a live `source_json`. Record what the web used (85/70) versus Garmin's published ranges in a ledger ruling; the app uses Garmin's.
- [ ] **Step 1: Failing tests:** each band boundary on both sides and `null`; `debtClampsRestedNightsToZero` (nights `[500, 400]` → 80); `efficiencyHandlesZeroAndNull`; `stagePercentsAlwaysSumToOneHundred` (several triples including ties); `architectureMatchesTheWebFormula` for a worked example, `null` when total is 0; `axisLabelsIgnoreTheDeviceZone` (set `TimeZone.setDefault(America/New_York)` in the test); `hypnogramLevelMapping`.
- [ ] **Step 2–4:** FAIL → implement → PASS. **Step 5:** Commit.

### Task 3: Sleep repository, mapping and view model

**Files:** Create `data/repository/SleepRepository.kt` (hypnogram), `ui/sleep/{SleepUiState,SleepMapping,SleepViewModel}.kt`; Test `ui/sleep/{SleepMappingTest,SleepViewModelTest}.kt`, `data/repository/SleepRepositoryTest.kt`.

**Interfaces:** `interface SleepRepository { suspend fun hypnogram(): Result<Hypnogram?> }` (`null` = server had none); `Hypnogram(levels: List<SleepStage?>, startLocalMs: Long?, endLocalMs: Long?)`. `SleepUiState { Loading, Content(briefing: BriefingModel, content: SleepContent, refreshing: Boolean), Error }`; `SleepContent(duration: …, scoreRing, stages: List<StageModel>, efficiency/debt: MetricCardModel/MeterModel, hypnogram: HypnogramModel?, architecture: GaugeModel?, vitals: List<StatusTileModel>, trends: List<TrendSectionModel>, night: NightLabel)`; `toSleepContent(summary, points, hypnogram, today)`; `SleepViewModel(metrics, briefings, sleep, clock)` loads summary + one `points()` batch + hypnogram + the `Section.Sleep` briefing concurrently (same shape as `RecoveryViewModel`; reuse `briefingState`).

- [ ] **Step 0: Docs first.** UI-layer state production (as E1) and the Compose performance "effects and threading" page; nothing new unless the docs changed. Record pages.
- [ ] **Step 1: Failing tests:** `nullMetricsRenderDashesAndNoStages`; `stagesUseDomainPercentsAndSumToOneHundred`; `durationTrendUsesTotalSleepNotDeepSleep`; `staleNightIsLabelled` (latest point date older than yesterday → `NightLabel.Stale`); `vitalsOnlyThoseWithData`; `trendsHaveFiveSectionsInWebOrder` (Duration, Score, Sleep HR, Respiration, Sleep Stress) with real day labels from point dates for bars; view-model tests as Recovery (`oneFailureIsIsolated`, `refreshKeepsContent`, `summaryFailureYieldsError`, briefing states).
- [ ] **Step 2–4:** FAIL → implement → PASS. **Step 5:** Commit.

### Task 4: Sleep screen and navigation

**Files:** Create `ui/designsystem/viz/Hypnogram.kt`, `ui/designsystem/components/{StageBreakdown,HypnogramCard}.kt`, `ui/sleep/{SleepScreen,SleepRoute,SleepPreviews}.kt`; Modify `ui/navigation/{Destinations,AppNavigation}.kt` (`Destination.Sleep`, `BuiltSections += Section.Sleep`), Home tile click wiring is already section-driven; Test `ui/navigation/NavigationTest.kt`, `ui/designsystem/HypnogramGeometryTest.kt`.

**Interfaces:** `HypnogramModel(levels: List<SleepStage?>, axisLabels: List<String>)`; `HypnogramCard(model, accent)`; `StageBreakdown(stages: List<StageModel>, accent)`; `Hypnogram` composable draws stepped stage blocks with `drawWithCache`, describes itself for screen readers ("deep, light, REM, awake over the night"); pure `hypnogramSegments(levels): List<Segment>` carries the geometry. Overview order as the web: `LAST NIGHT` (time asleep with in-bed, stage chips, score ring), efficiency + debt pair, sleep architecture (hypnogram), architecture score gauge, `OVERNIGHT VITALS`. Trends tab: five sections.

- [ ] **Step 0: Docs first.** Compose custom drawing and accessibility pages for custom charts (same as E1's chart work); `kb://android/develop/ui/compose/graphics/draw/overview`. Record pages.
- [ ] **Step 1: Failing tests:** `hypnogramSegmentsMergeRunsAndKeepOrder`; `missingHypnogramOmitsTheCard`; `openingSleepKeepsHomeUnderneath` (navigation); preview catalog renders loaded/partial/error (render and read the PNGs; synthetic data only).
- [ ] **Step 2–4:** FAIL → implement → PASS; render previews. **Step 5:** Commit; open the PR for `feature/android-sleep` (Tasks 1–4); CI green; merge.

### Task 5: Training domain rules

**Files:** Create `domain/TrainingRules.kt`; Test `domain/TrainingRulesTest.kt`.

**Interfaces (pure):** `TrainingRules.loadState(load, min, max): Band?` (Under/Optimal/High from Garmin's own optimal range); `TrainingRules.loadRatio(acute: Double?, history: List<Double>): LoadRatio?` (needs ≥ 7 history points and chronic > 0; bands < 0.8 Low, > 1.3 High, else Optimal); `TrainingRules.zonePercents(minutes: List<Double?>): List<Int>?` (largest remainder, `null` when total is 0); `ZoneMeta` (labels Warm Up/Easy/Aerobic/Threshold/Maximum with colors from `BactaPalette`); `TrainingRules.intensityPoints(moderate, vigorous) = moderate + 2 * vigorous`; `WEEKLY_INTENSITY_GOAL = 150`.

- [ ] **Step 0: Docs first.** Verify against live data what `training_load` is (7-day acute load?) by comparing its series with Garmin's `training_load_min/max` and `docs/GARMIN.md`; verify `hrzone_N_min` is *today's* zone minutes (not weekly) and `weekly-intensity`'s window in `server/api/garmin.ts`; record rulings. Read Garmin's acute:chronic guidance only if the ratio is kept.
- [ ] **Step 1: Failing tests:** `loadStateBoundaries` on both sides; `loadRatioNeedsEnoughHistory`; `loadRatioBands` (0.79/0.8/1.3/1.31); `zonePercentsSumToOneHundredOrNull`; `intensityCountsVigorousDouble`.
- [ ] **Step 2–4:** FAIL → implement → PASS. **Step 5:** Commit.

### Task 6: Training mapping and view model

**Files:** Create `ui/training/{TrainingUiState,TrainingMapping,TrainingViewModel}.kt`; Test `ui/training/{TrainingMappingTest,TrainingViewModelTest}.kt`.

**Interfaces:** `TrainingContent(performance: List<HeadlineModel>, intensity: MeterModel?, zones: ZonesModel?, daily: DailyActivityModel, activities: List<ActivityRowModel>, trends: List<TrendSectionModel>)`; `toTrainingContent(summary, points, activities, weekly…, zoneMeta)`; `ActivityRowModel(title, subtitle, stats: List<String>)`; `activityTitle(typeKey, name)`: known keys (`running`, `trail_running`, `walking`, `hiking`, `cycling`, `strength_training`, `multi_sport`) get proper labels, anything else is prettified from the key. `TrainingViewModel(metrics, activities, briefings, clock)`.

- [ ] **Step 0: Docs first.** Compose lists page (`LazyColumn` vs a column of rows inside a scroll: the activity log is capped at 8 so a plain column inside `RefreshableScroll` is fine; record the reasoning). Record pages.
- [ ] **Step 1: Failing tests:** `nullMetricsRenderDashesAndNoRings`; `onlyServerGoalsDrawRings` (steps/floors yes, distance/calories no); `fitnessAgeNeverFallsBackToChronologicalAge`; `unknownActivityTypeGetsAReadableLabel`; `partialActivityShowsDashes`; `trendsHaveEightSectionsInWebOrder` (Training load, weekly volume, fitness age, activity HR, VO₂ max, intensity, steps, calories); `statusSubShowsTheMeasurementDate`; view-model tests as above.
- [ ] **Step 2–4:** FAIL → implement → PASS. **Step 5:** Commit.

### Task 7: Training screen and navigation

**Files:** Create `ui/designsystem/components/{ZoneBars,ActivityRow}.kt`, `ui/training/{TrainingScreen,TrainingRoute,TrainingPreviews}.kt`; Modify `ui/navigation/{Destinations,AppNavigation}.kt` (`Destination.Training`, `BuiltSections += Section.Training`); Test `ui/navigation/NavigationTest.kt`.

Overview order as the web: `PERFORMANCE` (fitness age, acute load), `INTENSITY THIS WEEK` with the 150-minute goal, `HR ZONES`, `DAILY ACTIVITY`, `ACTIVITY LOG`; Trends: eight sections.

- [ ] **Step 0: Docs first.** None new beyond Task 4's chart pages; re-check accessibility for list rows (`semantics { mergeDescendants }`). Record pages.
- [ ] **Step 1: Failing tests:** `openingTrainingKeepsHomeUnderneath`; previews for loaded/partial/error read as PNGs.
- [ ] **Step 2–4:** FAIL → implement → PASS. **Step 5:** Commit; open the PR for `feature/android-training` (Tasks 5–7); CI green; merge.

### Task 8: Settings data layer

**Files:** Modify `data/network/{BactaApi,Dtos}.kt`; Create `data/repository/SettingsRepository.kt`, `domain/SettingsValidation.kt`; Test `data/repository/SettingsRepositoryTest.kt`, `domain/SettingsValidationTest.kt`, `data/network/BactaApiTest.kt`.

**Interfaces:** `BactaApi`: `GET api/settings` → `Map<String,String>`, `PUT api/settings/{key}` (`{value}` → `{ok:true}`; 400 `{error}` for an unknown key or invalid value, which `save` maps to a `ValidationError`; verified in `server/api/settings.ts`), `POST api/settings/test-connection`, `POST api/auth/set-pin` (`SetPinRequest(pin, currentPin?)`), `GET api/logs?source=&limit=` → `LogsDto`, `GET api/logs/sources`. `interface SettingsRepository { suspend fun load(): Result<AppSettings>; suspend fun save(key: SettingKey, value: String): Result<Unit>; suspend fun testConnection(): Result<ConnectionTest>; suspend fun changePin(current: String?, new: String): PinChangeResult; suspend fun logs(source: String?, limit: Int): Result<List<LogEntry>> }`; `enum class SettingKey(val key: String, val secret: Boolean = false)` for only the in-use keys (`ai_provider`, `ai_api_key` secret, `mx4_briefing_model`, `mx4_chat_model`, `mx4_nightly_enabled`, `mx4_nightly_time`, `mx4_on_sync_enabled`, `garmin_background_sync_min`); `SettingsValidation.validate(key, value): ValidationError?` mirrors the server validators in `server/api/settings.ts` exactly (provider set, model regex, `HH:MM`, sync minutes `0` or `>= 15`, key length ≤ 400).

- [ ] **Step 0: Docs first.** Android guidance on settings screens (`kb://android/develop/ui/compose/...` search "settings"), and the server's validators. Record pages.
- [ ] **Step 1: Failing tests:** `validatorsMatchTheServerTable` (every in-use key: accept and reject examples copied from the server's regexes); `secretValuesAreMaskedAndNeverWrittenBack` (a loaded `••••abcd` is not a value; unchanged secret → no PUT); `pinChangeMapsWrongCurrentPinAndFormatErrors` (401 → `WrongCurrent`, 400 → `BadFormat`); `unauthorizedRoutesThroughSessionEvents`; `logsDecodeAndRespectLimit`.
- [ ] **Step 2–4:** FAIL → implement → PASS. **Step 5:** Commit.

### Task 9: Settings screen

**Files:** Create `ui/designsystem/components/{SettingRow,SettingsGroup}.kt`, `ui/settings/{SettingsUiState,SettingsViewModel,SettingsScreen,SettingsRoute,LogsScreen}.kt`; Modify `ui/navigation/{Destinations,AppNavigation}.kt` (`Destination.Settings`), `ui/shell/NavSheet.kt` (a Settings entry below the section list); Test `ui/settings/SettingsViewModelTest.kt`.

Groups: **MX-4** (provider, briefing model, chat model, nightly on/off + time via Material 3 time picker, on-sync on/off, a write-only API key field with a "replace key" action and a "test connection" button), **Garmin** (background sync interval: off or minutes ≥ 15), **Security** (change PIN: current + new 4–12 digits, masked, numeric), **Server** (candidate servers, the one in use, app and server versions), **Logs** (source filter, newest first, limit 50).

**Interfaces:** `SettingsUiState(loading/error, values: Map<SettingKey,String>, edits: Map<SettingKey,String>, saving: Set<SettingKey>, errors: Map<SettingKey,ValidationError>)`; `SettingsViewModel(settings: SettingsRepository, config: ServerConfig, appVersion: String)` with `onEdit(key, value)`, `onSave(key)`, `onChangePin(current, new)`, `onTestConnection()`.

- [ ] **Step 0: Docs first.** Material 3 `Switch`, `TimePicker`, text-field (state-based) pages and the accessibility pages for form controls; the password-field guidance from the login task. Record pages.
- [ ] **Step 1: Failing tests:** `editValidatesBeforeSaving`; `savingOneKeyDoesNotTouchOthers`; `saveFailureKeepsTheEditAndShowsTheError`; `secretFieldStartsEmptyAndSavesOnlyWhenTyped`; `changePinClearsFieldsAndKeepsTheSession` (the server issues a fresh cookie; the jar stores it); `sessionExpiryDuringSaveRoutesToLogin` (reuse the E1 `StartViewModel` test pattern).
- [ ] **Step 2–4:** FAIL → implement → PASS; render previews (loaded, validation error, saving). **Step 5:** Commit; open the PR for `feature/android-settings` (Tasks 8–9); CI green; merge.

### Task 10: On the Fold (owner + phone)

- [ ] **Step 0: Docs first.** Re-read the R8/app-optimization pages if the release build misbehaves; consult the failing library's own rules before changing anything.
- [ ] **Step 1:** Owner pushes tag `android-v0.2.0`; CI builds the R8 release and uploads to Firebase; the owner updates via App Tester.
- [ ] **Step 2: Announce first, then wait for "go".** Verify against the PWA open on the same Fold: every Sleep and Training number and the hypnogram shape; the activity log; trend chart point counts and day labels; Settings round trip with a *harmless* key changed and restored (e.g. the Garmin sync interval), the secret field staying blank, a wrong current PIN rejected (do **not** change the real PIN), logs loading. Compare any mismatch against the database to decide which side is wrong, and file web bugs as issues without real values.
- [ ] **Step 3:** Fix anything found test-first; ship `android-v0.2.1` if needed.
- [ ] **Step 4:** Update `docs/ROADMAP.md` and `docs/OPERATIONS.md` §9; file follow-up issues (info overlays, wake tick on the battery arc, section icons, adaptive layouts, Home/Recovery day labels via `points()`, plan E2b chat).
- [ ] **Step 5:** `git status` shows no new `*.png` outside `android/app/src`, no real values in fixtures or previews.

---

## Self-Review

- **Spec coverage:** §9 Milestone 1 Sleep, Training and the in-use Settings (server URL, AI provider/model/key, MX-4 nightly/on-sync toggles and time, Garmin sync interval, PIN change, version, log viewer) → Tasks 1–9. Chat and "Ask MX-4" → plan E2b (explicitly out of this plan, MX-4 offline). E3 cutover is the owner's call after Task 10.
- **Audit coverage:** each row of the port-audit table maps to a task test (fallbacks → Tasks 3/6; hardcoded goals → Task 6; wrong duration trend → Task 3; day labels → Tasks 1/3; score bands → Task 2).
- **Types/names:** `Band`, `TrendSectionModel`, `briefingState`, `RefreshableScroll`, `Metric`, `Summary`, `SessionEvents` and the card models are defined in E1 and reused verbatim; new names (`TrendPoint`, `SleepRules`, `TrainingRules`, `SettingKey`, `HypnogramModel`) are defined once in Tasks 1, 2, 5, 8, 4.
- **Proportion:** logic is specified by signatures, test names and assertions; no function bodies. Visuals are verified by rendered previews and the owner's on-device comparison.
- **Flagged unverified:** the Garmin sleep-score band edges and `training_load` semantics (verified in Tasks 2 and 5 before encoding); Material 3 `TimePicker` behavior on the pinned BOM.
