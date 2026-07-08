# Nutrition Section — Brief for Claude Design

> **Status: DONE.** This is a brief/prompt for a *future* Claude Design session per `docs/PLUGINS.md`'s documented workflow — it is **not** a design, not component code, not a mockup, and not a color palette beyond the one accent already assigned. It hands Claude Design three things: the accent color, the data types available, and the section's character — exactly what that workflow document says a new-section design session needs. Everything below is grounded in the finished `docs/NUTRITION_PLAN.md` (data model §3, API design §4) — nothing here invents a data shape the backend plan doesn't actually produce.
>
> When a human hands this to a Claude Design session, that session should also be pointed at `design_bacta-handoff-package/Bacta - Prototype v3.html` for the existing visual system (Recovery/Sleep/Training/Home), same as `bacta-feature`'s own Phase 0 read protocol requires — this brief supplements that reference, it doesn't replace it. Note also: the v3 prototype has **no** existing Nutrition content to match against (confirmed by grepping the prototype HTML) — this is genuinely new visual ground, not an extension of prior Nutrition design work.

## Accent color

**`#3ecf8e`** — already reserved for `nutrition` in `client/src/theme.ts`'s `SECTION_ACCENTS`, confirmed live in the codebase (not just from CLAUDE.md, which has a documented history of carrying stale accent values). `theme.ts`'s own inline comment calls this "clinical green" — take that as a color description, not a mandate on section *character* (see below; this brief pushes back gently on reading too much into that adjective).

As with every other section, MX-4's own sigil, the BottomBar, and the Overview/Trends toggle stay `#2bc4e8` (bacta cyan) regardless of being inside the Nutrition section — accent colors the section's frame around him, never his own identity.

## Data types available

Every shape below is something the finished backend (`docs/NUTRITION_PLAN.md` §3–§4) can actually return today, once built — not a placeholder. Grouped by what a design session would reach for:

**Today's log (`GET /api/nutrition/log?date=`):**
- Individual logged entries: name, quantity + unit, calories, protein_g, carbs_g, fat_g, fiber_g, meal_type, logged_at (time of day)
- Entries grouped by meal (breakfast / lunch / dinner / snack, or a free-form label)
- Per-meal subtotals (calories + each macro) and a full-day total

**Targets and target-vs-actual (`GET /api/nutrition/targets`, `GET /api/nutrition/summary?date=`):**
- Daily targets: calories, protein_g, carbs_g, fat_g, fiber_g — each independently settable, not derived from a single formula in v1
- Target − actual = remaining, per macro, for "today" — this is the natural analog to Recovery's gauge/Sleep's efficiency-ring pattern: a single day's progress-against-a-goal
- Targets are historical/date-keyed, not a single fixed number — a target set 3 weeks ago and never changed since is still "current"; a target changed last week shows as a change if trend history is surfaced

**Trend history (`GET /api/nutrition/trend?days=`):**
- N days (design can request up to 30, mirroring Garmin trend caps elsewhere) of daily totals per macro, zero-filled for days with no logging — unlike sparse Garmin metrics, a nutrition trend chart has no legitimate "missing" days, only "zero logged" days, and the two should probably look visually distinct (a logged zero-calorie day is really a *logging gap*, not a real zero)
- This is the same shape `Bars7`/`Sparkline`/`TrendRow` already consume elsewhere (`fetchTrend(metric)`-equivalent) — a trend view here can likely reuse those existing components rather than needing new chart primitives, though that's an implementation call, not a design mandate

**Food reference data (`GET /api/nutrition/foods?q=`, `POST /api/nutrition/foods`):**
- A searchable reference database (bulk-imported from USDA FoodData Central + Open Food Facts, tagged by `source`) — name, brand (for packaged foods only — generic/whole foods have no brand), and per-100g-or-similar macro profile
- User-saved custom/ad-hoc foods, same shape, tagged `source='custom'` — these are indistinguishable in shape from the bulk-imported reference data, just user-authored
- **What's NOT available:** barcode data as a scannable input (no camera-driven lookup exists — search is by name/text only), no photo-based recognition, no micronutrients surfaced through the API even though the underlying data may have them (see plan §7, open question)

**MX-4 narrative (`mx4_briefings` via the same `useBriefing` pattern every other section uses):**
- A `{tone, headline, summary, body, recommendation, flags}` briefing object, same shape as Recovery/Sleep/Training/Home — `MX4Briefing`/`TransmissionPanel` components already handle this shape, no new briefing-rendering component should be needed
- MX-4's nutrition narrative specifically synthesizes: today's target-vs-actual, a 14-day pattern (macro shortfall, meal-timing, weekend/weekday divergence), and one concrete directive — per `docs/NUTRITION_PLAN.md` §5's `promptAddendum`

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
- **A "today, so far" ledger view** as the Overview-tab default — given the character notes above, this is probably the natural home for the target-vs-actual data, likely analogous in spirit to Recovery's hero gauge but reading as a running balance rather than a score.
- **Meal-grouped log list** for reviewing/editing a day's entries — the data is already meal-grouped by the API (§4's `GET /log`), so this is a natural fit rather than something requiring new aggregation.
- **A trend view reusing existing chart primitives** (`Bars7`, `Sparkline`, `TrendRow`) rather than new ones, given the trend data shape matches what those components already consume elsewhere — worth validating during design rather than assuming new chart components are needed.
- **Search-as-you-type against the reference food database** for the common case (logging a known food), falling back visibly to the ad-hoc/Quick-Track path when a search comes up empty — the backend supports both paths natively (§4), so the UI's job is mostly to make the fallback feel like a fast alternative, not a dead end.
