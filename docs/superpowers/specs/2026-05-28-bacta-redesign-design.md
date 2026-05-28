# Bacta Redesign — Design Spec
**Date:** 2026-05-28
**Status:** Approved — pending implementation plan

---

## Overview

Full ground-up rewrite of Bacta, the personal health dashboard PWA. Named after the Star Wars healing fluid. Local WiFi only, saved to iPhone home screen, served from LXC 107 at `bacta.local`.

The core premise: a single place for all personal health data — Garmin metrics, in-house nutrition tracking, sleep, blood work, manual inputs — surfaced with genuine AI intelligence via MX-4, Bacta's Star Wars-themed droid assistant. Not a generic health app. Genuinely personal.

This rewrite replaces the existing codebase entirely. The existing Garmin poller, MX-4 Python scripts, and food logic from SparkyFitness are referenced as source material — not carried forward as-is.

---

## Section 1 — Architecture

Three independent layers. No layer reaches into another's internals.

### Data Layer
Raw data written to SQLite by pollers. One external poller in v1: **Garmin** (garth token auth, shared from LXC 106, writes to domain-specific tables). Everything else is internal — nutrition data logged directly by the user in-app. Each table carries a `synced_at` timestamp used by MX-4's staleness check.

The data layer is designed for extensibility. New data sources add a new poller and new SQLite tables — nothing else changes.

### MX-4 Layer
Separate process. Never blocks the UI. Triggered two ways:
1. At section page load, if the insight for that section is older than the last `synced_at` for its data domain
2. When a poller writes new data to a domain

MX-4 calls the Haiku API, writes a structured JSON blob to `/insights/<section>.json`, then updates his memory files. The frontend renders whatever is currently in `/insights/` — insight cards are always instant. A subtle indicator shows if a regeneration is in progress. `BACTA_HEARTBEAT.md` controls what MX-4 looks at per section — editable without code changes.

### App Layer
React + Node/Express. The backend exposes:
- Garmin data endpoints (read from SQLite)
- Insight endpoints (read from `/insights/`)
- MX-4 trigger endpoint (kicks off regeneration for a specific section)
- Nutrition API (food search, meal logging, macro calculation, weight logging)

The frontend never talks to SQLite directly. It never calls Haiku. It reads, renders, and logs manual input through the API.

### Deployment
Docker Compose on LXC 107. Two containers: Node app, Garmin poller + MX-4 process. SQLite on a named volume. Caddy reverse proxy at `bacta.local`. Vault mounted read-only for blood work parsing.

### Workflow
1. This spec → Claude Design (UI prototyping)
2. Claude Design output → Claude Code (full implementation, front and back)

---

## Section 2 — Frontend Structure

### Navigation
Hamburger (☰) top-left opens a side drawer. Drawer lists all top-level sections. Tapping a section closes the drawer and navigates. The drawer is the only global navigation element — no bottom tab bar.

### Sections and Sub-navigation

| Section | Sub-nav Pills |
|---|---|
| **Home** | None — master view |
| **Recovery** | Overview · HRV · Body Battery · Stress · SpO2 |
| **Training** | Overview · Workouts · Load · VO2 Max · Volume · Pace |
| **Sleep** | Overview · Stages · Trends |
| **Nutrition** | Overview · Log Food · Macros · Weight · Food History |
| **Blood Work** | Overview · Results · Trends |
| **Daily Log** | None — single form |

### Home Screen
No sub-nav. Master MX-4 card at top ("overall today" — cross-section summary). Status tile per section below: one-line status and key metric. Tapping a tile navigates to that section's Overview.

### MX-4 Cards
Every Overview sub-page has an MX-4 card pinned at top. Dark gradient card, green pulse indicator, MX-4's insight text. If regenerating: subtle animation, rest of page loads normally. Card structure:

```json
{
  "generated_at": "2026-05-28T06:12:00",
  "summary": "HRV up 4ms — consistent with adaptation phase...",
  "tone": "positive",
  "flags": []
}
```

`tone` drives card accent: `positive` → green, `caution` → amber, `flag` → red. `flags` surface as small badges.

### Design Aesthetic
Google Health / Material You direction:
- Base: `#0f1117`
- Section accent colors: Recovery → blue, Training → orange, Sleep → purple, Nutrition → green, Blood Work → red
- Rounded cards with soft gradients
- Progress bars on metric tiles
- Clean sans-serif typography
- Dark throughout — no light mode

---

## Section 3 — MX-4 Integration

MX-4's identity, memory system, and personality carry over from the `2026-05-20-mx4-design.md` spec verbatim. The persona (TC-series baseline + Nines matrix + Two-Boots matrix), three-file memory system, and relationship framing with Ethan are unchanged.

### What Changes for Bacta
- **Runtime**: Python process (consistent with existing MX-4 implementation), Haiku API directly via `anthropic` Python SDK. `ANTHROPIC_API_KEY` in Docker env.
- **Output**: Structured JSON per section (see card format above), not full HTML
- **Trigger**: Staleness check against SQLite `synced_at` timestamps, not a fixed schedule
- **Scope**: `BACTA_HEARTBEAT.md` — one section per Bacta domain, controls what data MX-4 reads and what he produces

### Memory Files
Same three files, same structure:
- `mx4-persona.md` — immutable lore, written at setup
- `mx4-personality.md` — opinion log (Current Beliefs injected, Full Log indexed in Chroma)
- `mx4-state.md` — factual run state, updated after each generation

Vault remains available via vault-query MCP for blood work context and personal background (training block, hypermobility, wedding taper, etc.).

### Tone
Adherence-neutral. MX-4 doesn't shame overages, doesn't celebrate compliance. He gives genuine assessments in the Nines/Two-Boots register — direct, curious, occasionally dry. He will flag things that warrant attention but won't nag.

---

## Section 4 — Data Layer (SQLite Schema)

### Garmin Tables

**`garmin_daily`**
`date, steps, floors, intensity_minutes, stress_avg, hydration_ml, body_battery_end, resting_hr, spo2_avg, respiration_avg, weight_kg, synced_at`

**`garmin_sleep`**
`date, score, duration_min, light_min, deep_min, rem_min, awake_min, restlessness, hrv_nightly, synced_at`

**`garmin_hrv`**
`date, rmssd, status, five_day_avg, synced_at`

**`garmin_activities`**
`id, date, type, name, duration_min, distance_m, avg_hr, max_hr, hr_zone_1_min … hr_zone_5_min, training_load, recovery_time_h, pace_avg_sec_km, synced_at`

**`garmin_vo2max`**
`date, value, synced_at`

**`garmin_running_dynamics`**
`activity_id, cadence_avg, ground_contact_ms, vertical_oscillation_cm, synced_at`

### Nutrition Tables

**`food_items`** (OpenFoodFacts/USDA cache)
`id, name, brand, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, fiber_per_100g, sodium_per_100g, sugar_per_100g, source, source_id`

**`food_log`**
`id, date, meal_type (breakfast/lunch/dinner/snack), food_item_id, quantity_g, calories, protein_g, carbs_g, fat_g, notes`

**`saved_meals`**
`id, name, created_at`

**`saved_meal_items`**
`meal_id, food_item_id, quantity_g`

**`weight_log`**
`id, date, weight_kg`
(Smoothed 7-day trend computed at read time)

**`nutrition_targets`**
`id, mode (adaptive/manual), calories, protein_g, carbs_g, fat_g, updated_at`

### Manual Input Tables

**`daily_log`**
`date, readiness (1–5), energy (1–5), caffeine_mg, notes`

**`supplements_log`**
`date, supplement_name, taken (boolean)`

### Blood Work Tables

**`blood_work_panels`**
`id, date, source_vault_path, raw_markdown`

**`blood_work_results`**
`id, panel_id, marker_name, value, unit, reference_range_low, reference_range_high, flagged`

### Garmin Poller
Runs every 30 minutes during waking hours, every 2 hours overnight. Garth handles token refresh. On each write, updates `synced_at` on the relevant table — this is MX-4's staleness signal.

### Blood Work Vault Parsing
The backend includes a vault reader that parses blood work markdown from the mounted vault volume and populates `blood_work_panels` and `blood_work_results`. Triggered manually (user initiates a sync after new lab results are ingested into the vault via LLM-Wiki). Schema deferred until actual Factor results are available — parser built to the frontmatter schema established at that time.

### Extensibility
New data sources: new poller + new SQLite tables. No other changes to the architecture.

---

## Section 5 — Food Logging

### Logging Methods (v1)
- **Food search** — OpenFoodFacts primary, USDA fallback. Verified database, quality over quantity.
- **Quick-add** — enter calories + macros directly (no food search required)
- **Recent foods** — last 20 logged items, one-tap re-log
- **Saved meals** — log a group of foods under a name (e.g. "usual breakfast" = two taps)

### Macro Targets
Two modes, user-selectable in Nutrition Settings:

**Adaptive (default):** MX-4 runs a weekly reverse-TDEE calculation using weight trend + logged intake data and updates `nutrition_targets`. First 2 weeks use a standard TDEE estimate while enough data accumulates. After that, targets reflect actual metabolism. MX-4 explains the change in his Nutrition insight card when targets update.

**Manual:** User sets calorie and macro targets to the gram. MX-4's weekly recalculation is paused. Switching back to Adaptive resumes it from current data.

### Design Tone
Adherence-neutral. No red numbers on overages. MX-4's Nutrition insight card references trends, not daily pass/fail. Consistent with MX-4's overall register.

### Display
- Progress bars: calories, protein, carbs, fat (consumed vs target)
- Meal breakdown: daily totals grouped by meal slot
- MX-4 card at top of Nutrition Overview references weekly trend and target adherence

### Weight Logging
Manual entry in Nutrition section. Smoothed 7-day rolling average computed at read time. This trend is MX-4's input for TDEE calculation — not raw daily readings.

### Reference Implementations
- SparkyFitness: food search/result parsing, OpenFoodFacts API integration, macro calculation, unit conversions
- MacroFactor: adaptive TDEE algorithm design, adherence-neutral UX patterns
- MacrosFirst: verified-only database approach, recent foods UX

### v2 (not in scope for initial build)
- Barcode scanning

---

## Section 6 — Build Sequencing

### Phase 1 — Spec and Prototype
This document. Taken into Claude Design to prototype key screens (Home, Recovery, Nutrition at minimum). Claude Design produces the visual target before app code is written.

### Phase 2 — Backend and Data Layer
SQLite schema, Garmin poller, all REST API routes, food search integration (OpenFoodFacts), nutrition CRUD endpoints, weight logging, MX-4 trigger endpoint. Backend fully functional and independently testable before frontend exists. Heaviest SparkyFitness borrowing happens here.

### Phase 3 — Frontend
React frontend built section by section to the Claude Design target:
1. Side drawer navigation (skeleton)
2. Home screen
3. Recovery (establishes MX-4 card pattern used everywhere)
4. Sleep, Training, Blood Work, Daily Log
5. Nutrition (most complex — last)

### Phase 4 — MX-4 Integration
MX-4 process wired in after frontend exists and insight card slots are real. `BACTA_HEARTBEAT.md` written per section. Haiku API connected. Staleness check logic. Memory files initialized from existing `mx4-persona.md`.

### Phase 5 — Docker + Deployment
Docker Compose on LXC 107, Caddy at `bacta.local`, vault NFS mounted read-only, PWA manifest, iOS home screen.

### v2 and Beyond
Barcode scanning, Google Calendar integration (already designed for in MX-4 spec), additional data sources, homelab status section.

---

## Reference Documents
- `bacta-handoff.md` — original build context and Garmin data source details
- `2026-05-20-mx4-design.md` — MX-4 identity, memory system, persona file
- `2026-05-20-mx4.md` — MX-4 implementation plan (memory files, run.sh, systemd patterns)
- SparkyFitness (`https://github.com/CodeWithCJ/SparkyFitness`) — food logging, Garmin integration reference
- wger (`https://github.com/wger-project/wger`) — exercise database structure reference
