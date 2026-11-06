# Android Polish Pass A (shared templates, Recovery, Sleep) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox syntax.

> **Android's docs are the source of truth; the web app is only the picture of the finished product.** Read the Android docs at Step 0 of every task, record the pages for "Docs consulted", and compare the result to the PWA only by how it looks. Nothing user-visible is hardcoded (strings, formatters, catalog, targets); tests, fixtures and previews use synthetic data only. See `docs/ANDROID.md`.

**Goal:** Fix the owner-reported polish defects (O1–O9) and the shared-template gaps from `docs/superpowers/specs/2026-11-06-android-polish-review.md`.

**Architecture:** All changes are in reusable templates (`ui/designsystem/components`, `viz`) and the mappings that feed them, so every screen benefits. Logic changes (mappings, models) get a failing test first; drawing changes are verified by rendered previews, including a 1.3× font-scale preview.

**Tech Stack:** As `docs/ANDROID.md` (Compose, Material 3, Kotlin, JUnit4).

**Spec:** `docs/superpowers/specs/2026-11-06-android-polish-review.md` (findings O1–O9, S2, S5, G1, G4, G9).

## Global Constraints

- Strings in `strings.xml`; no literal passed to `Text(` in `ui/` (ratchet test).
- Colours from `BactaPalette`; sizes in dp, text in sp (scalable content).
- Every changed template is rendered at normal and at `fontScale = 1.3f` and the PNG is read.
- Synthetic values only.

## Docs consulted (Step 0 index)

| Need | Pages (`kb://android/…`) |
|---|---|
| Custom drawing, paths, arcs | `develop/ui/compose/graphics/draw/overview`, `…/draw/shapes` |
| Inline styled text | `develop/ui/compose/text/style-text` |
| Flow layouts (chips that wrap whole) | `develop/ui/compose/layouts/flow` |
| Font scale and scalable content | `develop/ui/compose/accessibility/scalable-content` |
| Accessibility of custom charts | `develop/ui/compose/accessibility/semantics` |

## Review Focus

- A directive of one word and of several lines both read as one block with no empty column (preview).
- A series of identical values (average equals every point) and of one point do not break the average line.
- A gauge with no value still sizes to its arc.
- An architecture part with no target (zero total) is omitted rather than dividing by zero.
- A vitals tile with no band keeps the same layout as one with a band.

### Task 1: Card frame follows the card's rounded corners (O1)

**Files:** Modify `ui/designsystem/components/BactaCard.kt` (`cardFrame`); preview via `Catalog.kt`.
- [ ] **Step 0:** `graphics/draw/overview`, `shapes`. **Step 1:** replace the straight L brackets with a `Path` per corner: line in, `arcTo` with radius = card radius − inset (floor 2 dp), line out. Keep colour and alpha. **Step 2:** render `CatalogHome` and `CatalogRecovery`, read the PNGs at normal and 1.3× font scale. **Step 3:** commit.

### Task 2: Directive and chips layout (O2, O5)

**Files:** Modify `ui/designsystem/components/BriefingCard.kt`, `HeadlineCard.kt`, `viz/Small.kt` (`Chip`); Test: none (layout), preview.
- [ ] **Step 0:** `text/style-text`, `layouts/flow`. **Step 1:** directive becomes one `Text` built with `buildAnnotatedString`: the styled label, a separator, then `inlineMarkdown(text)`. **Step 2:** `HeadlineCard` shows chips in a `FlowRow` under the label (never beside it); `Chip` is single-line. **Step 3:** render the Recovery and Home previews with a long directive and two chips at 1.3×; commit.

### Task 3: Gauge sized to its arc; Recovery score card (O4, O6, R1)

**Files:** Modify `viz/Gauges.kt` (`ArcGauge`), `components/GaugeCard.kt`, `ui/recovery/RecoveryMapping.kt`, `ui/recovery/RecoveryScreen.kt`, `res/values/strings.xml`; Test `ui/recovery/RecoveryMappingTest.kt`.
- [ ] **Step 0:** as Task 1. **Step 1 (failing test):** `recoveryScoreGaugeHasALabelAndADescription` and `descriptionFollowsTheBand` (one sentence per band from strings; no description when there is no score). Run it, see it fail. **Step 2:** `ArcGauge` computes the arc's vertical extent from `sweep` and returns a box of that height, drawing the circle so its centre is the content centre; `GaugeCard` hero and side use it. The score card shows its label inside the card; the "READINESS" rail is removed. **Step 3:** green, render at 1.3×, commit.

### Task 4: Vitals tiles always carry a dot (O7)

**Files:** Modify `components/StatusTile.kt`; Test `ui/recovery/RecoveryMappingTest.kt` (tile without band has `tone == null` and renders neutral).
- [ ] **Step 1:** the dot slot is always present; with no tone it uses `BactaPalette.TextMuted`. Add the explanation of what a dot means to the content description only when a tone exists. **Step 2:** render Recovery and Sleep previews; commit.

### Task 5: Average lines everywhere (O3)

**Files:** Modify `ui/home/HomeMapping.kt`, `viz/Sparkline.kt` (`BarsChart`), `components/TrendCard.kt`; Test `ui/home/HomeMappingTest.kt`.
- [ ] **Step 1 (failing tests):** `everyHomeTrendRowCarriesTheSeriesMean`, `aSingleOrFlatSeriesHasNoMisleadingAverage` (fewer than two points: null). **Step 2:** `toTrendRows` sets `average` from the series (HRV keeps the server week average). `BarsChart` gains `average` and draws a dashed line across the bars; `TrendCard` passes it. **Step 3:** render Home Trends; commit.

### Task 6: Sleep efficiency and debt as a compact pair (O8, S2)

**Files:** Create `components/BarStatCard.kt`; Modify `components/Models.kt` (`BarStatModel`), `ui/sleep/SleepMapping.kt`, `SleepUiState.kt`, `SleepScreen.kt`; Test `ui/sleep/SleepMappingTest.kt`.
- [ ] **Step 1 (failing tests):** efficiency and debt map to `BarStatModel(label, value, bar fraction, caption)`; the bar for efficiency is the percent, for debt is restored share; both absent-safe. **Step 2:** implement the card (label, value, bar, caption) and put the two in one `Row`. **Step 3:** render at 1.3×; commit.

### Task 7: Architecture score as concentric arcs (O9, S5)

**Files:** Create `viz/ArchitectureArcs.kt`; Modify `ui/sleep/SleepUiState.kt` (`ArchitecturePart.detail`), `SleepMapping.kt`, `SleepScreen.kt`; Test `ui/sleep/SleepMappingTest.kt`, `viz` geometry test.
- [ ] **Step 0:** `graphics/draw/overview`, `accessibility/semantics`. **Step 1 (failing tests):** `architecturePartsCarryActualAndTargetMinutes` (target = total × `ArchitectureTargets` share, the same object `SleepRules` uses), `zeroTotalOmitsTheArchitecture`. **Step 2:** three concentric arcs (deep, REM, awake) at decreasing radius, each filled to its part's fraction, with the score in the middle and the "actual / target" caption per stage below; a text alternative lists each part. **Step 3:** render; commit.

### Task 8: Finish (G1, G4, G9)

**Files:** Modify `ui/shell/BactaScaffold.kt` (texture), the screens' `SectionRail` calls, `res/values/strings.xml`, previews (add `fontScale = 1.3f` variants).
- [ ] **Step 0:** `graphics/draw/modifiers` (draw cost). **Step 1:** apply `bactaTexture` behind content; give each rail its right-hand label as a string; add a 1.3× preview for every screen. **Step 2:** render all, read; **Step 3:** commit. Then the whole-branch review, PR(s), device check, tag by the owner.
