# Bacta — Section Design Brief (Round 2)

This is a continuation. Round 1 established the shell and design system — TopBar, BottomBar, BottomSheet, MX-4 Card, MetricTile, the dark palette, accent colors per section, typography, spacing. That work stands. This round is about the **content inside each section**.

I'll attach a screenshot of the current state.

---

## What we're designing

The app has 7 sections. The data pipeline for three of them is now live — **Recovery, Sleep, Training** — pulling real metrics from Garmin Connect nightly. I want you to design those three sections plus **Home** (which is an overview of everything).

The other three (Nutrition, Blood Work, Daily Log) are coming later. Don't worry about them now.

---

## The data we have

This is the real data that will populate each section. Design around what's actually here — don't add phantom metrics.

### Recovery
- **HRV** (last night, weekly avg) — ms
- **Body Battery** (daily max, daily min) — 0–100
- **Resting Heart Rate** — bpm
- **Training Readiness / Recovery Score** — 0–100
- **Average Stress** — 0–100
- **SpO2 avg** — %
- **Respiration avg** — breaths/min
- 7-day trend available for all of the above

### Sleep
- **Sleep Duration** — hours/minutes
- **Sleep Score** — 0–100
- **Sleep Stages** — deep, light, REM, awake (as durations + percentages)
- **SpO2 during sleep** — %
- **Respiration during sleep** — breaths/min
- 7-day trend available for duration and score

### Training
- **VO2max** — mL/kg/min
- **Training Status** — e.g. Productive, Maintaining, Detraining
- **Training Load** — numeric
- **Endurance Score** — 0–100
- **Intensity Minutes** — moderate + vigorous (weekly)
- **Recent Activities** — distance, duration, calories, avg HR, activity type
- 7-day trend available for intensity minutes

### Home
- A cross-section overview: one key metric pulled from each of the 4 active sections
- MX-4's daily summary card (this is the main one — he narrates the whole picture)
- Not a data dump — just the most meaningful signal from each area

---

## Section structure

Each section follows this pattern:

**Two pill tabs in the BottomBar:** `Overview` and `Trends`

- **Overview** — today's snapshot. Key numbers, MX-4 card at top, primary metrics prominent.
- **Trends** — 7-day charts/sparklines for the section's core metrics. Less text, more visual.

The MX-4 Card is always pinned at the top of Overview. His insight for that section. Tone-colored border (positive/caution/flag → green/amber/red). The card should feel like it's *from* him — not just a generic card.

---

## Section accent colors (established in Round 1 — don't change these)

| Section | Accent |
|---|---|
| Home | `#4ade80` |
| Recovery | `#64b5f6` |
| Training | `#fb923c` |
| Sleep | `#a78bfa` |

---

## What I want from you

Design the layout and component treatment for all four sections — Home, Recovery, Sleep, Training — in both their **Overview** and **Trends** states.

Specific things I'm thinking about:

- **Recovery Overview** — HRV and Body Battery are the headliners. Recovery score is the synthesizing number. How do you make those feel like they mean something without just being tiles in a grid?
- **Sleep Overview** — Sleep stages are the most interesting data. Duration and score are headline. How do you show stage breakdown without it feeling like a table?
- **Training Overview** — Training Status + VO2max are the anchors. Recent activity should feel like a log entry, not a data row.
- **Home** — This is where MX-4 really speaks. Four sections, one narrative. The design should reflect that he's synthesizing, not just summarizing.
- **Trends tab** — Sparklines or small bar charts for the key metrics over 7 days. Should feel like Garmin Connect's weekly view but moodier and more personal.

Push on the MX-4 Card design for each section — each one should feel contextually appropriate. The Sleep section card should feel different from the Training section card even if the structure is the same.

The emoji section icons are still placeholders in the BottomSheet navigation. If you have strong opinions about iconography, go for it.

---

## Constraints

- Dark mode only. Base `#0f1117`, surface `#111827`, elevated `#1e2d3d`.
- iOS PWA — fixed shell, single scrollable content zone. No browser chrome.
- Inline styles only (this is a React/Vite app — no CSS modules, no Tailwind utility classes in components). CSS keyframe animations are already defined globally.
- This is one person's private health dashboard. It doesn't need to be friendly or approachable. It needs to be *precise*.
