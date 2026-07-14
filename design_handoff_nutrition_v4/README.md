# Handoff: Bacta — Nutrition Section (v4)

## Overview
Complete design for Bacta's **Nutrition section**: a "ledger channel" macro tracker where MX-4 keeps the books alongside the user. Covers the Overview (day ledger + meal log + day navigation), Food Library (custom foods + recipes), a bottom-sheet log-entry flow (Quick Track ad-hoc first, saved-food search, recents, reverse macro math), an edit-entry flow, day-to-day copy flows, and a daily-targets editor with macro→kcal auto-computation.

The backend for all of this is **already merged to `main`** (`server/api/nutrition.ts`, PR #136). This design was built directly against that API's verified contracts — see "API mapping" below for exactly which UI element maps to which route.

## About the Design Files
The files in this bundle are **design references created in HTML** — an interactive prototype showing intended look and behavior, not production code to copy. Your task is to **recreate this design in the Bacta client** (`client/src/`, React + the existing component library) using its established patterns: `SectionShell`, `TopBar`/`BottomBar`, `MX4Card`/`TransmissionPanel`, `Sheet`, `Rail`, the primitives in `client/src/components/primitives/`, and `SECTION_ACCENTS` from `client/src/theme.ts`.

To view the prototype: open `Nutrition.dc.html` in a browser (it loads `support.js` and `ios-frame.jsx` from the same folder). It is fully interactive — log, edit, delete, copy, navigate days, edit targets, build recipes.

## Fidelity
**High-fidelity.** Colors, typography, spacing, and copy are final intent and match the live Bacta visual system (read from the actual repo source, not the v3 prototype). Recreate pixel-perfectly using existing components; where an existing component (e.g. `Rail`, `Sheet`) already implements a pattern shown here, use it rather than re-deriving styles.

## Design tokens (verbatim from `client/src/theme.ts` — do not redefine, import)
- Section accent: `#3ecf8e` (`SECTION_ACCENTS.nutrition`) — colors the section frame ONLY
- MX-4 identity: `#2bc4e8` (bacta cyan) — sigil, BottomBar chrome, Overview/Library toggle stay cyan
- Background: `#0f1117` · Card: `#111827` · Border: `#27384a`
- Text: `#f4f7fb` primary · `#94a3b8` secondary · `#56657a` faint
- Status: `#4ade80` positive · `#fbbf24` warn (over-target bars) · `#f87171` danger (delete)
- Fonts: 'Hanken Grotesk' (body/names), 'JetBrains Mono' (labels, numbers, all-caps microcopy)
- Card radius 9–14px · sheet top radius 22px · accent left-edge bar 2px on entry cards
- Texture: scanline + 26px grid overlay tinted with section accent at ~3.5% opacity (see `bactaTexture.ts`)

## Screens / Views

### 1. Overview (default tab)
Top-to-bottom:
1. **Day navigator** — ‹ / center pill / › row. Center pill shows relative label (TODAY / YESTERDAY / TOMORROW / "N DAYS AGO" / "IN N DAYS", 10.5px mono 700) over absolute date ("SAT · JUL 12", 8px mono). Pill border is accent-tinted on today, `#27384a` otherwise; tapping the pill returns to today. Arrows are 34×34 cards.
2. **MX-4 briefing card** — ONLY rendered on today. Standard `MX4Card` shape: accent-tinted gradient header with animated sigil, "MX-4 // NUTRITION" title, timestamp, POSITIVE/CAUTION/FLAG chip; body headline (mono, accent) + prose summary + DIRECTIVE box (accent left border); footer chips (KCAL x/y · LOGGED n · FLAGS n) + telemetry bars. Copy comes from `useBriefing` (`mx4_briefings`) — prototype copy is placeholder.
3. **Ledger rail** — Rail component: left label "TODAY · SO FAR" (past: "CLOSED DAY · {rel}", future: "PLANNED · {rel}"); right side is a button: "TARGET SET {date} · EDIT ›" → opens Targets sheet.
4. **Ledger hero card** — accent gradient card with corner brackets + 2px top edge glow. Left: "REMAINING TODAY" (past: "ENDED THE DAY", future: "BUDGET") over remaining kcal (34px mono 700; negative shows −N), subline "{logged} logged · target {target}". Right: standing chip ("N UNDER TARGET" / "N OVER TARGET", accent pill with breathing dot). Below: 4 macro rows (PROTEIN/CARBS/FAT/FIBER) — 52px label, 6px progress bar (accent; `#fbbf24` when over target), right-aligned "N g left" / "N g over" (92px).
5. **Today's log rail** — "TODAY'S LOG" + "{n} ENTRIES · {time}" (time only on today).
6. **Meal groups — SPARSE.** One group per meal type that has entries (breakfast→lunch→dinner→snack order, then any custom types). Group header: meal label (mono, accent) · hairline · [COPY TO TODAY chip — only when viewing a non-today day] · "{kcal} KCAL". Entry card: 2px accent left bar; name (13.5px Hanken 600) + lock glyph if food-linked; subline "{qty} {unit} · saved food|ad-hoc"; right: kcal (15px mono 700, "—" if null) + "P n · C n · F n" chips (null → "—"). Tap → Edit sheet. Below entries: dashed "+ ADD TO {MEAL}" button.
7. **Missing meals** — meals with NO entries render as a horizontal row of dashed affordance buttons: "+ {MEAL}" / "NOT LOGGED YET". Never render empty meal cards.

### 2. Library (second dock tab)
Rail "FOOD LIBRARY · {n} FOODS · {m} RECIPES". Three modes:
- **List**: two accent buttons (+ NEW FOOD / + NEW RECIPE); FOODS rail + rows (name, "per {qty} {unit} · kcal · P/C/F", ✕ delete); RECIPES rail + rows (name + RECIPE badge, "{n} ingredients · {s} servings · {kcal} kcal / serving", ✕ delete — deleting a recipe also deletes its per-serving food). Footer note: recipes save as custom foods (per serving); no separate recipe store in v1.
- **New food**: name; default qty + unit (this becomes the LOCKED logging unit — say so in microcopy); per-qty macro grid (KCAL/P/C/F/FB); save button "SAVE FOOD — SEARCHABLE IMMEDIATELY" → `POST /api/nutrition/foods`.
- **New recipe**: name + servings; ingredient list (each row: name, editable qty input, unit, live-scaled kcal, ✕); "Add from saved foods…" search; "+ AD-HOC INGREDIENT" expanding form; RECIPE TOTAL / PER SERVING live summary; save → computes per-serving macros (total ÷ servings, kcal rounded, macros to 0.1) and saves as a food with qty 1 / unit "serving" via `POST /foods`. ‹ BACK TO LIBRARY returns to list.

### 3. Log Entry sheet (bottom sheet, opens from any + button)
Slides up (0.36s cubic-bezier(.22,.61,.36,1)) over blurred backdrop; grab handle; header: hex glyph + "LOG ENTRY" + "{MEAL} · {date}"; ✕ close. Content order:
1. **Search input** ("Search saved foods…") — substring match against saved foods.
2. **Empty-state hint** (no query): "{n} saved foods & recipes · reference database grows as you save foods — or log ad-hoc below, nothing to search is normal".
3. **RECENT · ONE TAP TO RE-LOG** (no query): up to 4 most-recent distinct entries (name+unit dedupe) with qty/kcal/P subline and "+ LOG" — tap clones it into the current meal/day and closes the sheet.
4. **Manage-library link**: "FOOD LIBRARY — RECIPES & CUSTOM FOODS / MANAGE ›" → switches to Library tab.
5. **Results** (query): rows with name, "per {qty} {unit} · kcal · P n · unit locked to {unit}", CUSTOM/RECIPE badge. **No match**: dashed card — 'No match for "{q}" in saved foods' + "LOG IT DIRECTLY BELOW — SAVE IT AS A FOOD TO MAKE IT SEARCHABLE NEXT TIME".
6. **Selected food card** (after picking a result): name + CLEAR ✕; qty input next to a **locked unit chip** (lock glyph + unit + "LOCKED") — the unit is NEVER editable for food-linked logging (API 400s on mismatch, both POST and PUT); auto-rescale preview "auto: {kcal} kcal · P · C · F"; microcopy explaining no conversion in v1 → ad-hoc is the escape hatch. Below, **NO MACRO MATH — SET QTY FROM A GOAL**: P/C/F/KCAL chip selector + goal input; qty recomputes as goal ÷ (macro per unit), hint "≈ 237 g hits 40 g P".
7. **Quick Track (ad-hoc)** (when no food selected): meal chips (BREAKFAST/LUNCH/DINNER/SNACK); free name; qty + unit (any); "MACROS OPTIONAL — LOG WHAT YOU KNOW, LEAVE THE REST BLANK"; KCAL/P/C/F/FB grid (blank → null, displayed as —); **SAVE AS FOOD** toggle (creates a custom food via `POST /foods` alongside the log entry).
8. **LOG ENTRY** submit button → `POST /api/nutrition/log`.

### 4. Edit Entry sheet
Header "EDIT ENTRY / {name} · {MEAL}". Quantity input; unit is a **locked chip** for food-linked entries (free input for ad-hoc). Microcopy: food-linked — "LINKED TO A SAVED FOOD — UNIT IS FIXED, NO CONVERSION · CHANGING QUANTITY RESCALES EACH MACRO UNLESS YOU OVERRIDE IT BELOW · TO CHANGE THE FOOD ITSELF, DELETE AND RE-LOG"; ad-hoc — "ALL FIELDS FREE · BLANK MACROS STAY UNKNOWN (SHOWN AS —)". Macro grid prefilled (null → blank). When viewing a non-today day, a "COPY THIS ITEM TO TODAY" button appears above the action row. Actions: DELETE (danger, `DELETE /log/:id`) + SAVE CHANGES (`PUT /log/:id` — send ONLY fields the user explicitly changed; the server rescales unchanged macros per-field).

### 5. Targets sheet
Header "DAILY TARGETS / TARGET SET {date} · APPLIES FROM TODAY FORWARD". MACRO GOALS grid (P/C/F/FIBER grams): **editing any of P/C/F recomputes the kcal goal = P×4 + C×4 + F×9** (fiber excluded — say so). CALORIE GOAL input can be overridden directly; live indicator "MATCHES MACROS ✓" (accent) vs "MACROS SUM TO {n}" (warn) with ±2 kcal tolerance; the next macro edit snaps kcal back to the sum. SAVE TARGETS → `POST /api/nutrition/targets` (date-keyed upsert; rail label updates to today's date).

### 6. Copy flows (cross-day)
Navigate to a past/future day → each meal header gets a COPY TO TODAY chip (copies the whole meal, same meal slot) and each entry's edit sheet gets COPY THIS ITEM TO TODAY. Both create fresh entries dated today (`POST /log` per item) and navigate back to today. There is no copy UI inside the log sheet.

## Interactions & Behavior
- Sheets: translateY slide-up 0.36s cubic-bezier(.22,.61,.36,1); backdrop fade to rgba(6,9,14,0.62) + 3px blur; tap backdrop or ✕ to dismiss.
- Progress bars: width transitions; over-target flips bar to `#fbbf24` with matching glow.
- Breathing dots (2.6s ease-in-out scale/opacity) on status chips; spinning dashed ring on MX-4 sigil (14s linear).
- Tabs (Overview/Library) live in the BottomBar's clipped-corner segmented control — cyan, NOT accent. Opening Library resets it to list mode.
- All hit targets ≥ 34px; primary buttons full-width in sheets.
- Null macro anywhere renders "—", never 0.

## State Management
Per the existing section-page pattern (`RecoveryPage` etc.):
- `date` (view date) — drives `GET /log?date=`, `GET /summary?date=`; day nav = ±1 day; center pill resets to today.
- `GET /log` returns `{meals, daily}` where **`meals` is a sparse object** — keys exist only for meal types with entries. Render groups from present keys (breakfast/lunch/dinner/snack order, then unknown keys); render missing-meal affordances from absent keys. `meal_type` is an open string.
- `GET /summary` returns `{target, actual, remaining}`; `target` can be null → design a "no target set yet" state (prototype assumes a target exists; treat null as: hero shows logged totals without remaining/standing, rail shows "NO TARGET SET · SET ›").
- Foods: `GET /foods?q=` (case-insensitive substring). **The reference table ships empty** — cold-start UX (hint copy, ad-hoc-first ordering) is deliberate, keep it.
- Recipes: no dedicated backend store in v1 — a saved recipe materializes as a custom food (per serving) via `POST /foods`. Keep ingredient composition client-side (or add a table later); deleting a recipe should delete its food.
- Recents: derive from recent log entries (dedupe by name+unit), newest first, cap 4.
- Briefing: `useBriefing('nutrition')` — existing hook/components; only rendered for today.

## API mapping (verified against `server/api/nutrition.ts` on `main`)
- Log list → `GET /api/nutrition/log?date=` · create → `POST /log` · edit → `PUT /log/:id` (per-macro rescale; unit must match food's stored unit or 400) · delete → `DELETE /log/:id`
- Ledger/summary → `GET /api/nutrition/summary?date=` (`target` nullable, `remaining` per-macro nullable)
- Targets → `GET/POST /api/nutrition/targets?date=` (upsert `ON CONFLICT(date)`)
- Foods → `GET /api/nutrition/foods?q=`, `POST /api/nutrition/foods`
- Copy flows → plain `POST /log` per copied item with today's date
- Reverse macro math, kcal-from-macros, recipe per-serving math → client-side only
- All routes behind `requireAuth`, same as other sections.

## Assets
No image assets. All iconography is inline SVG (hex glyphs per the Bacta sigil system, lock, copy, chevrons, refresh) — reuse `Sigil`/`MX4Sigil`/`NavIcon` primitives where they exist.

## Files
- `screenshots/` — captures of each screen/state (01 overview-today, 02 log-sheet quick track, 03 search results, 04 selected food with locked unit, 05 edit entry, 06 targets, 07 library list, 08 new recipe, 09 yesterday with COPY TO TODAY)
- `Nutrition.dc.html` — the full interactive prototype (single file: template + logic; open in a browser)
- `ios-frame.jsx` — presentation-only iPhone frame around the prototype; NOT part of the design
- `support.js` — prototype runtime; NOT part of the design

## Out of scope (by design — do not build)
Barcode/photo scanning, micronutrients, unit conversion, branded-food coverage (Open Food Facts import was deliberately dropped), Trends tab (designed earlier, cut in favor of Library; revisit later — trend data shape matches existing `Bars7`/`TrendRow`/`Sparkline` components).
