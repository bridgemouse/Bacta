# Nutrition Section — Brief for Claude Design

> **Status: REVISED 2026-07-12 — the full backend (Phases 1–8) is merged to `main`.** This is a brief/prompt for a *future* Claude Design session per `docs/PLUGINS.md`'s documented workflow — it is **not** a design, not component code, not a mockup, and not a color palette beyond the one accent already assigned. It hands Claude Design three things: the accent color, the data types available, and the section's character — exactly what that workflow document says a new-section design session needs.
>
> **What changed in this revision:** the previous revision (2026-07-11) described a still-open PR. **PR #136 has since been reviewed (a fresh-context `/code-review` pass found and fixed 9 real bugs) and merged to `main`** — every data-shape claim below is now verified against the actual merged code (`server/api/nutrition.ts`), not a branch in flight. Two corrections from the review fixes that matter for design:
> 1. **Editing an existing log entry now validates/rescales per-macro, not all-or-nothing.** A prior bug meant providing any one macro override in a `PUT` request silently froze the other four at stale values; this is fixed, and `PUT` now enforces the same unit-match rule `POST` always did (see "Unit handling" below).
> 2. **The food reference table still ships empty** — this hasn't changed. Bulk-import *code* (mapping + loader, Phases 7–8) is built, tested, and merged, but **no one has run it against real data yet** (see the Food reference data section below for exactly what that means for a cold start).
>
> Unchanged from the prior revision, still true: **the meal-grouped log response has no fixed shape** — it's an object keyed by whatever meal types actually have entries that day, with no guaranteed `breakfast`/`lunch`/`dinner`/`snack` structure, even as empty placeholders.
>
> If this brief and the live code (`server/api/nutrition.ts`, `tests/server/nutrition.test.ts`) ever disagree, trust the code — the same discipline the plan document applied to itself when it red-teamed its own citations.
>
> When a human hands this to a Claude Design session, that session should also be pointed at `design_bacta-handoff-package/Bacta - Prototype v3.html` for the existing visual system (Recovery/Sleep/Training/Home), same as `bacta-feature`'s own Phase 0 read protocol requires — this brief supplements that reference, it doesn't replace it. Note also: the v3 prototype has **no** existing Nutrition content to match against (confirmed by grepping the prototype HTML) — this is genuinely new visual ground, not an extension of prior Nutrition design work.

## Accent color

**`#3ecf8e`** — already reserved for `nutrition` in `client/src/theme.ts`'s `SECTION_ACCENTS`, confirmed live in the codebase (not just from CLAUDE.md, which has a documented history of carrying stale accent values). `theme.ts`'s own inline comment calls this "clinical green" — take that as a color description, not a mandate on section *character* (see below; this brief pushes back gently on reading too much into that adjective).

As with every other section, MX-4's own sigil, the BottomBar, and the Overview/Trends toggle stay `#2bc4e8` (bacta cyan) regardless of being inside the Nutrition section — accent colors the section's frame around him, never his own identity.

## Data types available

Every shape below is the **actual, verified** request/response contract read from `server/api/nutrition.ts` on `main` (merged via PR #136) — not the plan's description of what it would eventually return. All routes sit behind the same `requireAuth` gate as every other section; no new auth pattern for a frontend hook to handle.

**Today's log — `GET /api/nutrition/log?date=<iso>`:**
```json
{
  "meals": {
    "breakfast": {
      "entries": [{ "id": 12, "date": "2026-07-11", "meal_type": "breakfast", "logged_at": "...",
                     "food_id": 4, "name": "Oatmeal", "quantity": 200, "unit": "g",
                     "calories": 778, "protein_g": 33.8, "carbs_g": 132.6, "fat_g": 13.8, "fiber_g": 21.2 }],
      "totals": { "calories": 778, "protein_g": 33.8, "carbs_g": 132.6, "fat_g": 13.8, "fiber_g": 21.2 }
    }
  },
  "daily": { "calories": 778, "protein_g": 33.8, "carbs_g": 132.6, "fat_g": 13.8, "fiber_g": 21.2 }
}
```
- **`meals` has no fixed shape.** It's a plain object keyed by whatever `meal_type` strings actually have entries that day — a day with only lunch logged has exactly one key, `meals.lunch`, and no `meals.breakfast`/`meals.dinner`/`meals.snack` at all, not even as empty arrays. **Design must not assume all four standard slots are present or ordered** — the UI needs to render "no lunch logged yet" from the *absence* of a key, and pick its own display order for whichever meal-type strings show up (since `meal_type` is an open string, per FR2, mirroring `health_activities.type_key` — a user can log under any label, not just the four conventional ones).
- `calories`/`protein_g`/`carbs_g`/`fat_g`/`fiber_g` on an individual entry **can be `null`** — an ad-hoc entry only stores whatever macros the user actually supplied when logging it. Design a null/blank treatment (e.g. "—") rather than assuming every entry has all five values.
- Log entries: `POST /api/nutrition/log` (create), `PUT /api/nutrition/log/:id` (edit — returns the updated row directly), `DELETE /api/nutrition/log/:id` (returns `{ok: true}`). Errors are `{error: string}` with status 400 (invalid `food_id`, or a `unit` that doesn't match the chosen food's stored unit — see "Unit handling" below) or 404 (editing/deleting an id that doesn't exist).
- **Unit handling, a real UI constraint:** logging against a reference food requires the exact `unit` that food was stored in (e.g. `'g'`) — there is no unit conversion in v1. A mismatched unit is rejected with a 400, not silently converted, **on both `POST` (create) and `PUT` (edit)** — an edit that tries to change a food-linked entry's `unit` to anything other than that food's stored unit is rejected the same way a bad create would be. Design implication: once a user picks a reference food, its unit should probably be shown as fixed/read-only everywhere — at creation and in any edit view (a quantity field next to a locked unit label), not a free-choice dropdown. The ad-hoc/Quick-Track path is the escape hatch for anything logged in a different unit.
- **Editing quantity (or unit) on a food-linked entry rescales macros server-side, per macro field, not all-or-nothing.** If the same edit request also explicitly supplies a new value for a given macro (e.g. a manual correction to `calories`), that field is left exactly as given — but every *other* macro not explicitly overridden still rescales to the new quantity. So an edit UI that changes only quantity, or quantity plus one manually-corrected value, doesn't need to build its own recompute logic for the rest — the API handles each field independently. There's no route to *reassign* which food an entry links to — changing the underlying food requires delete + re-log.

**Targets and target-vs-actual — `GET/POST /api/nutrition/targets?date=`, `GET /api/nutrition/summary?date=`:**
```json
// GET /api/nutrition/summary?date=2026-07-11
{
  "target":    { "date": "2026-06-01", "calories": 2200, "protein_g": 180, "carbs_g": 220, "fat_g": 70, "fiber_g": 30 },
  "actual":    { "calories": 778, "protein_g": 33.8, "carbs_g": 132.6, "fat_g": 13.8, "fiber_g": 21.2 },
  "remaining": { "calories": 1422, "protein_g": 146.2, "carbs_g": 87.4, "fat_g": 56.2, "fiber_g": 8.8 }
}
```
- `target` can be `null` (no target has ever been set as of the requested date) — design a "no target set yet" state, not just a zero-target state.
- `target.date` is whichever date the *effective* target was set on, which can be much earlier than the requested date — targets are historical/date-keyed (`POST /targets` upserts via `ON CONFLICT(date) DO UPDATE`, matching this codebase's real upsert convention), not a single mutable settings row. A target set weeks ago and never changed is still "current."
- `remaining` values can individually be `null` (if `target` itself is null, or a specific macro was never set) — per-macro null handling, not an all-or-nothing summary.

**Trend history — `GET /api/nutrition/trend?days=N`:**
```json
{ "days": [ { "date": "2026-07-05", "calories": 0, "protein_g": 0, "carbs_g": 0, "fat_g": 0, "fiber_g": 0 }, "... one entry per day, oldest first" ] }
```
- `days` clamps to 1–30 (`Number(days) || 7` then clamped) — identical expression to `/api/garmin/activities?days=`, including its quirk that `days=0` is falsy and falls back to the default of 7 rather than clamping to a floor of 1. Cap any day-range selector UI at 30 to match.
- Zero-filled for days with no logged entries — unlike sparse Garmin metrics, a nutrition trend has no legitimate "missing" day, only a "zero logged" one, and the two should probably look visually distinct (a logged zero is a *logging gap*, not an accomplishment — see character notes below).
- Same per-day shape `Bars7`/`Sparkline`/`TrendRow` already consume elsewhere — likely reusable rather than needing new chart primitives, though that's an implementation call, not a design mandate.

**Food reference data — `GET /api/nutrition/foods?q=`, `POST /api/nutrition/foods`:**
- **Ships empty — still true as of this revision, but not because the import code doesn't exist.** Phases 7–8 (USDA FoodData Central + Open Food Facts mapping and a batch-import loader/CLI) are built, tested, and merged to `main`. What hasn't happened is running them: USDA's Foundation Foods + SR Legacy JSON files are already downloaded and staged on the host, but nobody has executed the import yet, and Open Food Facts' bulk export was checked (12.46 GB compressed, likely 100+ GB uncompressed) and deliberately not pursued — its size isn't worth the container-storage/streaming-rewrite cost for a single-user app when USDA already covers whole/generic foods. So: `GET /foods?q=` returns `{"foods": []}` for *any* query today, exactly as it did before Phases 7–8 existed, and will keep doing so until someone runs `npx tsx scripts/nutrition/importFoods.ts --usda <path>` — a one-command, already-possible step, not a blocked one. **This is the single biggest design-relevant fact in this brief:** a "search-as-you-type against a database" mental model is wrong for the experience a user will actually have at launch. The real first-run experience is "there is nothing to search yet — log ad-hoc, optionally save it as a personal food for next time," and the reference table grows from user-saved custom foods (via `POST /foods`, immediately searchable) regardless of whether the USDA import is ever run. Design for that cold-start — don't assume a populated database, even though the mechanism to create one now exists.
- Search matches `name` case-insensitively, substring (`LIKE '%q%'`) — no fuzzy matching, no ranking beyond alphabetical.
- Custom-saved and USDA-imported (once someone runs the import) foods return the identical shape — `id`, `source` (`'custom'` or `'usda'`), `name`, `brand` (packaged foods only, `null` for generic/custom — USDA's Foundation/SR Legacy data is all generic, so `brand` will be `null` for every imported row even after the import runs), `default_qty`/`default_unit` (the unit logging against this food is locked to, per "Unit handling" above), `calories`/`protein_g`/`carbs_g`/`fat_g`/`fiber_g` (per `default_qty`). Open Food Facts (`source: 'openfoodfacts'`, the source of packaged/branded products and their `brand` values) is not going to be imported for the foreseeable future per the decision above — design should not assume branded-food coverage even long-term.
- **Still not available:** barcode scanning (no camera-driven lookup), photo-based recognition, micronutrients surfaced through the API (the data may exist in `source_json` once/if a food is imported, but nothing beyond the five macros above is queryable today).

**MX-4 narrative (`mx4_briefings` via the same `useBriefing` pattern every other section uses):**
- A `{tone, headline, summary, body, recommendation, flags}` briefing object, same shape as Recovery/Sleep/Training/Home — `MX4Briefing`/`TransmissionPanel` components already handle this shape, no new briefing-rendering component should be needed
- MX-4's nutrition narrative specifically synthesizes: today's target-vs-actual, a 14-day pattern (macro shortfall, meal-timing, weekend/weekday divergence), and one concrete directive — per `docs/NUTRITION_PLAN.md` §5's `promptAddendum`, now live in `server/lib/ai/sections.ts`

## Section's character

**Proposed character: the ledger channel — MX-4's most collaborative, least autonomic voice.**

Every other built section (Recovery, Sleep, Training) narrates data MX-4 observes passively — HRV, sleep stages, training load are all sensed, not reported by the user. Nutrition is structurally different: **every data point in this section exists because the user chose to log it.** That's not a minor implementation detail — it's the honest basis for a distinct character, grounded in what a macro tracker actually is rather than in the "clinical green" color-name association `theme.ts`'s comment might suggest.

Recommendation: Nutrition should feel less like "MX-4 interpreting your biology" (Recovery's readiness synthesis, Sleep's architecture scoring) and more like **MX-4 keeping the books alongside you** — attentive to a commitment the user is actively making, not a signal he's passively reading off a sensor. Concretely:
- **Less "verdict," more "standing."** Recovery/Sleep lean on POSITIVE/CAUTION/FLAG verdicts because the data is diagnostic. Nutrition's target-vs-actual is closer to a running balance than a diagnosis — the tone should read more like "here's where the day/week stands" than "here's what's wrong with you." MX-4's TC-99 curiosity and Two-Boots protocol-transparency traits (docs/MX4.md) both fit naturally here: he can be genuinely interested in a pattern (a consistent protein shortfall on training days) without moralizing about it.
- **Explicitly not clinical/coral like Blood Work.** Blood Work (`#ef6f6c`, coral) is the section for lab-panel markers with reference ranges and flags — a genuinely clinical frame. Nutrition sharing a loosely similar "health data" surface with Blood Work is a trap worth naming explicitly so a design session doesn't default Nutrition into that same visual/verbal register just because both involve "numbers about the body." Nutrition's green is closer to a ledger-balance color (in-the-black/in-the-red framing) than a lab-normal-range color.
- **Acknowledge logging gaps honestly, without guilt-tripping.** A day with zero logged entries is a data gap, not a success — MX-4's Two-Boots-derived clarity-over-deference trait means he should say "no entries logged today" plainly rather than either praising an accidental zero or scolding the user for not logging. This is a real character risk specific to this section (no other section has a "the user didn't do the thing" case to navigate) worth flagging to whoever designs the empty/gap states.
- **The daily rhythm matters more here than in any other section.** Recovery/Sleep are naturally "check once a day, in the morning" sections. Nutrition is the one section where the *same day* is live and changing as the user logs more meals — the Overview should probably read as "today, so far" rather than "last night" the way Sleep does, and the visual design should anticipate a day going from empty → partially logged → fully logged rather than a single static nightly snapshot.

## Interaction patterns worth prototyping (suggestions, not mandates)

Claude Design owns the actual visual/interaction design — these are ideas surfaced by the competitor research in `docs/NUTRITION_PLAN.md` §1 worth considering, not requirements:

- **A fast, low-friction entry flow** is the single highest-leverage UX decision for any food tracker (this is the universal lesson across all four researched products) — Macros First's confirmed "Quick Track" pattern (freeform named entry, no search, for restaurant/homemade food — verified directly against `help.macrosfirst.com`, see `docs/NUTRITION_PLAN.md` §1) is a cheap, high-value pattern worth prototyping given this app already has the matching ad-hoc-entry escape hatch (FR3) in the backend. (An earlier draft of this brief also cited a "meal-memory default" pattern attributed to Macros First; that claim didn't hold up under source-checking and has been removed — see the plan's §1 research-integrity note.)
- **Revised given the real backend: Quick Track/ad-hoc entry is the primary path at launch, not a fallback.** The original version of this bullet framed search as the common case and ad-hoc as the escape hatch — that assumed a populated food database. As of this revision the *import mechanism* exists (Phases 7–8, merged) but hasn't been run, and Open Food Facts never will be (see "Food reference data" above) — so `GET /foods?q=` still returns nothing for almost anything the user types today, and will keep doing so for branded/packaged foods indefinitely. Design the entry flow so ad-hoc logging is the fast, unembarrassing default, and treat "save this as a food for next time" (`POST /foods`, FR8) as the mechanism that gradually makes search useful — a search box that visibly shows "nothing yet — log it directly" is more honest than one that implies a database is behind it and comes up empty.
- **A "today, so far" ledger view** as the Overview-tab default — given the character notes above, this is probably the natural home for the target-vs-actual data, likely analogous in spirit to Recovery's hero gauge but reading as a running balance rather than a score. Handle a `null` target (no target ever set) as its own state, not a zero-target.
- **Meal-grouped log list** for reviewing/editing a day's entries, built to render from a *sparse* `meals` object (only the meal types actually logged that day are present as keys — see above) rather than a fixed four-slot grid. A day with nothing logged for dinner should show no dinner section at all (or an explicit "add dinner" affordance), not an empty dinner card implying data that doesn't exist.
- **A trend view reusing existing chart primitives** (`Bars7`, `Sparkline`, `TrendRow`) rather than new ones, given the trend data shape matches what those components already consume elsewhere — worth validating during design rather than assuming new chart components are needed. Cap any day-range control at 30 to match the API's clamp.
- **When logging or editing an entry against a saved food, show its unit as fixed, not editable** — the backend rejects a unit that doesn't match the food's stored `default_unit` with no conversion, on both create and edit (see "Unit handling" above). Let quantity vary freely on either flow; route anything needing a different unit to the ad-hoc path instead of presenting a unit picker that can silently 400.
