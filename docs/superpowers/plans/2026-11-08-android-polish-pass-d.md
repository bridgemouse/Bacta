# Android Polish Pass D (briefing, status bar, icons, info sheets, adaptive layout) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox syntax.

> **Android's docs are the source of truth; the web app is only the picture of the finished product.** Read the Android docs at Step 0 of every task and record the pages for "Docs consulted". Nothing user-visible is hardcoded; tests, fixtures and previews use synthetic data only; nothing is faked (a status the app cannot know is not drawn). See `docs/ANDROID.md`.

**Goal:** Close the remaining visual gaps from `docs/superpowers/specs/2026-11-06-android-polish-review.md`: briefing full analysis and flag chips (G3), a real SYNC button and MX-4 status in the top bar (G2), section icons (G6), per-card explanations (G5), and a two-column layout for the unfolded screen (G8).

**Architecture:** Same layers as before. New data pieces are a `SyncRepository` (start and poll the server's sync) and a `StatusBarViewModel`; new UI pieces are stateless templates (`InfoButton`/`InfoSheet`, `AdaptiveColumns`) used by the existing screens.

**Spec:** `docs/superpowers/specs/2026-11-06-android-polish-review.md`.

## Global Constraints

- Strings in `strings.xml`; colours from `BactaPalette`; everything renders at normal and 1.3× font scale.
- The web's "MX-4 ONLINE" is a static label; Android derives MX-4's state from the age of his last briefing (fresh, stale, none/unreachable) and never draws "online" without evidence.
- Synthetic values only.

## Docs consulted (Step 0 index)

| Need | Pages (`kb://android/…`) |
|---|---|
| Adaptive layouts, window size classes | `develop/ui/compose/layouts/adaptive/use-window-size-classes`, the `adaptive` skill references |
| Bottom sheets / dialogs for explanations | `develop/ui/compose/components/bottom-sheets` |
| Expand/collapse | `develop/ui/compose/animation/composables-modifiers` |
| Vector drawing for icons | `develop/ui/compose/graphics/vector-graphics`, `…/draw/shapes` |
| Accessibility | `develop/ui/compose/accessibility/semantics` |
| Background work / polling state in a ViewModel | `topic/libraries/architecture/viewmodel`, `develop/ui/compose/state` |

## Review Focus

- A briefing with no body shows no FULL ANALYSIS control; one with no flags shows no chips.
- Markdown in the body (headings, bullets, bold) renders without literal `##` or `-`.
- Sync: a second tap while running does nothing; a failed start shows an error and recovers; a poll that errors does not stop the screen.
- MX-4 status for a briefing exactly at the freshness boundary and for no briefing at all.
- Two-column layout: an odd number of cards, a card taller than its neighbours, and a rail (full width) between groups.

### Task 1: Briefing full analysis and flag chips (G3)
Models: `BriefingContent.body`, `.flags`; pure `markdownBlocks`. UI: FULL ANALYSIS toggle, block renderer, flag chips. Tests: `BriefingMappingTest`, `MarkdownBlocksTest`.

### Task 2: Top bar SYNC and MX-4 status (G2)
Data: `SyncRepository` (POST `api/garmin/sync`, GET `api/garmin/sync/status`), `SyncEvents`; `StatusBarViewModel`; screens refresh on completion. Tests: view-model tests with a fake repository and test scheduler.

### Task 3: Section icons (G6)
`SectionIcons` image vectors; used on Home tiles and the navigation sheet. Tests: icon sanity; mapping puts an icon on each tile.

### Task 4: Info sheets (G5)
`InfoText`, `WithInfo` wrapper, `InfoSheet`; copy for the cards that have a non-obvious meaning. Tests: every info string resolves; wrapper semantics.

### Task 5: Adaptive two-column layout (G8)
`AdaptiveColumns` masonry layout for expanded widths, full-width rails and briefing, used by the four screens. Tests: pure placement function (odd counts, full-width items, ties).
