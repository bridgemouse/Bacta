# Android Polish Pass C (Training and Sleep signature visuals) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox syntax.

> **Android's docs are the source of truth; the web app is only the picture of the finished product.** Read the Android docs at Step 0 of every task and record the pages for "Docs consulted". Nothing user-visible is hardcoded; tests, fixtures and previews use synthetic data only. A formula or threshold is encoded only after a primary-source check. See `docs/ANDROID.md`.

**Goal:** Build the signature visuals the web has and Android lacks (review items T4–T9, S1): load ratio track, moderate/vigorous intensity split, stacked HR zone bar, steps chart with goal line, ring percent, sleep hero stage chips, expandable activity rows.

**Architecture:** New stateless templates in `ui/designsystem/components` driven by new UI models; mappings stay pure and are tested first. Reuse `BarsChart` (generalised reference line), `Chip`, `CardRow`, `BactaPalette`.

**Spec:** `docs/superpowers/specs/2026-11-06-android-polish-review.md` (T3–T9, S1, O10).

## Global Constraints

- Strings in `strings.xml`; colours from `BactaPalette`; every card has a text alternative and a merged semantics node.
- Every changed screen is rendered at normal and 1.3× font scale and read.
- Garmin's own values only: load ratio zone 0.8–1.5 (`TrainingRules`), Training Effect bands from Garmin's owner's manual (0–0.9 no benefit, 1.0–1.9 minor, 2.0–2.9 maintaining, 3.0–3.9 improving, 4.0–4.9 highly improving, 5.0 overreaching; newer manuals say "impacts", the older manuals' wording is used).

## Docs consulted (Step 0 index)

| Need | Pages (`kb://android/…`) |
|---|---|
| Custom drawing | `develop/ui/compose/graphics/draw/overview` |
| Expand/collapse and animation | `develop/ui/compose/animation/composables-modifiers` (AnimatedVisibility, animateContentSize) |
| Accessibility state for expandables | `develop/ui/compose/accessibility/semantics` (`stateDescription`, `Role`) |
| Equal-height rows | `develop/ui/compose/layouts/intrinsic-measurements` |

## Review Focus

- A load ratio below 0.5 or above the track end clamps the marker to the track (no off-card draw).
- A zero or missing weekly goal never divides by zero (intensity and steps).
- A steps series with one point draws no chart; no goal draws no goal line.
- An activity with no Training Effect or no zone seconds expands to only what it has, and never to an empty box.
- The expanded row is announced as expanded/collapsed and is reachable by TalkBack.

### Task 1: Load ratio card (T4)

**Files:** Create `components/LoadRatioCard.kt`; Modify `ui/training/TrainingUiState.kt` (`LoadRatioModel`), `TrainingMapping.kt`, `TrainingScreen.kt`, `domain/TrainingRules.kt` (track bounds), strings; Test `TrainingMappingTest`, `TrainingRulesTest`.
- [ ] **Step 1 (failing tests):** `loadRatioModelCarriesValueStateAndTrackPosition`, `markerClampsToTheTrack`, `noRatioWhenThereIsNoRange`. **Step 2:** `TrainingRules.RATIO_TRACK = 0.5..2.0` (named, cited) and `ratioTrackPosition(ratio)`; the card draws the track, the optimal 0.8–1.5 zone and a marker, with "acute · chronic" caption. **Step 3:** render, commit.

### Task 2: Intensity split with goal marker (T5)

**Files:** Create `components/IntensityCard.kt`; Modify `TrainingUiState.kt` (`IntensityModel`), `TrainingMapping.kt`, `TrainingScreen.kt`; Test `TrainingMappingTest`.
- [ ] **Step 1 (failing tests):** `intensityModelSplitsModerateAndDoubledVigorous`, `zeroGoalNeverDividesByZero`, `exceedingTheGoalCapsTheBarAtFull`. **Step 2:** stacked two-colour bar, goal marker at the end, legend "Moderate n · Vigorous n (counts double)". **Step 3:** render, commit.

### Task 3: Zones with a stacked bar and minutes (T6)

**Files:** Modify `components/ZoneBars.kt`, `TrainingUiState.kt` (`ZoneItem.minutesText`), `TrainingMapping.kt`; Test `TrainingMappingTest`.
- [ ] **Step 1 (failing test):** `zoneRowsCarryFormattedMinutes`. **Step 2:** one stacked bar across the card, rows show minutes then percent. **Step 3:** render, commit.

### Task 4: Steps chart with goal line; ring percent (T7, T8)

**Files:** Modify `viz/Sparkline.kt` (`BarsChart` reference line), `TrainingUiState.kt` (`StepsChartModel`), `TrainingMapping.kt`, `TrainingScreen.kt`; Test `TrainingMappingTest`.
- [ ] **Step 1 (failing tests):** `stepsChartHasGoalAndRemainingText`, `goalMetShowsGoalMet`, `ringTilesShowAPercent`, `oneStepPointHasNoChart`. **Step 2:** card "STEPS · n DAYS" with "880 TO GO"/"GOAL MET", `BarsChart` with the goal as its reference line; daily ring tiles show their percent. **Step 3:** render, commit.

### Task 5: Sleep hero stage chips (S1)

**Files:** Modify `ui/sleep/SleepScreen.kt` (`LastNightCard`), `SleepUiState.kt` if needed; Test `SleepMappingTest`.
- [ ] **Step 1 (failing test):** `heroCarriesEfficiencyAndAwakeSummary`. **Step 2:** under "in bed", a flow row of stage chips (deep, light, REM with minutes) in the stage colours. **Step 3:** render at 1.3×, commit.

### Task 6: Expandable activity rows (T9, O10)

**Files:** Modify `data/repository/Models.kt` (`Activity` extra fields), `ActivityRepository.kt`, `Dtos.kt` if needed, `TrainingUiState.kt` (`ActivityDetailModel`), `TrainingMapping.kt`, `components/ActivityRow.kt`, `domain/TrainingRules.kt` (TE band); Test `ActivityRepositoryTest`, `TrainingMappingTest`, `TrainingRulesTest`.
- [ ] **Step 0:** animation and semantics pages above. **Step 1 (failing tests):** `activityCarriesElevationTrainingEffectRecoveryAndZoneSeconds`, `trainingEffectBandsFollowGarmin`, `activityDetailOmitsWhatIsMissing`, `detailIsAbsentWhenNothingToShow`. **Step 2:** the row toggles on tap (role button, `stateDescription` expanded/collapsed, `animateContentSize`); expanded content: Training Effect bars (aerobic, anaerobic with Garmin's band text), the activity's zone bar, elevation, recovery time. **Step 3:** render collapsed and expanded, commit, whole-branch review, PR.
