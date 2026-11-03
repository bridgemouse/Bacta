# Android First Build (Phase E1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A real Bacta Android app on the owner's Fold that does what the PWA's core does today for PIN login, Home and Recovery (Overview + Trends), looking like the existing design, built the way Google recommends and from reusable card templates. Sleep, Training, MX-4 chat and Settings are Phase E2.

**Architecture:** Google's layered architecture in one Gradle module: a UI layer (Compose screens, one `@HiltViewModel` per screen exposing a `StateFlow<UiState>`, plain state holders inside reusable components), a data layer (repositories over Retrofit/OkHttp and DataStore), and a small `domain` package for business rules extracted from the PWA's page code. Screens are lists of UI models rendered by a small set of reusable card templates, so adding a metric means adding a model, not a composable.

**Tech Stack:** Kotlin 2.4.21, AGP 9.5.0, Compose BOM 2026.09.00 + Material 3, Hilt 2.60.1 + KSP 2.3.13, Navigation 3 1.2.0, Lifecycle 2.11.0, Retrofit 3.0.0 + OkHttp 5.5.1 + kotlinx-serialization-json 1.12.0, DataStore 1.3.0, JUnit4 + kotlinx-coroutines-test 1.11.0 + Turbine 1.2.1 + MockWebServer 5.5.1. All versions confirmed to exist on 2026-11-03; the Hilt/KSP/Retrofit/DataStore/Navigation 3/lifecycle set was **built together on AGP 9.5.0 in a scratch project** (`assembleDebug` + `testDebugUnitTest` passed; debug APK 34.6 MB).

**Spec:** `docs/superpowers/specs/2026-11-02-android-native-app-design.md` (Milestone 1; §9 scope, §8 design source). This plan adds the architecture decisions below, which the spec left open. Builds on `docs/superpowers/plans/2026-11-02-android-foundation.md` and `2026-11-03-firebase-app-distribution.md`.

## Decisions (Claude's calls from Google's docs, 2026-11-03; the owner can overrule)

Sources: `kb://android/topic/architecture/recommendations`, `…/designsystems/custom`, `…/text/fonts`, `…/navigation-3/*`, the installed `navigation-3`, `adaptive`, `edge-to-edge`, `testing-setup` skills.

- **Follow Google's "strongly recommended" list:** clear data layer and UI layer; repositories expose data; coroutines and Flow; unidirectional data flow; AAC ViewModels **at screen level only**; plain state-holder classes in reusable components; lifecycle-aware collection (`collectAsStateWithLifecycle`); no ViewModel-to-UI events (handle in the ViewModel, expose state); single activity with Navigation 3; dependency injection (**Hilt**); test with fakes not mocks; test `StateFlow`s; R8 in release. This reverses my earlier "no DI" default.
- **Theming:** extend `MaterialTheme` (dark `ColorScheme`, custom `Typography` and `Shapes`, plus a `CompositionLocal` of Bacta tokens) per Google's "Extend Material theming", instead of a fully custom system. Material keeps accessibility, text selection and edge-to-edge behavior for free.
- **Reusable templates:** each card kind is one stateless composable taking a UI model (`MetricCard`, `TrendCard`, `HeadlineCard`, `StatusTile`, `GaugeCard`, `BriefingCard`, `SectionRail`, `StateMessage`). Screens map data to lists of models. A preview "catalog" file renders every template in every state and is the living reference.
- **Fonts:** bundle Hanken Grotesk and JetBrains Mono in `res/font` (Google's Compose fonts page); both are SIL OFL, license text kept beside the files.
- **Icons:** vector drawables / `ImageVector`, not the web's emoji (`SECTION_ICONS`), which render differently per device font.
- **Storage:** DataStore for the server config and the session cookie; the cookie is encrypted with an Android Keystore key (Keystore keys are non-extractable). The Keystore class cannot run in JVM unit tests, so it is verified on the phone.
- **Not decided by Google's docs:** the network stack. Retrofit + OkHttp + kotlinx-serialization is the common choice, not a Google requirement.
- **Deferred (strongly recommended but needs a device harness):** Baseline Profiles and Macrobenchmark. Enable R8 now; add profiles in a later plan.

## Port audit: web artifacts we do NOT carry over

| Web artifact (file) | Android decision |
|---|---|
| Fake fallback values: `?? 74`, `?? 82`, `?? 342`, `STUB` tiles (`useHomeData.ts`), `INITIAL = {...RECOVERY}` stub (`useRecoveryData.ts`) | No fake numbers anywhere. Missing data is `null` and renders as `—`; loading is a skeleton. |
| "Keep stub on error" (`catch { // keep stub }`) hides failures behind fake data | Explicit `Loading / Content / Error(retry)` UI states; partial failures degrade one card, not the screen. |
| Hardcoded Home sparklines `[50,54,49,…]`, `[280,300,…]` (`HomePage.tsx`) | Real 7-day trend from the API, or no sparkline. |
| Hardcoded status words `'Good'`, `'Solid'`, `'On track'` | Derived from rules in `domain` (with tests) or omitted. |
| `BRIEFS` stub briefings (`stubData.ts`); **server returns `STUB_BRIEFINGS` with no `generated_at` when no real briefing exists** | Stub detected by the missing `generated_at` and shown as "No briefing yet"; stale (older than 36 h) and MX-4-offline states are explicit; a stub is never shown as MX-4 speaking. |
| Business rules inside page JSX (battery bands, recovery-time bands, HRV slope) | One `domain` file per rule set, unit-tested. |
| `fetchTrend` builds dates with `toISOString()` (UTC) | Device-local `LocalDate`; tested around local midnight. |
| `window` event `bacta:sync-complete`, module-level `sectionDataCache` | Repository holds the data (single source of truth) and `refresh()`; pull-to-refresh. |
| Emoji icons, Nutrition tile, two "calibrating" placeholder tiles on Home | Vector icons; only built sections appear; the "N ONLINE" counter is computed. |
| 11 sequential-feeling per-metric calls on Recovery | Fetched concurrently (`coroutineScope` + `async`) inside the repository. A batch endpoint is a possible later server change, out of scope. |

## Global Constraints

- Android: `minSdk 34`, `compileSdk { version = release(37) { minorApiLevel = 0 } }`, `targetSdk 37`, application id `io.github.bridgemouse.bacta`; never apply `org.jetbrains.kotlin.android` (AGP 9 built-in Kotlin); Compose plugin `org.jetbrains.kotlin.plugin.compose` stays.
- **Dark UI only.** Tokens are the `client/src/theme.ts` values (base `#0f1117`, surface `#111827`, surfaceElevated `#1e2d3d`, line `#27384a`, text `#f4f7fb`, MX-4 `#2bc4e8`; accents home `#2bc4e8`, recovery `#64b5f6`, training `#fb923c`, sleep `#a78bfa`). Card heights: hero 220, chart 170, bar 140, pair 110, tile 88, row 52 dp.
- Content is capped at `widthIn(max = 480.dp)` and centered (apps targeting 37 cannot opt out of large-screen resizing); edge-to-edge with an explicit dark `SystemBarStyle` and `safeDrawingPadding()`.
- Cleartext HTTP only to `bacta.home` and `192.168.1.119`; the local-network permission gate from the Hello World stays (requested only on API 37+).
- **The repository is public and the data is health data.** Test fixtures use synthetic values with the real JSON shape; real values, real briefing text and real-data screenshots are never committed (`*.png` is gitignored outside `android/app/src`; keep reference captures out of git).
- Server and web app are unchanged. The server accepts `Authorization: Bearer $BACTA_INTERNAL_TOKEN`; Claude may use it read-only to inspect response *shapes*, never to copy values into the repo.
- Branches `feature/android-<topic>` in `worktrees/<name>`; PR each; squash-merge; never commit to `main`; never switch branches in `/opt/bacta`. `git branch -D` is denied for Claude, and Claude cannot push tags (the owner tags releases).
- Commit messages end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`; PR bodies follow `.github/pull_request_template.md` and end with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.
- **Device rule:** before anything that foregrounds an app on the Fold, tell the owner what is about to happen and wait for "go". Prefer `uiautomator`/`pm` over asking the owner to tap.
- Build/test on the dev VM: `bash scripts/android-build.sh build testDebugUnitTest assembleDebug`; render previews with `android preview render <module> --fqn <fn> --output <dir>`; `ANDROID_HOME` and JDK 17 are set on the VM.

## Review Focus

1. **Session rejected mid-use (HTTP 401):** the app returns to the PIN screen once, with the PIN field ready, instead of spinning forever or showing stale or fake data. The server's tokens are stateless, so a session cannot be revoked on demand; this is proven by tests, not on the phone. (Task 3 interceptor test; Task 6 gate test.)
2. **No real briefing / MX-4 offline / stale briefing:** the card says so plainly and shows the last real briefing's age; a server stub is never rendered as MX-4's words. (Tasks 4, 5 and 8 tests.)
3. **Partial data:** one metric missing or one trend call failing leaves the other cards intact and shows `—` in the affected one. (Tasks 4, 8 and 9.)
4. **Cannot reach the server** (off-LAN, server down), **local-network permission denied**, or **app older than the server's `minApp`:** each shows its own clear full-screen message. (Task 6.)
5. **Real health data leaking into the public repo** via fixtures, previews or screenshots. (Task 3 fixture rule; Task 9 verification checklist.)

## File Structure

Root package `io.github.bridgemouse.bacta` under `android/app/src/main/kotlin/…`; tests mirror it under `android/app/src/test/kotlin/…`.

| Path | Responsibility |
|---|---|
| `BactaApp.kt`, `MainActivity.kt` | `@HiltAndroidApp`; single `@AndroidEntryPoint` activity hosting navigation |
| `data/network/` | `BactaApi` (Retrofit), DTOs, `SessionCookieJar`, `SessionStore` (+ Keystore-backed implementation), `BaseUrlInterceptor`, `ServerConfig`, `NetworkModule` |
| `data/repository/` | `AuthRepository`, `MetricsRepository`, `BriefingRepository`, `ServerRepository` (interfaces + `Default…` implementations) and domain models |
| `domain/` | `Section`, `Tone`, `ReadinessRules`, `HrvTrend`, `TrainingStatus`, `Freshness` |
| `ui/designsystem/` | `BactaTheme`, tokens, `Type`, `Shapes`, background texture, card templates, viz primitives, `Catalog.kt` previews |
| `ui/navigation/` | `NavKey` destinations, `AppNavigation`, `StartGate` resolver |
| `ui/shell/` | `BactaScaffold` (status bar, dock, nav sheet), `SectionTabState` |
| `ui/login/`, `ui/home/`, `ui/recovery/` | `…Screen` (stateless), `…Route` (ViewModel wiring), `…ViewModel`, `…UiState`, mapping to card models |
| `res/font/` | Hanken Grotesk, JetBrains Mono, license files |

## Branch / PR plan

| Branch (`worktrees/<name>`) | Tasks |
|---|---|
| `docs/android-first-build-plan` | 0 |
| `feature/android-stack` | 1 |
| `feature/android-design-system` | 2, 5 |
| `feature/android-data` | 3, 4 |
| `feature/android-shell-login` | 6, 7 |
| `feature/android-home-recovery` | 8, 9 |
| *(owner tag + phone)* | 10 |

Tasks 2 and 3 are independent of each other; every other task consumes earlier ones as noted in its Interfaces.

---

### Task 0: Land this plan

- [ ] **Step 1:** Rebase `docs/android-first-build-plan`, push, open a docs-only PR `docs: Android first-build plan (Phase E1)`, wait for CI, squash-merge.

---

### Task 1: Build stack and application skeleton

**Files:** Modify `android/gradle/libs.versions.toml`, `android/build.gradle.kts`, `android/app/build.gradle.kts`, `AndroidManifest.xml`, `MainActivity.kt`; Create `BactaApp.kt`, `domain/Section.kt`, `domain/Tone.kt`; Test `ManifestTest.kt`, `domain/SectionTest.kt`.

**Interfaces:** Produces the version catalog entries and plugins (`ksp`, `hilt`, `kotlin-serialization`) every later task uses; `BactaApp`; `MainActivity` as the single `@AndroidEntryPoint` activity that calls `setContent { }` with a placeholder; and the two pure domain enums everything else shares: `enum class Section(val key: String, val label: String) { Home("home", "Home"), Recovery("recovery", "Recovery"), Training("training", "Training"), Sleep("sleep", "Sleep") }` (`key` is the API section id) and `enum class Tone { Positive, Caution, Flag }`.

- [ ] **Step 1: Write the failing tests.** Extend `ManifestTest` with `applicationClassIsBactaApp` (manifest `android:name` is `.BactaApp`); keep the existing permission and cleartext assertions unchanged. `SectionTest`: `keysAreTheApiSectionIds` (`home`, `recovery`, `training`, `sleep`) and `labelsMatchTheWebTheme` (`Home`, `Recovery`, `Training`, `Sleep`).
- [ ] **Step 2:** Run `bash scripts/android-build.sh build testDebugUnitTest` → FAIL on the new test.
- [ ] **Step 3:** Add the Tech Stack versions to the version catalog (no inline versions in build files); apply plugins `com.google.devtools.ksp`, `com.google.dagger.hilt.android`, `org.jetbrains.kotlin.plugin.serialization`; add dependencies (Hilt + `ksp` compiler, `hilt-navigation-compose`, Retrofit + converter + OkHttp + serialization, DataStore, lifecycle-viewmodel-compose, lifecycle-runtime-compose, navigation3 ui/runtime, lifecycle-viewmodel-navigation3, test libraries). Create `BactaApp`; set it in the manifest. Enable R8 for `release` (`isMinifyEnabled = true`, `isShrinkResources = true`) with the keep rules the libraries' docs require, in `proguard-rules.pro`.
- [ ] **Step 4:** Same command → PASS (previous 8 tests + the new ones). Then `bash scripts/android-build.sh build assembleRelease` succeeds (unsigned is fine here); note that R8 correctness is proven on the phone in Task 10.
- [ ] **Step 5:** Commit `build(android): add Hilt, Retrofit, DataStore, Navigation 3 and application class`; PR; CI green; merge.

---

### Task 2: Design-system foundation

**Files:** Create `ui/designsystem/{BactaTheme,Tokens,Type,Shapes,Texture}.kt`, `res/font/*` (+ `OFL` license files); Test `ui/designsystem/TokensTest.kt`. Modify/retire `BactaColors.kt` (tokens move into `Tokens.kt`; `BactaColorsTest` is replaced by `TokensTest` with the same assertions).

**Interfaces:**
- Produces: `BactaTheme(content)` (dark Material 3 scheme + `LocalBactaTokens`); `object BactaTokens { val surface…, fun accent(section: Section): Color, fun tone(tone: Tone): Color }` (consuming `Section` and `Tone` from Task 1); `enum class CardSize(val height: Dp)`; `Modifier.bactaTexture(accent: Color)` (scanlines + grid, ported from `client/src/lib/bactaTexture.ts`); `FontFamily` objects `HankenGrotesk`, `JetBrainsMono`.
- Consumed by: Tasks 5–9.

- [ ] **Step 1: Failing tests.** `TokensTest`: every color and accent equals the Global Constraints values (as the old `BactaColorsTest` asserted); `CardSize` heights are 220/170/140/110/88/52; `accent(Section.Recovery)` is `#64b5f6`; `tone(Tone.Flag)` is `#f87171`, `Caution` `#fbbf24`, `Positive` `#4ade80`.
- [ ] **Step 2:** Run the unit tests → FAIL (unresolved references).
- [ ] **Step 3:** Implement tokens, theme, typography and shapes; obtain the two font families from the official `google/fonts` repository into `res/font` with the weights the web uses, and confirm each family's SIL OFL license file is present before committing; port the texture.
- [ ] **Step 4:** Run the unit tests → PASS. Add `@Preview ThemeSwatch` and render it: `android preview render app --fqn …ThemeSwatchKt.ThemeSwatch --output /tmp/e1/swatch`; view the PNG and confirm colors, both fonts and the texture are visible.
- [ ] **Step 5:** Commit; the PR for this branch opens after Task 5.

---

### Task 3: Network layer

**Files:** Create `data/network/{BactaApi,Dtos,SessionStore,KeystoreSessionStore,SessionCookieJar,BaseUrlInterceptor,ServerConfig,UnauthorizedInterceptor,NetworkModule}.kt`; Test `data/network/*Test.kt` with fixtures under `src/test/resources/fixtures/` (synthetic values, real shape).

**Interfaces:**
- Produces `BactaApi` (Retrofit): `GET api/version`, `GET api/auth/status`, `POST api/auth/login` (`LoginRequest(pin)` → `OkDto`), `POST api/auth/logout`, `GET api/garmin/summary` → `SummaryDto`, `GET api/garmin/{metric}?from&to` → `TrendDto`, `GET api/insights/{section}` → `BriefingDto`; all DTOs `@Serializable`, `snake_case` via `@SerialName`, `Json { ignoreUnknownKeys = true }`.
- `interface SessionStore { val cookie: Flow<String?>; suspend fun save(cookie: String); suspend fun clear() }`; `KeystoreSessionStore` encrypts with AES-GCM under an Android Keystore key and persists via DataStore.
- `ServerConfig` holds candidate base URLs (`http://bacta.home`, `http://192.168.1.119:3001`) and the chosen one; `BaseUrlInterceptor` rewrites scheme/host/port per request.
- `UnauthorizedInterceptor` turns HTTP 401 on non-auth endpoints into a `SessionExpiredException` and emits on `SessionEvents.expired: SharedFlow<Unit>` (state, not a UI event: the ViewModels observe it through the repository).

- [ ] **Step 1: Failing tests** (MockWebServer + an in-memory `FakeSessionStore`):
  - `loginStoresCookieAndLaterRequestsSendIt` — response `Set-Cookie: bacta_session=abc; HttpOnly` is saved and the next request carries `Cookie: bacta_session=abc`.
  - `baseUrlInterceptorRewritesHostAndPort` — a request built against a placeholder host reaches the MockWebServer.
  - `http401OnDataEndpointRaisesSessionExpiredAndEmitsOnce`; `http401OnLoginIsAWrongPinNotASessionExpiry`.
  - `summaryDtoDecodesFixture` / `trendDtoDecodesFixture` / `briefingDtoDecodesFixtureWithAndWithoutGeneratedAt` — decode fixtures; unknown fields ignored; absent numeric fields become `null`.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3: Implement.** Capture JSON *shapes* from the running server with the internal token for reference, then write synthetic fixtures by hand. `KeystoreSessionStore` is a thin class around the Keystore cipher and is not unit-tested.
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit; PR opens after Task 4.

---

### Task 4: Repositories and domain rules

**Files:** Create `data/repository/{AuthRepository,MetricsRepository,BriefingRepository,ServerRepository}.kt` (+ `Default…`), `domain/{ReadinessRules,HrvTrend,TrainingStatus,Freshness}.kt`, `data/repository/Models.kt`; Test `…Test.kt` per file with fakes (hand-written, no mocking library).

**Interfaces:**
- `data class Summary(...)` (nullable doubles for the metrics Home/Recovery use); `enum class Metric(val key: String)` with the keys listed in `useRecoveryData.ts`: `hrv`, `resting_hr`, `stress_avg`, `stress_max`, `resp_avg`, `spo2_avg`, `recovery_score`, `recovery_time_h`, `body_battery_wake`, `sleep_hr`, `sleep_stress`; plus those Home needs (`sleep_score`, `training_load`).
- `interface MetricsRepository { suspend fun summary(): Result<Summary>; suspend fun trends(metrics: Set<Metric>, days: Int = 7, today: LocalDate = LocalDate.now()): Map<Metric, Result<List<Double>>> }` (concurrent; one metric failing does not fail the others).
- `data class Briefing(tone: Tone, headline: String, summary: String?, body: String, recommendation: String, flags: List<String>, generatedAt: Instant, model: String?)`; `interface BriefingRepository { suspend fun briefing(section: Section): Result<Briefing?> }` where `null` means "server sent its stub (no `generated_at`)".
- `interface AuthRepository { suspend fun status(): Result<AuthStatus>; suspend fun login(pin: String): LoginResult; suspend fun logout() }` with `AuthStatus(configured, authed)` and `sealed interface LoginResult { Success, WrongPin, Failure }`.
- `interface ServerRepository { suspend fun compatibility(appVersion: String): Compatibility }` with `Ok / AppTooOld(minApp) / Unreachable`.
- `domain`: `ReadinessRules.scoreLabel(score: Double?): String?` (Optimal ≥ 80, Ready ≥ 67, then the lower bands exactly as `useRecoveryData.ts` lines ~150–160); `batteryBand(now: Double?)` (HIGH ≥ 75, MODERATE ≥ 50, LOW ≥ 25, else CRITICAL; tone green/amber/red as `RecoveryPage.tsx` 156–163); `recoveryTimeBand(hours: Double?)` (READY NOW 0, FRESH ≤ 24, RECOVERING ≤ 48, else HEAVY LOAD; position = hours / 72 clamped); `HrvTrend.direction(series: List<Double>)` (linear-regression slope, ported from `useRecoveryData.ts`); `TrainingStatus.label(n: Double?)` (table from `garminApi.ts` `TRAINING_STATUS`); `Freshness.of(generatedAt: Instant, now: Instant)` → `Fresh / Stale` (stale after 36 h).

- [ ] **Step 1: Failing tests:**
  - `trendsFetchesConcurrentlyAndIsolatesFailures` (fake API: one metric throws, others return; result map has one failure and the rest values).
  - `trendRangeUsesDeviceLocalDate` (`today` = 2026-11-03 local; range is 2026-10-27..2026-11-03; a UTC-vs-local midnight case).
  - `briefingWithoutGeneratedAtIsNull`; `briefingWithGeneratedAtMapsAllFields`.
  - `loginMapsWrongPinAndNetworkFailure`; `compatibilityDetectsAppTooOldBySemver` (`0.9.0` < `0.10.0`).
  - Domain tables: each band boundary on both sides (79/80, 66/67, 74/75, 49/50, 24/25, 0, 24/25 h, 48/49 h), `null` → `null`; `HrvTrend` rising/flat/falling/too-short series; `Freshness` at 35 h and 37 h; `TrainingStatus` for 0–10 and `null`.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement (concurrency with `coroutineScope { map { async { … } }.awaitAll() }`; semver compare numeric, not lexical). **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit; open the PR for `feature/android-data` (Tasks 3 + 4); CI green; merge.

---

### Task 5: Reusable card templates and viz primitives

**Files:** Create `ui/designsystem/components/{BactaCard,MetricCard,TrendCard,HeadlineCard,StatusTile,GaugeCard,BriefingCard,SectionRail,StateMessage}.kt`, `ui/designsystem/viz/{Sparkline,BarsChart,Ring,Gauge,DeltaChip,StatusCore,MX4Sigil}.kt`, `ui/designsystem/Catalog.kt`; Test `…/ModelsTest.kt`.

**Interfaces (all stateless; models are plain `data class`es in `ui/designsystem/components/Models.kt`):**
- `BactaCard(size: CardSize, accent: Color, modifier, onClick: (() -> Unit)? = null, content: @Composable ColumnScope.() -> Unit)` — surface, border, texture, optional accent frame; the base of every template.
- `MetricCardModel(label: String, value: String?, unit: String?, sub: String?, tone: Tone?, trend: List<Double>?)` → `MetricCard`; `TrendCardModel(label, value, unit, series: List<Double>, kind: TrendKind { Line, Bars }, delta: Delta?, lowerIsBetter: Boolean)` → `TrendCard`; `HeadlineModel` → `HeadlineCard`; `StatusTileModel(label, value, unit, statusLabel, tone)` → `StatusTile`; `GaugeModel(value: Double?, max: Double, label, sub)` → `GaugeCard`; `BriefingModel(state: BriefingState { Loading, Live(briefing, freshness), NoBriefing, Offline, Error }, …)` → `BriefingCard`; `SectionRail(label, right: String?, accent)`; `StateMessage(kind: Loading/Empty/Error, message, onRetry)`.
- `value == null` renders `—` in every template. Formatting helpers live in `ModelsTest`-covered pure functions (`formatValue`, `deltaDirection`).
- `MX4Sigil(mood: SigilMood, size: Dp)` ports the web sigil moods used in M1 (`transmit`, `idle`, `think`, `pleased`) with Compose `Canvas` + `rememberInfiniteTransition`; the animation respects the system "remove animations" setting.
- `Catalog.kt`: a `@Preview` per template per state (loaded, null value, long text, each tone).

- [ ] **Step 1: Failing tests** (`ModelsTest`): `formatValueRendersDashForNull`, `formatValueRoundsLikeTheWeb` (e.g. 74.0 → `74`, 7.46 → `7.5` where the web uses one decimal), `deltaDirectionRespectsLowerIsBetter`, `briefingStateFromFreshnessAndNullability`.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement helpers and composables. **Step 4:** Unit tests PASS.
- [ ] **Step 5: Visual check.** Render the catalog previews to PNG on the VM; also screenshot the design handoff prototype `design_bacta-handoff-package/Bacta - Prototype v3.html` with Playwright (stub data, no auth, no PHI; keep PNGs out of git); view each pair and fix visible differences (spacing, type, colors, animation). Record the checked templates in the PR description.
- [ ] **Step 6:** Commit; open the PR for `feature/android-design-system` (Tasks 2 + 5); CI green; merge.

---

### Task 6: App shell, navigation and gates

**Files:** Create `ui/shell/{BactaScaffold,SectionTabState,NavSheet,AskDockButton}.kt`, `ui/navigation/{Destinations,AppNavigation,StartGate}.kt`, `ui/gates/{PermissionGate,ServerMessageScreens}.kt`; Modify `MainActivity.kt`; Test `StartGateTest.kt`, `SectionTabStateTest.kt`.

**Interfaces:**
- `sealed interface Destination : NavKey { Login, Home, Recovery }` (Navigation 3 `NavKey`s; back stack from `rememberNavBackStack`).
- `fun resolveStart(permission: PermissionState, compat: Compatibility, auth: Result<AuthStatus>): StartDestination` with `StartDestination { NeedsLocalNetwork, AppTooOld(minApp), ServerUnreachable, Login, Home }`.
- `class SectionTabState { var tab: Tab { Overview, Trends }; fun reset() }` — a plain state holder (not a ViewModel), reset when the section changes.
- `BactaScaffold(section: Section, tabs: Boolean, content)` — top status bar (`BACTA·OS` + idle sigil, or back + section label), bottom dock (Ask MX-4 button disabled with "Phase E2" no-op, Overview/Trends toggle, nav button), `ModalBottomSheet` nav sheet listing built sections only; back gesture uses Navigation 3's back stack.

- [ ] **Step 1: Failing tests:** `resolveStart` table — permission missing → `NeedsLocalNetwork` before anything else; compat `AppTooOld` → `AppTooOld`; unreachable → `ServerUnreachable`; configured+not authed → `Login`; configured+authed → `Home`; **not configured → `Home`** (open box, as the web); auth status failure → `ServerUnreachable`, never `Home`. `SectionTabState` resets on section change. A 401 emission (Task 3 `SessionEvents`) routes to `Login` exactly once.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement; the login gate follows the Navigation 3 conditional-navigation recipe (`~/.claude/skills/navigation-3/references/android/guide/navigation/navigation-3/recipes/conditional.md`) and ViewModel wiring follows `recipes/modular-hilt.md`; confirm `hiltViewModel()` with Navigation 3's entry decorators compiles at the pinned versions before building on it. Move the Hello World permission logic into `PermissionGate` (`localNetworkPermissionRequired` stays and keeps its test). **Step 4:** PASS; render previews of the scaffold and the three gate screens.
- [ ] **Step 5:** Commit.

---

### Task 7: Login screen

**Files:** Create `ui/login/{LoginScreen,LoginRoute,LoginViewModel,LoginUiState}.kt`; Test `LoginViewModelTest.kt`.

**Interfaces:** `LoginUiState(pin: String, busy: Boolean, error: LoginError?, done: Boolean)`; `LoginViewModel(auth: AuthRepository)` exposing `state: StateFlow<LoginUiState>`, `onPinChanged(String)`, `onSubmit()`; `LoginError { WrongPin, Connection }`.

- [ ] **Step 1: Failing tests** (fake `AuthRepository`, Turbine): `pinKeepsOnlyDigitsAndCapsAtTwelve`; `submitIsIgnoredBelowFourDigits`; `wrongPinSetsErrorAndClearsPin`; `successSetsDone`; `networkFailureSetsConnectionErrorAndKeepsPin`; `typingClearsTheError`.
- [ ] **Step 2–4:** FAIL → implement (numeric keyboard, password masking, the web's copy: "Locked — enter PIN", `Unlock`) → PASS; render `LoginScreen` previews for idle, error, busy.
- [ ] **Step 5:** Commit; open the PR for `feature/android-shell-login` (Tasks 6 + 7); CI green; merge.

---

### Task 8: Home screen

**Files:** Create `ui/home/{HomeScreen,HomeRoute,HomeViewModel,HomeUiState,HomeMapping}.kt`; Test `HomeViewModelTest.kt`, `HomeMappingTest.kt`.

**Interfaces:** `HomeUiState { Loading, Content(briefing: BriefingModel, tiles: List<MetricCardModel>, trends: List<TrendCardModel>), Error(retry) }`; `HomeViewModel(metrics: MetricsRepository, briefings: BriefingRepository)` with `state: StateFlow<HomeUiState>` and `refresh()`. Mapping pure functions: `toTiles(summary, trends)`, `toTrendRows(trends)`.

Screen content (port of `HomePage.tsx`, minus the artifacts in the audit): Overview = MX-4 briefing card, rail `SYSTEMS` with `n ONLINE` computed, 2-column grid of `MetricCard`s: Recovery (body battery now, sub from HRV vs week average), Training (load, status label from `TrainingStatus`), Sleep (duration, score ring). Trends = briefing + rail `WEEK IN REVIEW` + `TrendCard` rows (Recovery, HRV, Sleep, Training Load as bars, Intensity as bars). Pull-to-refresh via Material 3 `PullToRefreshBox`.

- [ ] **Step 1: Failing tests:** `loadingThenContent`; `allMetricsMissingShowsDashesNotFakeNumbers` (summary all `null` → every tile value `null`, no `74`/`82`/`342` anywhere); `oneTrendFailingLeavesTheOthers`; `noBriefingAndOfflineAreDistinctStates`; `staleBriefingCarriesItsAge`; `tilesIncludeOnlyBuiltSections` (no Nutrition, no placeholders); `sparklineIsRealTrendOrAbsent`; `refreshReloadsAndKeepsOldContentWhileLoading`; `summaryFailureYieldsErrorWithRetry`.
- [ ] **Step 2–4:** FAIL → implement → PASS; render Overview and Trends previews for loaded, partial and error states.
- [ ] **Step 5:** Commit.

---

### Task 9: Recovery screen

**Files:** Create `ui/recovery/{RecoveryScreen,RecoveryRoute,RecoveryViewModel,RecoveryUiState,RecoveryMapping}.kt`; Test `RecoveryViewModelTest.kt`, `RecoveryMappingTest.kt`.

**Interfaces:** `RecoveryUiState { Loading, Content(briefing, readiness: GaugeModel, battery/recovery bars, headlines: List<HeadlineModel>, vitals: List<StatusTileModel>, trends: List<TrendCardModel>), Error(retry) }`.

Screen content (port of `RecoveryPage.tsx` structure): Overview = briefing, rail `READINESS` (recovery-score gauge with `ReadinessRules.scoreLabel`, body-battery now/wake bar with `batteryBand`, recovery-time bar with `recoveryTimeBand`, HRV headline with `HrvTrend` direction and baseline range, Resting HR and Stress compact headlines), rail `OVERNIGHT VITALS` (Sleep Stress, Respiration, SpO₂, Sleep HR `StatusTile`s). Trends = eight rail+`TrendCard` sections (Recovery Score bars, HRV, Body Battery bars, Resting HR, Stress, Sleep Stress, Recov. Time, Respiration; `lowerIsBetter` as in the web). Source badges for non-Garmin data are out of scope (providers are disabled).

- [ ] **Step 1: Failing tests:** mapping per band (reusing Task 4 rules, not re-implementing them), `nullMetricsRenderDashesAndNoToneColor`, `hrvDirectionAppearsOnlyWithEnoughData`, `elevenTrendCallsRunConcurrentlyAndOneFailureIsIsolated`, `trendsTabHasEightSectionsInWebOrder`, `refreshKeepsContent`.
- [ ] **Step 2–4:** FAIL → implement → PASS; render previews.
- [ ] **Step 5:** Commit; open the PR for `feature/android-home-recovery` (Tasks 8 + 9); CI green; merge.

---

### Task 10: On the Fold (owner + phone)

- [ ] **Step 1:** Owner pushes tag `android-v0.1.0`; CI builds the **R8-minified** signed release and uploads to Firebase; the owner updates via App Tester.
- [ ] **Step 2: Announce first, then wait for "go"** before anything foregrounds the app. Verify: PIN login works and a wrong PIN shows the error; Home and Recovery show **live** data (compare numbers against the PWA open in Chrome on the same Fold); MX-4 shows its real offline/stale state; clearing the app's data (`adb shell pm clear`, which I run) returns to the PIN screen (the 401 path itself is covered by Task 3/6 tests); airplane mode shows the unreachable message; revoking Nearby devices shows the permission message.
- [ ] **Step 3:** If the R8 build crashes or loses data (serialization/Hilt keep rules), fix the rules test-first and ship `android-v0.1.1`.
- [ ] **Step 4:** Update `docs/ROADMAP.md` and the runbook with what shipped, and file follow-ups (Baseline Profiles, a batch trends endpoint, server-side stub briefing removal) as GitHub issues.
- [ ] **Step 5 (checklist for Review Focus 5):** `git status` shows no new `*.png` or real values; fixtures contain only synthetic numbers.

---

## Self-Review

- **Spec coverage:** §9 Milestone-1 screens for this chunk (PIN login, Home, Recovery) → Tasks 6–9; design source (§8) → Tasks 2 and 5; cleartext/permission/version gates (§4, §7) → Task 6; Phase E2 items (Sleep, Training, chat, Settings) are explicitly out of scope.
- **Audit coverage:** every row of the port-audit table maps to a task test (fake values → Task 8; stub briefing → Tasks 3/4/5; local date → Task 4; rules → Task 4; concurrency → Tasks 4/9; Nutrition tile → Task 8).
- **Types/names:** `Summary`, `Metric`, `Briefing`, `Tone`, `Section`, `CardSize` and the `…Model` classes are defined once (Tasks 2, 4, 5) and used verbatim later; `SessionEvents.expired` (Task 3) is consumed in Task 6.
- **Proportion:** logic is specified by signatures and test names; no function bodies are given. Visual work is verified by rendered previews and the owner's on-device check.
- **Flagged unverified:** Keystore encryption (device only); R8 keep rules (proven only by the Task 10 release build); `PullToRefreshBox`, Navigation 3 and `hiltViewModel()`-with-Navigation-3 at the pinned versions (compile-checked in Tasks 1 and 6); Hanken Grotesk's OFL license (checked when the fonts are added).
