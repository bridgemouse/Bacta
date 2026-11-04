# Android Phase E2 (Sleep, Training, Settings) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Android's docs are the source of truth. The web app is only the picture of the finished product to compare against, never a pattern to follow.** Do not translate React code, structure or formulas. For every task: read the Android docs first, build the Android-native way the docs recommend, then judge the result by how it looks and what numbers it shows next to the PWA. Nothing user-visible, tunable or derivable is hardcoded: it comes from the server, from the user's saved preferences, from the system (locale, 12/24 h), or from one named, documented default.

**Goal:** Sleep, Training and Settings screens in the native app, on real, dynamic data, so that with Home and Recovery the owner can run the day-to-day views on the phone. MX-4 chat is a separate plan (E2b): it is a streaming subsystem and MX-4 is offline.

**Architecture:** Same layers as E1 (`docs/superpowers/plans/2026-11-03-android-first-build.md`): repositories over Retrofit, pure `domain` rules, one `@HiltViewModel` per screen exposing `StateFlow<UiState>`, screens rendered from UI models by reusable card templates. E2 adds the pieces that make everything data-driven: string resources, locale-aware formatters, a `MetricCatalog`, table-driven `BandTable` rules, declarative `TrendSpec`/section specs, and DataStore-backed user targets, so a new metric or screen is a table row, not new code.

**Tech Stack:** As E1 (Kotlin 2.4.21, AGP 9.5.0, Compose BOM 2026.09.00, Hilt, Navigation 3, Retrofit 3, kotlinx-serialization, DataStore, JUnit4 + coroutines-test + Turbine + MockWebServer).

**Spec:** `docs/superpowers/specs/2026-11-02-android-native-app-design.md` (§9: Sleep, Training, in-use Settings; chat is E2b). Where Android's docs and the spec or web disagree, the docs win and a ledger `Ruling:` records it.

## Source of truth (applies to every task, read this first)

**Authority order:** 1) Google's Android documentation and each library's own official docs; 2) the end visual (the live PWA, used only to compare the finished screens in Task 12, plus `design_bacta-handoff-package/` for what each screen presents); 3) the existing web code, as a *hint* about which values a screen shows, never about how to build it or which formula to use. A formula or threshold is encoded only after it is checked against a primary source (Garmin's documentation or the live database).

**How to read docs:** `ssh wheat@bacta-android` then `android docs search "<query>"` / `android docs fetch kb://android/<path>` (the same page as `https://developer.android.com/<path>`; the live site wins). If a page 404s, open it in Chromium (Playwright MCP) before giving up. Record every page read for the PR's "Docs consulted".

| Need | Pages (`kb://android/…`) |
|---|---|
| Settings design (what belongs in Settings, defaults, grouping) | `design/ui/mobile/guides/patterns/settings` |
| String resources and localization | `guide/topics/resources/string-resource`, `guide/topics/resources/localization` |
| Dates, numbers, units, 12/24 h (ICU) | `guide/topics/resources/internationalization`, `guide/topics/resources/app-languages` |
| Lists | `develop/ui/compose/lists` |
| Custom drawing and chart performance | `develop/ui/compose/graphics/draw/overview`, `…/draw/modifiers`, `agents/skills/jetpack-compose/jetpack-compose-performance/references/graphics-performance` |
| Accessibility for custom charts and merged cards | `develop/ui/compose/accessibility/semantics`, `…/merging-clearing`, `guide/topics/ui/accessibility/principles` |
| Preferences storage | `topic/libraries/architecture/datastore/index` |
| Text input and password fields | `develop/ui/compose/text/user-input`, `…/migrate-state-based` |
| Pickers (time, dates) | `develop/ui/compose/components/datepickers`, `develop/ui/views/components/pickers` |
| Cleartext and network security config | `privacy-and-security/security-config`, `privacy-and-security/risks/cleartext-communications` |
| Adaptive layouts (for the later Fold pass) | `develop/ui/compose/layouts/adaptive/use-window-size-classes` |
| Architecture, UI state, testing | as listed in the E1 plan's docs index |

## Decisions (Claude's calls from the docs, 2026-11-04; the owner can overrule)

- **No hardcoding, by mechanism not by promise:**
  - *Text* lives in `strings.xml` / `plurals.xml` and is read with `stringResource`/`pluralStringResource` (docs: localization). A ratchet test fails the build if a literal is passed to `Text(` in `ui/`.
  - *Numbers, dates and units* go through locale-aware formatters (ICU), never `String.format("%.1f")` with literal unit text. Units and 12/24 h follow the **system** (settings pattern: "respect system settings … don't replicate or replace settings provided by the system"); there is no app setting for either.
  - *Per-metric facts* (label, unit kind, decimals, lower-is-better, chart kind) live once in `MetricCatalog`.
  - *Thresholds and labels* live in `BandTable`s (data), not `if` chains, with one named default each and a citation.
  - *Goals and targets the system or server cannot supply* (sleep target, weekly intensity goal, daily distance/calorie goals, trend window length) are **user preferences** in DataStore, edited in Settings, with docs-style polite defaults. Server-provided goals (`steps_goal`, `floors_goal`, Garmin's load range) always win over defaults.
  - *Screens* are lists of declarative section specs (`TrendSpec`, rails, tiles) rendered by the templates; adding a metric is a spec row.
  - *Colors and stage/zone colors* come from `BactaPalette`/theme tokens, not literals in screens.
- **Settings content follows the docs:** only infrequently-changed, app-specific preferences (MX-4, Garmin sync, targets, trend window, server choice, security). The app and server **version go in an About surface**, not Settings (pattern page: "avoid information about the app, such as a version number"); the log viewer is a separate diagnostic screen.
- **Servers are user-editable but the platform still gates cleartext:** the server list is a saved preference, but the network-security config (build-time XML) permits cleartext only to the declared hosts. Other hosts must be HTTPS; the UI says so. Docs: `privacy-and-security/security-config`.
- **Chart windows are data-driven:** `points(days)` plus a `TrendWindow` preference (7, 14 or 30 days); captions ("7 DAYS") come from a plurals resource, not literals.
- **Chat is out of this plan** (E2b).

## Global Constraints

- `minSdk 34`, `targetSdk 37`, `compileSdk { version = release(37) { minorApiLevel = 0 } }`, applicationId `io.github.bridgemouse.bacta`, AGP 9.5.0 built-in Kotlin (never apply `org.jetbrains.kotlin.android`).
- Dark UI only; section accents from `BactaPalette.accent(Section)`; text floor 11sp; 48dp touch targets; charts carry screen-reader descriptions.
- No fake numbers or fallbacks: missing data is `null` and renders as a dash; failures are explicit states; no stub briefings.
- The repo is **public** and the data is health data: fixtures and previews use synthetic values only; never commit real values or real-data screenshots; file web-bug issues without real values.
- Work in `worktrees/<name>` on `feature/<name>`; PR + squash-merge with CI green; never commit to `main`; never check out branches in `/opt/bacta`.
- After `git add`, run `git status --ignored` for new source directories (the old `data/` ignore rule is anchored to `/data/`).
- Commit trailer `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`; PR bodies follow `.github/pull_request_template.md`, include **"Docs consulted"** and **"Where this deliberately differs from the web client, and why"**, and end with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.
- Claude cannot create tags; the owner pushes `android-v*`. Announce before anything foregrounds the app on the Fold and wait for "go".

## Port audit: web artifacts we do NOT carry over

| Web artifact | Android decision |
|---|---|
| `?? SLEEP.*` / `TRAINING.*` stub fallbacks, "keep stub on error" (`useSleepData.ts`, `useTrainingData.ts`) | Nulls, explicit `Loading/Content/Error`; a missing hypnogram omits that card. |
| Sleep score bands 85/70; load-ratio bands 0.8/1.3; architecture targets 20%/22%/5% and weights | Checked against Garmin's published ranges and live data, then stored in `BandTable`s/config with a citation; the owner can adjust targets in Settings where they are personal. |
| Hardcoded daily goals (8 km, 2500 kcal, 600 active kcal), intensity goal 150, sleep target 480 | User preferences with polite defaults; server goals (`steps_goal`, `floors_goal`) take precedence; no goal → no ring. |
| Unit text and decimals scattered in JSX and E1 mappings (`"bpm"`, `"br/m"`, `toFixed`) | `MetricCatalog` + locale formatters; distance in km or miles by system locale. |
| Date/time patterns like `MMM d · HH:mm` | Skeleton-based ICU formatting honoring the system 12/24 h setting (`DateFormat.is24HourFormat`). |
| Literal strings in components | `strings.xml`; E1's literals are migrated in Task 1. |
| Stage and zone hex colors in page code | Theme/palette tokens. |
| Duration trend built from deep-sleep seconds | Total sleep (`sleep_s`, else stage sum). |
| Fetches drop dates, so no day labels | `MetricsRepository.points()` keeps dates; bars get real day labels. |
| UTC date math; module caches; window events | Device-local `LocalDate`; repository as single source of truth (as E1). |

## Review Focus

1. **Stale "latest" data.** The summary is the per-metric latest value, so an unrecorded night silently shows an older one. Label the night; mark stale when older than yesterday (Task 5 `staleNightIsLabelled`).
2. **Hypnogram unavailable or malformed.** Omit the card; never draw a default (Task 6 `missingHypnogramOmitsTheCard`).
3. **Garmin local timestamps.** `sleepStartTimestampLocal` is local-as-UTC milliseconds; the device zone must not shift axis labels (Task 4 `axisLabelsIgnoreTheDeviceZone`).
4. **Secrets in Settings.** `GET /api/settings` returns `••••abcd`; writing it back would overwrite the real key. Write-only field, never prefilled, unchanged sends nothing (Task 10 `secretValuesAreMaskedAndNeverWrittenBack`).
5. **Unknown activity types and partial activities.** Readable label and dashes, never blanks or crashes (Task 8 `unknownActivityTypeGetsAReadableLabel`).
6. **Locale and clock.** Units, decimal separators and 12/24 h must follow the device; a German locale or a 12 h clock must not break screens (Task 1 `formattersFollowLocaleAndClockSetting`).
7. **Customization safety.** A cleared or invalid target (0 minutes, negative goal) must fall back to the default, never divide by zero or draw a broken ring (Task 2 `invalidTargetFallsBackToDefault`).

---

### Task 1: String resources, locale-aware formatting, and a hardcoded-text ratchet

**Files:** Create `res/values/{strings,plurals}.xml`, `ui/format/{Formatters,FormatterModule}.kt`, `src/test/.../NoHardcodedUiTextTest.kt`; Modify E1 composables and mappings that contain literals (`ui/home`, `ui/recovery`, `ui/shell`, `ui/gates`, `ui/login`, `ui/briefing`, design-system components), `ui/briefing/BriefingMapping.kt` (timestamps); Test `ui/format/FormattersTest.kt`.

**Interfaces:** `interface Formatters { fun number(v: Double, decimals: Int): String; fun distance(meters: Double): FormattedMeasure; fun duration(seconds: Double): String; fun dateTime(at: Instant, zone: ZoneId): String; fun shortDate(d: LocalDate): String; fun weekdayInitial(d: LocalDate): String }`; `FormattedMeasure(value: String, unit: String)`; provided via Hilt from `Context`, `Locale` and `DateFormat.is24HourFormat`. User-facing strings take `@StringRes`/plurals in models (`MetricCardModel.label: UiText`), where `UiText` is a small sealed type (`Res(id, args)` / `Literal`) so mappings stay unit-testable without a `Context`.

- [ ] **Step 0: Docs first.** Read `string-resource`, `localization`, `internationalization` (ICU skeletons, the 12/24 h note), `app-languages`. Confirm the ICU `NumberFormatter` unit/usage API for distance and how to get the locale's measurement system (`LocaleData.getMeasurementSystem`); record the choice and its cost in a ruling.
- [ ] **Step 1: Failing tests:** `formattersFollowLocaleAndClockSetting` (en-US 12 h vs de-DE 24 h: separators, "km" vs "mi", time pattern); `durationFormatsHoursAndMinutes`; `numberHonorsDecimals`; `NoHardcodedUiTextTest` (fails while any `Text("…")`/`Text(text = "…")` literal remains under `ui/`).
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement formatters; migrate E1 literals to resources and `UiText`; replace the `MMM d · HH:mm` pattern. **Step 4:** Run → PASS (all E1 tests still green; update expectations only where a literal moved to a resource). **Step 5:** Commit.

### Task 2: MetricCatalog, BandTable, TrendSpec and user Targets (the dynamic foundations)

**Files:** Create `domain/{MetricCatalog,BandTable,Targets}.kt`, `data/prefs/{TargetsRepository,PrefsModule}.kt`, `ui/designsystem/components/TrendSpec.kt`; Modify `domain/ReadinessRules.kt`, `ui/recovery/RecoveryMapping.kt`, `ui/home/HomeMapping.kt` to use them; Test `domain/{BandTableTest,TargetsTest}.kt`, `data/prefs/TargetsRepositoryTest.kt`.

**Interfaces:** `BandTable<T>(rows: List<BandRow<T>>)` with `fun select(value: Double?): BandRow<T>?` (descending lower bounds, `null` → `null`); `ReadinessRules` becomes a thin wrapper over named tables with unchanged behavior. `MetricSpec(metric, label: UiText, unit: UnitKind, decimals: Int, lowerIsBetter: Boolean?, chart: TrendKind)` and `MetricCatalog.spec(metric)`. `TrendSpec` is the shared builder that Recovery's private list becomes: rail label, metric, value selector, caption (`UiText`), kind, window. `Targets(sleepMinutes: Int, weeklyIntensityMinutes: Int, distanceMeters: Int?, caloriesTotal: Int?, caloriesActive: Int?, trendDays: Int)` with `Targets.Default` (each value named and cited) and `sanitized()` (invalid → default); `TargetsRepository { val targets: Flow<Targets>; suspend fun update(transform: (Targets) -> Targets) }` over DataStore Preferences.

- [ ] **Step 0: Docs first.** `datastore/index` (Preferences DataStore, testing with a temp file), the settings pattern's "polite defaults" section. Record pages.
- [ ] **Step 1: Failing tests:** `bandTableSelectsOnBothSidesOfEveryBoundary`; `readinessRulesBehaveExactlyAsBefore` (E1's `RulesTest` stays untouched and green); `invalidTargetFallsBackToDefault` (0, negative, absurd, `trendDays` outside {7,14,30}); `targetsPersistAndEmit` (DataStore in a temp dir, Turbine); `recoveryTrendSectionsComeFromSpecs` (same eight sections in the same order as before).
- [ ] **Step 2–4:** FAIL → implement → PASS. **Step 5:** Commit; open the PR for `feature/android-foundations-e2` (Tasks 1–2); CI green; merge.

### Task 3: Data groundwork shared by Sleep and Training

**Files:** Modify `data/network/{BactaApi,Dtos}.kt`, `data/repository/{Models,MetricsRepository}.kt`; Create `data/repository/ActivityRepository.kt`; Test `data/repository/{MetricsPointsTest,ActivityRepositoryTest}.kt`, `data/network/DtoDecodingTest.kt`, fixtures under `src/test/resources/fixtures/`.

**Interfaces:** `TrendPoint(date: LocalDate, value: Double)`; `MetricsRepository.points(metrics: Set<Metric>, days: Int, today: LocalDate = LocalDate.now()): Map<Metric, Result<List<TrendPoint>>>` (concurrent, per-metric isolation; `trends` becomes a thin map over it with unchanged tests). `Metric` gains the sleep/training keys (`sleep_s`, `sleep_deep_s`, `sleep_awake_s`, `sleep_resp`, `sleep_spo2`, `vo2max`, `fitness_age`, `steps`, `calories_total`) each with a `MetricCatalog` entry. `Summary`/`SummaryDto` gain stage seconds, spo2/resp, distance, steps and goals, calories, floors, vo2max, fitness age (+achievable), Garmin load range, `hrZoneMinutes: List<Double?>` (5 slots). `BactaApi` adds `sleep-hypno`, `activities?days=`, `weekly-volume`, `weekly-intensity`, `weekly-avg-hr`. `ActivityRepository` exposes `activities(days)`, `weeklyVolume(weeks)`, `weeklyAvgHr(weeks)`, `weeklyIntensity()` returning `Result`s; `Activity(id, typeKey, name?, start, durationSeconds?, distanceMeters?, avgHr?, calories?)`. Read the real routes in `server/api/garmin.ts`, capture response *shapes* with the internal token, write synthetic fixtures by hand.

- [ ] **Step 0: Docs first.** Data-layer pages from E1 only for changes; record. **Step 1: Failing tests:** `pointsKeepDatesAndDropNullValues`; `trendsStillReturnsPlainValues`; `summaryCarriesSleepAndTrainingFields`; `activitiesDecodeFixtureAndMapToDomain`; `oneWeeklyCallFailingDoesNotFailTheOthers`; `windowComesFromTheArgument` (7/14/30). **Step 2–4:** FAIL → implement → PASS. **Step 5:** Commit.

### Task 4: Sleep domain rules

**Files:** Create `domain/{SleepRules,Hypnogram}.kt`; Test `domain/SleepRulesTest.kt`.

**Interfaces (pure, parameterized by `Targets` where personal):** `SleepRules.scoreBands: BandTable<UiText>`; `debtMinutes(nights: List<Int>, targetMinutes: Int): Int`; `efficiencyPercent(asleepMin, awakeMin): Int?`; `stagePercents(deep, light, rem): List<Int>` (largest remainder, exactly 100); `architecture(deep, rem, awake, total, targets: ArchitectureTargets): Architecture?`; `Hypnogram.axisLabels(startLocalMs, endLocalMs, formatters): List<String>`; `Hypnogram.stage(level: Int): SleepStage?` (live-verified: Garmin 0 deep, 1 light, 2 REM, 3 awake; the server emits `3 - level`).

- [ ] **Step 0: Docs first.** Garmin's own description of sleep score ranges and stages (Chromium on Garmin support), `docs/GARMIN.md`, and a live `sleepLevels` check; ruling on 85/70 (web) vs Garmin's ranges (the app uses Garmin's, stored in a `BandTable`). Android: ICU date formatting for axis labels (Task 1's formatters).
- [ ] **Step 1: Failing tests:** score band boundaries on both sides and `null`; `debtClampsRestedNightsToZero`; `debtUsesTheTargetFromPreferences`; `efficiencyHandlesZeroAndNull`; `stagePercentsAlwaysSumToOneHundred`; `architectureMatchesTheDocumentedFormula` (worked example, `null` when total is 0); `axisLabelsIgnoreTheDeviceZone` (default zone set to America/New_York); `hypnogramLevelMapping`.
- [ ] **Step 2–4:** FAIL → implement → PASS. **Step 5:** Commit.

### Task 5: Sleep mapping and view model

**Files:** Create `data/repository/SleepRepository.kt`, `ui/sleep/{SleepUiState,SleepMapping,SleepViewModel}.kt`; Test `ui/sleep/{SleepMappingTest,SleepViewModelTest}.kt`, `data/repository/SleepRepositoryTest.kt`.

**Interfaces:** `SleepRepository.hypnogram(): Result<Hypnogram?>` (`null` = none); `SleepUiState { Loading, Content(briefing, content: SleepContent, refreshing), Error }`; `toSleepContent(summary, points, hypnogram, targets, formatters, today)` built from `MetricCatalog` and `TrendSpec`s; `SleepViewModel(metrics, briefings, sleep, targets, clock)` combines one `points()` batch, the summary, the hypnogram, the `Section.Sleep` briefing and `targets` flow (reusing `briefingState`).

- [ ] **Step 0: Docs first.** UI-layer state production and the Compose "effects and threading" page (state from several flows); record. **Step 1: Failing tests:** `nullMetricsRenderDashesAndNoStages`; `stagesSumToOneHundred`; `durationTrendUsesTotalSleepNotDeepSleep`; `staleNightIsLabelled`; `vitalsOnlyThoseWithData`; `trendsHaveFiveSectionsFromSpecsWithRealDayLabels`; `changingTheTrendWindowChangesTheRequestAndCaption`; `changingTheSleepTargetChangesDebt`; VM tests (`oneFailureIsIsolated`, `refreshKeepsContent`, `summaryFailureYieldsError`, briefing states). **Step 2–4:** FAIL → implement → PASS. **Step 5:** Commit.

### Task 6: Sleep screen and navigation

**Files:** Create `ui/designsystem/viz/Hypnogram.kt`, `ui/designsystem/components/{StageBreakdown,HypnogramCard}.kt`, `ui/sleep/{SleepScreen,SleepRoute,SleepPreviews}.kt`; Modify `ui/navigation/{Destinations,AppNavigation}.kt` (`Destination.Sleep`, `BuiltSections += Section.Sleep`); Test `ui/navigation/NavigationTest.kt`, `ui/designsystem/HypnogramGeometryTest.kt`.

**Interfaces:** `HypnogramModel(levels: List<SleepStage?>, axisLabels: List<String>)`; `HypnogramCard`, `StageBreakdown`; pure `hypnogramSegments(levels): List<Segment>`; stage colors from `BactaPalette.stage(SleepStage, accent)`. The overview shows, in order: last night (time asleep, in bed, stage chips, score), efficiency and debt, sleep architecture, architecture score, overnight vitals; the trends tab shows the spec-driven sections.

- [ ] **Step 0: Docs first.** `graphics/draw/overview`, `draw/modifiers`, `graphics-performance`, `accessibility/semantics`. **Step 1: Failing tests:** `hypnogramSegmentsMergeRunsAndKeepOrder`; `missingHypnogramOmitsTheCard`; `openingSleepKeepsHomeUnderneath`; render previews (loaded, partial, error; synthetic data) and read the PNGs. **Step 2–4:** FAIL → implement → PASS. **Step 5:** Commit; open the PR for `feature/android-sleep` (Tasks 3–6); CI green; merge.

### Task 7: Training domain rules

**Files:** Create `domain/TrainingRules.kt`; Test `domain/TrainingRulesTest.kt`.

**Interfaces (pure):** `loadState(load, min, max): Band?` (Garmin's own range); `loadRatio(acute, history, bands: BandTable<UiText>): LoadRatio?` (≥ 7 history points, chronic > 0); `zonePercents(minutes): List<Int>?` (largest remainder; `null` for zero total); `ZoneMeta` (labels as resources, colors from palette tokens); `intensityPoints(moderate, vigorous) = moderate + 2 * vigorous`; the weekly goal comes from `Targets`.

- [ ] **Step 0: Docs first.** Verify against live data what `training_load` is (acute load?) and that `hrzone_N_min` is today's minutes (`server/api/garmin.ts`, `docs/GARMIN.md`); Garmin's acute:chronic guidance if the ratio is kept; rulings recorded. **Step 1: Failing tests:** `loadStateBoundaries`; `loadRatioNeedsEnoughHistory`; `loadRatioBandsBothSides`; `zonePercentsSumToOneHundredOrNull`; `intensityCountsVigorousDouble`. **Step 2–4:** FAIL → implement → PASS. **Step 5:** Commit.

### Task 8: Training mapping and view model

**Files:** Create `ui/training/{TrainingUiState,TrainingMapping,TrainingViewModel}.kt`; Test `ui/training/{TrainingMappingTest,TrainingViewModelTest}.kt`.

**Interfaces:** `TrainingContent(performance, intensity: MeterModel?, zones: ZonesModel?, daily: DailyActivityModel, activities: List<ActivityRowModel>, trends: List<TrendSectionModel>)`; `activityTitle(typeKey, name, catalog)` resolves known keys from a resource-backed table and prettifies unknown ones; daily tiles show a ring only when a goal exists (server or `Targets`); distance via `Formatters.distance`.

- [ ] **Step 0: Docs first.** `develop/ui/compose/lists` (a capped list inside the existing scroll column is fine; record why not `LazyColumn`), accessibility for rows. **Step 1: Failing tests:** `nullMetricsRenderDashesAndNoRings`; `onlyKnownGoalsDrawRings`; `distanceFollowsTheLocale` (km vs mi); `fitnessAgeNeverFallsBackToChronologicalAge`; `unknownActivityTypeGetsAReadableLabel`; `partialActivityShowsDashes`; `trendsHaveEightSectionsFromSpecs`; `statusSubShowsTheMeasurementDate`; VM tests as Task 5. **Step 2–4:** FAIL → implement → PASS. **Step 5:** Commit.

### Task 9: Training screen and navigation

**Files:** Create `ui/designsystem/components/{ZoneBars,ActivityRow}.kt`, `ui/training/{TrainingScreen,TrainingRoute,TrainingPreviews}.kt`; Modify `ui/navigation/{Destinations,AppNavigation}.kt` (`Destination.Training`, `BuiltSections += Section.Training`); Test `ui/navigation/NavigationTest.kt`.

The overview shows performance, weekly intensity against the goal, heart-rate zones, daily activity and the activity log; the trends tab shows the spec-driven sections.

- [ ] **Step 0: Docs first.** As Task 6 plus list-row semantics. **Step 1: Failing tests:** `openingTrainingKeepsHomeUnderneath`; previews (loaded, partial, error) rendered and read. **Step 2–4:** FAIL → implement → PASS. **Step 5:** Commit; open the PR for `feature/android-training` (Tasks 7–9); CI green; merge.

### Task 10: Settings data layer

**Files:** Modify `data/network/{BactaApi,Dtos}.kt`; Create `data/repository/SettingsRepository.kt`, `domain/SettingsValidation.kt`; Test `data/repository/SettingsRepositoryTest.kt`, `domain/SettingsValidationTest.kt`, `data/network/BactaApiTest.kt`.

**Interfaces:** `BactaApi`: `GET api/settings` (map), `PUT api/settings/{key}` (`{value}` → `{ok:true}`; 400 `{error}` for an unknown key or invalid value; verified in `server/api/settings.ts`), `POST api/settings/test-connection`, `POST api/auth/set-pin`, `GET api/logs?source=&limit=`, `GET api/logs/sources`. `SettingsRepository { load(); save(key, value); testConnection(); changePin(current?, new): PinChangeResult; logs(source?, limit) }`. `SettingKey(key, secret)` for the in-use server keys only (`ai_provider`, `ai_api_key` secret, `mx4_briefing_model`, `mx4_chat_model`, `mx4_nightly_enabled`, `mx4_nightly_time`, `mx4_on_sync_enabled`, `garmin_background_sync_min`). `SettingsValidation.validate` mirrors the server validators exactly.

- [ ] **Step 0: Docs first.** `settings` design pattern page; the server validators. **Step 1: Failing tests:** `validatorsMatchTheServerTable`; `secretValuesAreMaskedAndNeverWrittenBack`; `pinChangeMapsWrongCurrentPinAndFormatErrors` (401 → `WrongCurrent`, 400 → `BadFormat`); `unauthorizedRoutesThroughSessionEvents`; `logsDecodeAndRespectLimit`; `serverRejectionBecomesAValidationError`. **Step 2–4:** FAIL → implement → PASS. **Step 5:** Commit.

### Task 11: Settings, About and Logs screens

**Files:** Create `ui/designsystem/components/{SettingRow,SettingsGroup}.kt`, `ui/settings/{SettingsUiState,SettingsViewModel,SettingsScreen,SettingsRoute}.kt`, `ui/about/AboutScreen.kt`, `ui/logs/{LogsScreen,LogsViewModel}.kt`; Modify `ui/navigation/{Destinations,AppNavigation}.kt`, `ui/shell/NavSheet.kt` (secondary entries: Settings, Logs, About); Test `ui/settings/SettingsViewModelTest.kt`.

Settings groups (docs: grouped, polite defaults, only app-specific and infrequent): **MX-4** (provider, models, nightly toggle and time via the Material 3 time picker honoring the system clock, on-sync toggle, write-only API key, test connection), **Garmin** (background sync interval: off or minutes ≥ 15), **Targets** (sleep target, weekly intensity goal, optional daily goals, trend window: the `Targets` preferences from Task 2), **Servers** (saved servers and which is in use; non-allowlisted cleartext is explained and blocked), **Security** (change PIN: current + new, masked, numeric). **About** shows the app and server versions. **Logs** has a source filter and a newest-first list.

- [ ] **Step 0: Docs first.** `settings` pattern, `datepickers`/`pickers`, `text/user-input` (secure field), `security-config` (cleartext limits). **Step 1: Failing tests:** `editValidatesBeforeSaving`; `savingOneKeyDoesNotTouchOthers`; `saveFailureKeepsTheEditAndShowsTheError`; `secretFieldStartsEmptyAndSavesOnlyWhenTyped`; `changingATargetUpdatesTheScreensThatUseIt` (Targets flow reaches the Sleep VM); `changePinKeepsTheSession` (the new cookie is stored); `sessionExpiryDuringSaveRoutesToLogin`; `cleartextHostOutsideTheAllowlistIsRejectedWithAnExplanation`. **Step 2–4:** FAIL → implement → PASS; render previews (loaded, validation error, saving). **Step 5:** Commit; open the PR for `feature/android-settings` (Tasks 10–11); CI green; merge.

### Task 12: On the Fold (owner + phone)

- [ ] **Step 0: Docs first.** Re-read the R8/app-optimization pages if the release build misbehaves; consult the failing library's own rules before changing anything.
- [ ] **Step 1:** Owner pushes tag `android-v0.2.0`; CI builds the R8 release and uploads to Firebase; the owner updates via App Tester.
- [ ] **Step 2: Announce first, then wait for "go".** Verify against the PWA open on the same Fold: every Sleep and Training number and the hypnogram shape; trend point counts and day labels; the activity log; Settings round trip with a *harmless* key changed and restored; secret field staying blank; wrong current PIN rejected (never change the real PIN); targets changing a ring or the debt immediately; a different trend window; the device in 12 h and 24 h clock settings. For any mismatch, query the database to decide which side is wrong; file web bugs without real values.
- [ ] **Step 3:** Fix anything found test-first; ship `android-v0.2.1` if needed.
- [ ] **Step 4:** Update `docs/ROADMAP.md` and `docs/OPERATIONS.md` §9; file follow-up issues (info overlays, wake tick on the battery arc, section icons, adaptive layouts, plan E2b chat, Home/Recovery day labels via `points()`).
- [ ] **Step 5:** `git status` shows no new `*.png` outside `android/app/src`, no real values in fixtures or previews; `NoHardcodedUiTextTest` still green.

---

## Self-Review

- **Spec coverage:** §9 Sleep, Training and the in-use Settings → Tasks 3–11; the server URL setting is covered by the Servers group under the platform's cleartext limits; the version moves to About per the settings pattern. Chat → plan E2b. Cutover (E3) is the owner's call after Task 12.
- **Docs/web discipline:** every task has a Step 0 naming pages; the web appears only in the port audit and the Task 12 comparison; each formula is checked against Garmin's docs or live data before being encoded (Tasks 4, 7).
- **No hardcoding:** strings (Task 1), formatting and units (Task 1), per-metric facts, bands, specs and targets (Task 2), colors via tokens (Tasks 6, 9), servers and goals editable (Task 11). The ratchet test enforces the text rule.
- **Audit coverage:** each row of the port-audit table maps to a task test.
- **Types/names:** `Band`, `TrendSectionModel`, `briefingState`, `RefreshableScroll`, `Metric`, `Summary`, `SessionEvents` come from E1 and are reused verbatim; `UiText`, `Formatters`, `MetricCatalog`, `BandTable`, `Targets`, `TrendPoint`, `SettingKey` are defined once (Tasks 1, 1, 2, 2, 2, 3, 10).
- **Proportion:** logic is specified by signatures, test names and assertions; no function bodies.
- **Flagged unverified:** Garmin sleep-score band edges and `training_load` semantics (verified in Tasks 4 and 7 before encoding); ICU `NumberFormatter` unit support and the locale measurement-system API (Task 1); Material 3 time-picker behavior on the pinned BOM (Task 11).
