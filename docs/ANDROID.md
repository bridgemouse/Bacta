# Android — Developer Guide

The native Android app (`android/`, Kotlin + Jetpack Compose) is the daily UI for Bacta; the server on LXC 109 is unchanged. **Read this before any Android work.** It records the rules the Android build was developed under so they survive between sessions. Plans live in `docs/superpowers/plans/` (E1: `2026-11-03-android-first-build.md`, E2: `2026-11-04-android-e2-sleep-training-settings.md`); the design spec is `docs/superpowers/specs/2026-11-02-android-native-app-design.md`.

## The five rules

1. **Android's docs are the source of truth. The web app is only the picture of the finished product.** Do not translate React code, structure or formulas. Read Google's Android documentation first, build the Android-native way it recommends, then judge the result by how it looks and what numbers it shows next to the PWA. Authority order: (1) Google's Android docs and each library's official docs; (2) the end visual (the live PWA, `design_bacta-handoff-package/`), used only to compare finished screens; (3) the existing web code, as a hint about *which values* a screen shows, never *how* to build it or *which formula* to use.
2. **Nothing user-visible, tunable or derivable is hardcoded.** It comes from the server, the user's saved preferences, the system (locale, 12/24 h, units), or one named, documented default. See "No-hardcoding mechanisms" below.
3. **A formula or threshold is encoded only after it is checked against a primary source** (Garmin's documentation or the live database), never copied from the web. The web has been wrong: its sleep-score bands, load-ratio bands and 42-day "chronic load" are not Garmin's. Verify, then encode Garmin's value and cite it in the code comment.
4. **The repo is public and the data is health data.** Tests, fixtures, previews, commit messages, issues and PR bodies contain **synthetic values only**. Verify against live data freely, but never commit a real number, and never commit a screenshot taken from the device or built from real data. Delete such screenshots when done.
5. **Weed out web artifacts.** Fake fallbacks, stub values and wrong labels from the web are not carried over: a missing value renders a dash, a missing goal draws no ring, a missing series omits the section. Nothing is faked.

## Docs-first procedure (every task)

- **Step 0 of every task is reading docs.** `ssh wheat@bacta-android`, then `android docs search "<query>"` and `android docs fetch kb://android/<path>` (the same page as `https://developer.android.com/<path>`; the live site wins). The `android` CLI is not installed on LXC 109, only on the dev VM.
- **If a page 404s or fails, open it in Chromium (Playwright MCP) before giving up.**
- **Other doc routes:** skill reference trees under `~/.claude/skills/{adaptive,navigation-3,testing-setup,agp-9-upgrade}/references/android/`; `ctx7` for library docs (Compose, Hilt, Retrofit, DataStore).
- **Record every page read** and put it under "Docs consulted" in the PR body, with a "Differs from web" paragraph for every deliberate difference.
- Where the docs disagree with the spec or the web, **the docs win** and the decision is written down (plan ledger `Ruling:` line, PR body).
- Pages that have paid off: settings pattern (`design/ui/mobile/guides/patterns/settings`: version belongs in About, not Settings; polite defaults; respect system settings), string resources and localization, internationalization (ICU, 12/24 h), `develop/ui/compose/lists`, accessibility semantics and merging, DataStore, text input, `develop/ui/compose/components/time-pickers-dialogs`, `privacy-and-security/security-config` (cleartext), `privacy-and-security/local-network-permission`.

## No-hardcoding mechanisms (enforced by tests, not by promise)

| Need | Mechanism |
|---|---|
| UI text | `strings.xml` / `plurals.xml`, read through `UiText` (`Res`/`Plural`/`Literal`). `NoHardcodedUiTextTest` fails the build if a literal is passed to `Text(` in `ui/` (previews, `Catalog.kt`, `ThemeSwatch.kt` exempt). `StringResourcesTest` lints format strings and name uniqueness. A string with no arguments is read with `getString(id)` (a lone `%` otherwise throws). |
| Numbers, dates, distance, durations | `Formatters` (`java.text`/`java.time`, ICU): units (km vs mi) follow the locale through `MeasurementSystemProvider`; 12/24 h follows the system. No app setting for either. |
| Per-metric facts (label, unit, decimals, lower-is-better, chart kind) | `MetricCatalog` / `MetricSpec`, stated once. |
| Thresholds and labels | `BandTable<T>` data tables with one named default and a citation. |
| Chart sections | Declarative `TrendSpec` + `buildTrendSections`; a section with no data is omitted. Adding a metric is a spec row. |
| User goals the server cannot supply | `Targets` in DataStore (sleep target, weekly intensity goal, optional distance/calorie goals, trend window 7/14/30), `sanitized()` on every write, edited in Settings. Server goals (`steps_goal`, `floors_goal`, Garmin's load range) always win. |
| Colors, stage and zone colors | `BactaPalette` / theme tokens, never literals in screens. |
| Time zones | Garmin local timestamps are wall-clock-as-UTC (format in UTC); activity `start_time` is a `LocalDateTime`; server log `created_at` is SQLite UTC, shown in the device zone. |

## Architecture in one paragraph

Layers: `data` (Retrofit + kotlinx-serialization, repositories returning `Result`, DataStore) → `domain` (pure rules, no Android) → `ui` (one `@HiltViewModel` per screen exposing `StateFlow<UiState>`; screens render UI *models* through reusable stateless card templates in `ui/designsystem/components`). Screens never touch DTOs. A "mapping" function turns `Summary` + series into a content model; it is pure and unit-tested. Navigation 3 with Home always at the bottom of the stack. Secondary screens (Settings, Logs, About) use a dock-less scaffold. Fakes, not mocks.

## Testing and verification

- **TDD with a watched RED.** Write the test, run it, see it fail for the right reason, then implement. A first run that "passes" when the code is missing means a stale build: investigate, do not proceed.
- **Dev loop** (edit in a worktree on LXC 109, build on the VM): `bash scripts/android-build.sh build testDebugUnitTest assembleDebug` (rsync to `wheat@bacta-android`, Gradle over SSH). Test results are the XML under `~/work/bacta-android/app/build/test-results/testDebugUnitTest/` on the VM.
- **Render every screen you change and read the PNG**: `ssh wheat@bacta-android 'cd ~/work/bacta-android && android preview render app --fqn=<fqn> --output=/tmp/x.png'`, then `scp` it to `/opt/bacta/.playwright-mcp/` and view it. Previews use synthetic data and are capped at 3000 dp tall. Reading previews found real defects (a permanently blank trend, a unit wrapping mid-word) that tests could not.
- **Then check on the device with real data.** The Fold found six more defects previews hid (bar labels wrapping at device font scale, a meter header wrapping by character, a rounded-to-zero change drawn as a red arrow, missing VO₂ decimal, UTC log times, a half-open nav sheet). Both checks are needed.
- **Device rules:** the owner reads this session on the Fold being tested. **Announce what you need before taking over the device, then wait for "go".** Never change the real PIN; a harmless setting round-trip (re-save the same value) is the allowed write check. Wireless debugging times out after ~30 minutes; the Fold serial is `adb-RFGL90QFNVR-TQ9E11._adb-tls-connect._tcp`. Screenshots go through `ANDROID_OUT_DIR=… bash scripts/android-build.sh screenshot <serial>` (the Fold has two displays, so plain `screencap` fails).

## Process

- Worktrees only: `git worktree add worktrees/<name> -b feature/<name> origin/main`. Never check out another branch in `/opt/bacta`. Never commit to `main`: PR, CI green (build + test), squash-merge, then fast-forward the production checkout.
- Plans carry a "Source of truth" section, a docs index, a Review Focus list with a test for each line, and a Step 0 (docs) per task. Plans are executed with `superpowers:executing-plans`: the ledger (`.superpowers/sdd/<plan>/progress.md`, gitignored) records `Ruling:` lines for every decision made on the owner's behalf.
- PR bodies include **Docs consulted** and **Differs from web** (see `.github/pull_request_template.md`).
- **Releases:** only the owner pushes `android-v*` tags (annotated, from `origin/main`). The workflow tests, signs and uploads to Firebase App Distribution; runbook in `docs/OPERATIONS.md` §9.

## Garmin facts verified for the app

- Sleep score bands (Garmin): excellent 90–100, good 80–89, fair 60–79, poor under 60. Hypnogram levels 0 deep / 1 light / 2 REM / 3 awake; the server emits `3 - level`.
- Training load: `training_load` is Garmin's acute load; `training_load_min/max` is Garmin's optimal range, whose ratio is always 1.875 = 1.5 / 0.8, so chronic load = min / 0.8 and the ratio = acute / chronic matches Garmin's own `dailyAcuteChronicWorkloadRatio`. Optimal ratio 0.8–1.5.
- `hrzone_N_min` is today's minutes in zone N. Garmin counts vigorous intensity minutes twice toward the weekly goal.
- Fitness age is Garmin's `fitnessAge` only; it never falls back to chronological age.

## Known gaps (tracked in `docs/ROADMAP.md`)

MX-4 chat (E2b, blocked while MX-4 is offline), in-app server editing (`ServerConfig` has no persistence), a distance-goal editor (needs a locale-aware unit input), foldable-adaptive layouts, the Garmin Personal API session.
