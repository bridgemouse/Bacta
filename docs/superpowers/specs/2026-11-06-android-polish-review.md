# Android polish review: web UI vs Android vs the Claude Design handoff

**Date:** 2026-11-06. **Status:** findings only; nothing here is built yet. Rules for acting on it: `docs/ANDROID.md` (Android docs are the source of truth; the web is the picture of the finished product; nothing hardcoded; synthetic data only; verify any formula before encoding it).

## How this was reviewed

- **Handoff:** `design_bacta-handoff-package/` (v3 prototype + `bacta-handoff-v3.md`). The prototype's Recovery screen crashes in a browser (`HeadlineCard is not defined` in `proto-patched.html`, and `Bacta - Prototype v3.html` references files that do not exist), so only its Home screen could be rendered. For the other screens the **built PWA is the faithful implementation of the handoff** and was used as the visual reference.
- **Web:** the live web client at 412 px wide (the Fold cover width), with the API replaced by request interception serving the same **synthetic fixtures** the Android previews use, so the two are compared on identical data. Screens captured: Recovery, Sleep, Training (Overview). Home failed to render with the mock (a missing mocked endpoint; not investigated).
- **Android:** `android preview render` of the Overview previews for Home, Recovery, Sleep and Training, plus what the Fold showed during the v0.2.0 device check.
- **Not covered:** the Trends tabs side by side, Settings/Logs/About against the web, Home on the web, and the web's deferred Labs and Daily Log screens (not built on Android either).

## Summary

The bones match: same sections, same data, same accents, same card chrome. What Android lacks is the **instrument-console finish and the richer visualisations**: a textured background, a status/sync bar, an expandable briefing with flags, per-card explanations, section icons, and several signature charts (concentric architecture arc, load range band, load-ratio track, zone stacked bar, steps bar chart with a goal line, ring tiles). Most of it is presentation work on data Android already has.

## Findings

Priority: **P1** = affects every screen or is cheap and obvious; **P2** = screen-specific parity; **P3** = later or needs a decision. Effort: S/M/L.

### Global (every screen)

| # | Web / handoff | Android now | P | Effort | Notes |
|---|---|---|---|---|---|
| G1 | Subtle grid/scanline texture over the app background | Flat `Base` colour | P1 | S | `bactaTexture` already exists in the Android design system (`Texture.kt`, used only by the catalog). Apply in the scaffold. Guard draw cost (docs: graphics performance). |
| G2 | Top bar: back chevron, section sigil and title, **SYNC** button, **MX-4 ONLINE** indicator | Back chevron, sigil, title only | P1 | M | Needs the sync trigger and MX-4 status the web uses (find the endpoints before designing; MX-4 is currently offline, so the indicator must show real state, not a fake green). |
| G3 | Briefing card: date line, tone chip, headline, summary, **DIRECTIVE** block, **FULL ANALYSIS ›** (expands the body), **REFRESH ›**, and the **flags as chips** below the card | Headline, summary, directive, REFRESH; no body, no flags | P1 | M | The server already returns `body` and `flags`; Android's model drops them. Expansion pattern per Compose docs (animated visibility, accessible state). |
| G4 | Section rails carry a right-hand status label (SYNTHESIZED, CURRENT, WHILE ASLEEP, GOAL 150 MIN, 62 MIN TODAY) | Mostly bare | P1 | S | Strings + a `right` argument that already exists on `SectionRail`. |
| G5 | Tap a card for a short explanation overlay ("what is this, why it matters") | None | P2 | M | Content lives in the web code per card; move it to string resources, reuse one overlay component. Docs: dialogs/bottom sheets and accessibility (the whole card is already a merged semantic node). |
| G6 | Section icons on Home tiles and headers, nav-sheet icons | Text only, coloured dots | P2 | M | Vector assets; docs: icons/adaptive. The prototype has the icon shapes. |
| G7 | Motion: breathing/ping dots, shimmer while loading, sigil mood changes | Static | P3 | M | Honour the system "remove animations" setting (docs: accessibility/animation). |
| G8 | Fixed 412 px phone layout | Single column capped at 640 dp | P3 | L | The foldable-adaptive pass (window size classes) is its own plan. |
| G9 | n/a | Labels wrapped at the device's font scale during the Fold check (bar-chart days, meter header) | P1 | S | Add a large-font-scale preview (`fontScale = 1.3f`) for every template and fix what breaks; Android-native requirement, not a web match. |

### Recovery

| # | Web / handoff | Android now | P | Effort | Notes |
|---|---|---|---|---|---|
| R1 | Readiness gauge with the one-sentence summary ("Systems restored. Cleared for a high-intensity session today.") | Gauge and chip only | P2 | S | Derived from the recovery band; strings, not code. |
| R2 | HRV card: "today vs 7-day trend" caption, trend and baseline legend | Similar; caption missing | P2 | S | |
| R3 | Body Battery as a large hero arc with WAKE and consumed | Smaller arc | P2 | S | Size only. |
| R4 | Overnight-vitals tiles have a coloured left edge | Plain border | P2 | S | A `StatusTile` variant. |
| R5 | Body-battery intraday arc and HRV direction badge (handoff §2.1–2.2) | HRV direction chip exists; intraday arc not built | P3 | M | Intraday needs a data source (check what the server stores). |

### Sleep

| # | Web / handoff | Android now | P | Effort | Notes |
|---|---|---|---|---|---|
| S1 | Hero shows stage chips (DEEP 80m, LIGHT 280m, REM 90m) and "98% efficient · 8m awake" | Hero shows time asleep, "in bed" and the score ring only | P2 | S | Data already mapped. |
| S2 | Efficiency and Sleep debt as a **side-by-side pair** with progress bars | Two full-width cards, efficiency mostly empty | P1 | S | Layout fix; the debt card already has the bar. |
| S3 | Architecture as a continuous **area step chart** with axis labels | Four-lane block chart | P3 | M | Different, arguably clearer, design. **Owner decision:** keep lanes, or match the web. |
| S4 | Stage legend rows with a mini bar and percent | Legend rows without bars | P2 | S | |
| S5 | **Architecture Score as a triple concentric arc** with Deep/REM/Awake "actual / target" labels | Single gauge plus three plain bars | P2 | M | Targets exist in `Targets`/`SleepRules`; custom drawing, with a text alternative for accessibility. |
| S6 | Vitals tiles with a coloured left edge, "WHILE ASLEEP" rail label | Plain | P2 | S | Same as R4/G4. |

### Training

| # | Web / handoff | Android now | P | Effort | Notes |
|---|---|---|---|---|---|
| T1 | Status banner with a status icon and "as of Nov 2" | Text banner | P2 | S | Icon from G6. |
| T2 | Fitness Age card with a rating chip (GOOD/EXCELLENT…) and VO₂ max foot | Fitness age and VO₂ max as two plain cards | P3 | S | **Verify first** (rule 3): the web's age bands are not from Garmin; find Garmin's or omit the chip. |
| T3 | Acute Load card with the **low / optimal / high range band** and marker | Chip plus sparkline | P2 | M | Garmin's range is already on the model (`band`). |
| T4 | **Load ratio card**: acute ÷ chronic with a track and the optimal zone | Ratio appears only as a line of text | P2 | M | Use Garmin's 0.8–1.5, not the web's 0.8–1.3 (verified; see `docs/ANDROID.md`). |
| T5 | Intensity bar split **moderate / vigorous** with the goal marker | Single meter | P2 | S | Data is in `WeeklyIntensity`. |
| T6 | HR zones: one **stacked bar** plus legend with minutes, bars and percent | Five bars with percent | P2 | S | Add the stacked bar and minutes. |
| T7 | **Steps · 7 days bar chart with a goal line** and "880 to go" | Steps only as a tile and in Trends | P2 | M | Series already fetched. |
| T8 | Daily tiles as **ring gauges with percent and "/goal"** | Number tiles; ring only for steps and floors | P2 | S | Ring only where a goal exists (distance/calorie goals are optional preferences, so most show none until set; see the goal editor gap). |
| T9 | Activity log rows are **expandable** with a type icon, relative day, and per-leg detail | Static rows | P3 | L | Needs the legs endpoint and a design for the expanded state. |
| T10 | n/a | No distance-goal editor, so the distance ring never draws | P2 | M | Known gap; needs a locale-aware unit input. |

### Home

| # | Web / handoff | Android now | P | Effort | Notes |
|---|---|---|---|---|---|
| H1 | System tiles with section icons and a header "3 ONLINE · 3 CALIBRATING" | Text tiles; "3 ONLINE" only | P2 | S | The placeholder tiles for unbuilt sections are deliberately not copied (rule 5: no fakes). |
| H2 | Briefing types out (cursor) | Static | P3 | S | Cosmetic. |
| H3 | Home/Recovery trends use the older day labels and the fixed 7-day window | Newer screens use `points()` and `Targets.trendDays` | P1 | S | Consistency; listed in the E2 backlog. |

## Recommended order of work

1. **Pass A, the finish (G1, G4, G9, S2, H3, R4, S6).** Mostly small and visible on every screen.
2. **Pass B, the briefing and top bar (G2, G3).** Needs two endpoint lookups first.
3. **Pass C, the Training and Sleep signature visuals (T3–T8, S1, S4, S5, R1–R3).**
4. **Pass D, icons and overlays (G5, G6, H1, T1).**
5. **Later:** G7, G8 (foldable adaptive), T9, S3 (after the owner decision), R5, T2 (after verification).

## Decisions needed from the owner

- **S3:** keep the Android lane chart for the hypnogram, or match the web's area step chart?
- **T2:** show a fitness-age rating at all? Only if Garmin publishes the bands.
- **G2:** should the top bar's SYNC and MX-4 indicator be built now (MX-4 is offline), or after MX-4 returns?
- **Ordering:** start with Pass A?
