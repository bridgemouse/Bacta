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
Dedicated LXC. Node app + Python poller/MX-4 process run directly on the LXC. SQLite on the local filesystem. Reverse proxy via Nginx Proxy Manager (already running on the homelab), DNS via AdGuard. `bacta.local` resolves through the existing AdGuard setup. No Caddy. No vault mount required. GitHub Actions for CI/CD.

### Workflow
1. This spec → Claude Code builds the skeleton (navigation, design system, stub endpoints, MX-4 card shell)
2. Skeleton running on-device → Claude Design iterates with the live codebase until the UI feel is right
3. Claude Design output → Claude Code implements sections one by one on feature branches

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

Vault-query MCP remains available for personal background context (training block, hypermobility, wedding taper, etc.) if MX-4 needs it for deeper insight generation — but is no longer required for blood work.

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
`id, date, lab_name, notes, file_path (encrypted), uploaded_at`

**`blood_work_results`**
`id, panel_id, marker_name, value, unit, reference_range_low, reference_range_high, flagged`

### Garmin Poller
Runs every 30 minutes during waking hours, every 2 hours overnight. Garth handles token refresh. On each write, updates `synced_at` on the relevant table — this is MX-4's staleness signal.

### Blood Work Upload and Storage
User uploads lab results directly in the Blood Work section (PDF or image). No vault dependency. Backend stores the uploaded file and the user manually enters or confirms parsed marker values into `blood_work_results`. Sensitive blood work fields are encrypted at the application layer before writing to SQLite. Encryption key stored in `.env` on the LXC, never committed. Local-only access by design, but encryption adds a protection layer for sensitive health data.

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

Development philosophy: get the skeleton right and the feel confirmed on-device first, then build out sections one at a time on their own feature branches. Each section ships its own backend routes, SQLite tables, frontend pages, and HEARTBEAT entry together — no section is "done" until the full slice is working. This avoids building an entire backend against assumptions that turn out to be wrong.

### Phase 1 — Spec and Prototype
This document. Taken into Claude Design to prototype key screens (Home, Recovery, Nutrition at minimum). Claude Design produces the visual target before app code is written.

### Phase 2 — Skeleton
Side drawer navigation, section routing, design system (colors, typography, card components), MX-4 card component shell with mock data, stub API endpoints. Goal: get the app on the iPhone home screen with the navigation and feel confirmed before any real data is wired. No real backend yet — stubs return hardcoded mock responses.

### Phase 3 — Section Feature Branches
Each section is its own feature branch, merged when the full slice is solid:

| Branch | Scope |
|---|---|
| `feature/section-recovery` | `garmin_hrv`, `garmin_daily` (partial), `garmin_sleep` (partial) — HRV, body battery, resting HR, stress, SpO2. Garmin poller wired. Establishes MX-4 card pattern for all future sections. |
| `feature/section-sleep` | `garmin_sleep` (full) — sleep score, stages, trends. |
| `feature/section-training` | `garmin_activities`, `garmin_vo2max`, `garmin_running_dynamics` — workouts, load, VO2 max, volume, pace. |
| `feature/section-daily-log` | `daily_log`, `supplements_log` — readiness, energy, caffeine, supplements form. |
| `feature/section-nutrition` | All nutrition tables, OpenFoodFacts integration, food logging UI, adaptive targeting, weight log. Most complex — last. |
| `feature/section-bloodwork` | `blood_work_panels`, `blood_work_results`, file upload endpoint, encryption layer, manual result entry UI. |

### Phase 4 — MX-4 Full Wiring
After sections have real data. Python MX-4 process fully connected: Haiku API, staleness check logic, `BACTA_HEARTBEAT.md` authored per section, memory files initialized from existing `mx4-persona.md`. Adaptive TDEE calculation wired to nutrition targets.

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
