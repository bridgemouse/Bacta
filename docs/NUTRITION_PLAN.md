# Nutrition / Macro Tracker — Backend Plan

> **Status: DONE — all sections (§0–§7) complete, red-teamed and corrected 2026-07-08.** An adversarial self-review found and fixed: a research citation error (Macros First claims conflated with MacroFactor's help site — §1), an unjustified sub-claim about MacroFactor's food-database partnerships (§1), a scope-discipline issue in the sprint plan (bulk food-import was sequenced as a false prerequisite — §6), a nonexistent test-pattern citation (§6), and a concrete hidden dependency where adding the nutrition section would silently break two existing tests (§6, Phase 6). Not yet reviewed or approved by the human operator. No application code has been touched — this is a planning document only.
>
> Companion document: `docs/NUTRITION_DESIGN_BRIEF.md` (brief for a future Claude Design session — not a design itself).

---

## 0. Codebase orientation (DONE)

Facts established by reading the codebase directly (not from memory/docs alone — verified live where noted):

- `client/src/pages/NutritionPage.tsx` is a bare stub: `<AppShell section="nutrition"><SectionShell section="nutrition" /></AppShell>`. No data, no hook.
- `macrofactor_snapshots` table exists (`server/db/schema.sql`) with the same EAV shape as `health_snapshots` (`date, metric, value, unit, source_json`, `UNIQUE(date, metric)`). **Verified live via `bacta-sqlite` MCP: 0 rows.** The MacroFactor third-party integration this table was built for is abandoned (CLAUDE.md now frames Nutrition as a major custom-built feature, not a pass-through integration).
- `client/src/theme.ts` reserves `nutrition: '#3ecf8e'` (clinical green) in `SECTION_ACCENTS`, `'Nutrition'` in `SECTION_LABELS`, `🥗` in `SECTION_ICONS`. `nutrition` is not yet in `BUILT_SECTIONS` (`['home', 'recovery', 'sleep', 'training']`) — adding it is what makes the Overview/Trends toggle appear for the section.
- Three live sections (Recovery, Sleep, Training) share one shape: a data hook (`use{Section}Data.ts`) that calls `fetchSummary()`/`fetchTrend(metric)`/`fetchSources()` against `/api/garmin/*`, a page component that renders viz components against that hook's output, and a `SECTIONS` entry in `server/lib/ai/sections.ts` that tells the MX-4 orchestrator what to pull and how to narrate it.
- `health_activities` is a dedicated (non-EAV) table specifically because activities are multi-row-per-day entities — EAV's `UNIQUE(date, metric, source)` constraint can't represent that. **Food logging has the identical shape problem** (multiple foods per meal, multiple meals per day) — this is the load-bearing precedent for rejecting EAV for logged nutrition entries in favor of a normalized table, same as activities.
- Router conventions observed directly in `server/api/bloodwork.ts` and `server/api/manual.ts`: plain `Router()`, no explicit `requireAuth` call in the route file itself (auth is mounted centrally — `server/index.ts` fronts `/api/*` with the `requireAuth` gate except `/api/health` and `/api/auth/*`), upsert pattern is `INSERT INTO ... VALUES (...) ON CONFLICT(...) DO UPDATE SET ...` (not `INSERT OR REPLACE` as CLAUDE.md's shorthand suggests — the real convention in existing route code is the SQLite `ON CONFLICT` upsert form). Immutable EAV rows use `INSERT OR IGNORE` (per `health_snapshots` poller writes).
- `server/lib/ai/tools.ts`'s `queryDb` tool is a single read-only `SELECT`/`WITH` gate against `dbReadonly`, with the schema description hardcoded in the tool's `description` string (this string will need a `food_log`/`foods` mention once nutrition tables exist, and `docs/MX4_REFERENCE.md` needs a new Data Dictionary section — same as recovery/sleep/training got).
- `server/lib/ai/sections.ts`'s `SectionDef` shape: `{ id, name, metrics: string[], includeManual: boolean, promptAddendum: string }`. `metrics` is used to pre-fetch a 30-day window before the LLM call; `promptAddendum` mirrors a consistent internal structure (what to pull via `queryDb`, how to lead the summary, a fixed `## HEADER` list for the body, the "entire response must be analysis prose" guardrail line repeated verbatim in all three).
- Design system hard constraints (from `docs/DESIGN_SYSTEM.md`, `docs/DEVELOPMENT.md`, `.claude/skills/bacta-feature/SKILL.md`, `bacta-component/SKILL.md`): inline styles only, dark UI always, `theme.ts` colors only, `hexA()` for alpha, `FONT_MONO` for all numbers/labels, `FONT_UI` for narrative, `CARD_SIZES` as `minHeight`, no new CSS keyframes. These bind the design brief (Step 4) and any future implementation, not this plan directly — noted here so the phased sprint plan doesn't accidentally spec frontend work.
- `bacta-feature` skill's Phase 0 read protocol requires opening `design_bacta-handoff-package/Bacta - Prototype v3.html` before any UI work — this plan's Step 4 deliverable (the design brief) is what feeds a *new* Claude Design session, whose output then becomes the reference for that Phase 0 the next time a human/headless session builds the Nutrition UI.

## 1. Research summary

**Status: DONE — red-teamed 2026-07-07.** All four products researched via parallel web-research agents. A subsequent adversarial pass re-fetched the highest-stakes primary sources directly (not just trusting agent citations) and found a real error: the sub-agent researching MacroFactor/Macros First conflated `help.macrofactorapp.com` (MacroFactor's help site) with `help.macrosfirst.com` (Macros First's actual help site) — two easily-confused domains — and attributed several MacroFactor-flavored claims to Macros First without noticing the mismatch. That section has been corrected below using direct re-fetches of the *actually correct* domain. Every other claim in this section was spot-checked against at least one primary source fetched directly during the red-team pass (USDA bulk-download claim, Open Food Facts bulk-export claim, MacroFactor's NCC food-database claim) and held up.

### Research integrity note (from the red-team pass)

Trust a sub-agent's *tool-use count* (it fetched real pages) but not automatically its *domain attribution* — an agent can genuinely fetch a page and still mislabel which product it's describing, especially across near-identical subdomains. The Macros First error below was caught by re-fetching the exact cited URL and checking its logo/branding, not by re-reading the agent's prose more carefully.

### SparkyFitness (open source, self-hosted — closest philosophical match)

Repo: [github.com/CodeWithCJ/SparkyFitness](https://github.com/CodeWithCJ/SparkyFitness). Postgres 15+, Docker-first, RLS-based multi-tenancy. Confirmed live from its actual `db_schema_backup.sql`, not marketing copy.

**What to borrow:**
- **Clean three-way split**: `foods`/`food_variants` (reference database, `is_custom` flags user-added ones) vs. `food_entries` (the diary log — many rows per meal-type per day) vs. `meals`/`meal_foods` (reusable named multi-food composites, closer to a "recipe" than a raw log row). This maps directly onto Bacta's existing `health_activities`-vs-EAV precedent: logged entries need a real table, not EAV, because there are multiple per day.
- **Provider-tagged reference foods**: `foods.provider_type` + `provider_external_id` records which external database (OpenFoodFacts, USDA, Nutritionix, FatSecret, Swiss Food DB) a reference food came from. Worth mirroring in simplified form — see food-database decision below.
- **`user_goals` is per-date**, not a single mutable settings row — goal changes over time stay visible in history. Matches FR5's reasoning independently.
- **Denormalized nutrient snapshot on the diary row itself** (`food_entries` stores its own copy of the nutrient values at log time, not just a FK to `food_variants`) — protects historical entries from silently changing if the reference food's data is later corrected/updated. Worth adopting.

**What to avoid:** Postgres-specific types (`uuid`, `jsonb`, `text[]`) don't map to SQLite/better-sqlite3 — would need `INTEGER PRIMARY KEY`/TEXT UUIDs, TEXT-serialized JSON, and join tables instead of arrays. RLS is multi-tenant machinery Bacta doesn't need (single user). Live multi-provider API integration (4+ external nutrition APIs with per-user credentials) is more moving parts than a single-user homelab app should carry — the bulk-import approach (below) gets most of the value with none of the live-dependency risk.

### MacroFactor (adaptive TDEE/macro coaching)

Does **not** use a static formula for ongoing targets — it reverse-calculates true TDEE from logged weight-trend vs. logged intake (published methodology, Stronger By Science). Full recalculation weekly; the expenditure estimate itself refines continuously. Needs fairly consistent weight logging (daily ideal, weekly minimum, missed weigh-ins interpolated) and fairly consistent food logging (gaps hurt accuracy more than missed weigh-ins do). [Algorithm accuracy](https://macrofactorapp.com/algorithm-accuracy/), [TDEE explainer](https://help.macrofactorapp.com/en/articles/230-what-is-total-daily-energy-expenditure-tdee). **Food database (re-verified directly against the primary source during the red-team pass):** the only source MacroFactor names explicitly is the **NCC (Nutrition Coordinating Center) Food and Nutrient Database** (~26,500 micronutrient-complete common foods) — confirmed by direct fetch of [help.macrofactorapp.com/en/articles/46-food-search-database](https://help.macrofactorapp.com/en/articles/46-food-search-database), which states other sources are unnamed ("actively scouting new sources") and does **not** mention Open Food Facts, FatSecret, or Nutritionix anywhere. The original research pass's claim of "a ~1.36M-item branded database partnered with Open Food Facts" is **not supported by this primary source** and has been removed — it may have been conflated from a different product's documentation (see the Macros First correction below for a confirmed instance of exactly this kind of mix-up in the same research batch). Treat MacroFactor's branded-food sourcing beyond NCC as **unverified**.

**What to borrow (as a narrative idea, not a v1 build item):** MX-4 already narrates HRV/sleep/training trend data — a nutrition section that eventually correlates logged-intake trend against logged-weight trend to comment on whether current eating supports stated goals is a genuine differentiator for Bacta, consistent with MX-4's "systems analyst across domains" character. **Explicitly deferred past v1** (§2.3) — the actual adaptive-TDEE algorithm is its own research-heavy statistics project that needs real logging data to validate against; nothing here should be built before the core logging loop exists.

**What to avoid:** Full adaptive-coaching UX (its own onboarding flow, its own settings surface) as a v1 requirement — scope creep relative to what Bacta needs first.

### Macros First (minimal, scope-disciplined)

**Corrected during the red-team pass.** The original research batch cited `help.macrofactorapp.com` articles (MacroFactor's help site) as if they were Macros First documentation, and reported two features — "meal-memory default" and "batch add" — that could not be re-verified once the correct domain (`help.macrosfirst.com` / `macrosfirst.com`) was actually checked. It also claimed Macros First had no recipe feature and used a static Mifflin-St Jeor formula, both of which turned out to be wrong or unverifiable. What follows is what's actually confirmed:

- Deliberately excludes: social feed, AI coaching layer, prescriptive meal plans; markets itself as doing "one thing." [MacrosFirst vs MyFitnessPal](https://www.blog.macrosfirst.com/post/macrosfirst-vs-myfitnesspal) (a genuine `macrosfirst.com` domain — this citation held up).
- **Quick Track is real and re-confirmed** directly against the correct domain: [help.macrosfirst.com/en/articles/25-quick-track](https://help.macrosfirst.com/en/articles/25-quick-track) — a freeform named entry (e.g. "date night dinner") logged without searching the food database, auto-calculating calories from entered macros if calories is left blank. Genuinely useful ad-hoc-entry precedent, confirmed.
- **"Meal-memory default" and "batch add" — retracted, unverified.** Direct fetch of the Quick Track article and a targeted search turned up no mention of either. These may have been hallucinated, or attributed from a different product entirely (plausibly MacroFactor, given the domain conflation above, though MacroFactor's own fetched pages didn't confirm them either). **Do not treat these as real Macros First features.**
- **Recipe feature — corrected.** Macros First does have one: [help.macrosfirst.com/en/articles/16-recipes-create-edit-and-copy](https://help.macrosfirst.com/en/articles/16-recipes-create-edit-and-copy) ("Recipes: Create, Edit, & Copy"). The original claim that recipe support was "not yet present" was wrong.
- **Target-setting — corrected, weaker claim than originally stated.** Could not verify a Mifflin-St Jeor/activity-multiplier/goal-offset formula from any Macros First source. What *is* confirmed: users can manually set macro targets and/or a calorie target, and the app auto-derives whichever one is missing using the standard 4/4/9 kcal-per-gram protein/carb/fat conversion (a Premium "Macro Math" feature; [help.macrosfirst.com articles list](https://help.macrosfirst.com/en/articles/34-daily-goal), [why don't my macros add up](https://help.macrosfirst.com/en/articles/12-why-dont-my-macros-add-up-to-my-calories)). No adaptive weight-trend mechanism was found (unlike MacroFactor) — so "not adaptive" still holds — but the specific BMR-formula claim does not, and is dropped.

**What to borrow:** The confirmed "ad-hoc entry with no search" pattern (Quick Track → this plan's FR3) is a real, sourced precedent. The scope-discipline signal (no social, no AI coach, no meal-plan prescriptions) still directly validates this plan's §2.3 cut list — that part didn't depend on the retracted claims. The "meal-memory default" idea has been removed from the design brief's interaction-pattern suggestions (it was cited there too) since it's unverified as a real product pattern, not because it's a bad idea in the abstract.

### MyFitnessPal (ceiling of scope)

20.5M-entry crowdsourced food database (quality-inconsistent — a known complaint). [How the database works](https://blog.myfitnesspal.com/how-food-database-works/) Logging via manual search, barcode scan, photo-based "Meal Scan," or voice. Diary segmented breakfast/lunch/dinner/snacks; recipe builder computes per-serving macros from ingredient lists. Free tier: search logging, barcode scan, basic tracking, social feed, ads. Premium tiers add faster logging modes, macros-by-meal, custom per-day goals, meal-plan builder, grocery-list integration. [Pricing tiers](https://blog.myfitnesspal.com/myfitnesspal-membership-pricing-tiers/)

**What Bacta explicitly cuts relative to this ceiling:** all social/community features, tiered paywalls and ads (not applicable — single user, not a commercial product), photo-based meal recognition and voice logging (real capabilities, but native-mobile-shaped and AI-integration-shaped — deferred, see §2.3), grocery-list/shopping integration (no applicable "shopping" concept in this app). What's kept from the ceiling: search-based logging, a recipe/composite-meal concept (via SparkyFitness's `meals` pattern), and a meal-segmented diary.

### Food-database decision: bulk-import USDA FoodData Central + Open Food Facts

**Recommendation: bulk-import both into local SQLite tables via a one-time/periodic batch script (same *operational* shape as `garmin_ingest.py` — run manually/periodically, not a live service; see §6 for the specific implementation-language decision, which departs from Python) — do not build a from-scratch ingredient database, and do not call any nutrition API live at request time.**

Rationale, weighed against Bacta's real constraints (single user, `better-sqlite3` synchronous driver, self-hosted, no Docker requirement):

- **USDA FoodData Central**: free API key (rate-limited 1,000 req/hr — irrelevant once bulk-imported), and critically, **publishes quarterly bulk CSV/JSON dumps** for Foundation Foods, SR Legacy, and Branded Foods. [Download Datasets](https://fdc.nal.usda.gov/download-datasets/) Foundation Foods + SR Legacy (whole/generic foods — fruit, meat, grains) is small (~6.5MB JSON) and government-verified with a full macro + deep micronutrient panel — good primary source for the common-food case.
- **Open Food Facts**: nightly bulk CSV/JSONL exports are the *recommended* path for anything beyond casual API use — OFF explicitly discourages high-volume live API use in favor of self-hosted exports. [Data, API and SDKs](https://world.openfoodfacts.org/data) 4M+ branded/packaged products, ODbL-licensed (share-alike only applies if redistributing a combined database — irrelevant for Bacta's private internal use). Strongest at exactly what USDA is weakest at: barcoded/packaged grocery products.
- **Nutritionix** effectively has no viable free tier anymore (~$1,850/mo). **FatSecret** has a genuine free tier but is a live-API-only product (no bulk export) — a worse fit for the synchronous-SQLite/local-cache model than the two bulk-importable sources above.
- **This directly satisfies NFR1/NFR2**: a batch import script (run once at setup and re-run periodically to pick up updates — mirrors `garmin_ingest.py`'s existing operational pattern, though not its implementation language; see §6) requires no new always-on service, no Docker, no live network dependency at query time, and keeps `queryDb`/food-search fast and local.
- **Borrowed from SparkyFitness**: tag each imported reference food with a `source` column (`'usda'` / `'openfoodfacts'` / `'custom'`) so provenance is visible — same idea as SparkyFitness's `provider_type`, simplified from "live multi-provider API with per-user credentials" down to "an import-time source tag," which is all a single-user bulk-import model needs.
- **Sequencing correction from the red-team pass**: this section resolves *what* to eventually import; it does not mean bulk-import has to exist before the Nutrition section is useful. §6 (below) resequences the bulk-import work to the *end* of the sprint plan as an enhancement, not a prerequisite — see the scope-discipline note at the top of §6 for why.

## 2. Requirements

**Status: DONE.** Functional/non-functional requirements below were drafted before §1's research returned and reviewed again after — unchanged, since they're derived from the codebase's own constraints (schema precedent, write conventions, auth model) rather than from competitor feature sets. Research did validate several choices independently (see §1's "what to borrow" notes cross-referencing FR3/FR5/§2.3).

### 2.1 Functional requirements

**Logging**
- FR1: User can log a food entry (name, quantity, unit, macros, meal type, timestamp) via an API endpoint. (No UI is designed or built in this plan — see `docs/NUTRITION_DESIGN_BRIEF.md`.)
- FR2: A food entry belongs to one of a small fixed set of meal types (breakfast/lunch/dinner/snack) plus a free-form label option — mirrors `health_activities.type_key`'s open-string-but-conventionally-constrained pattern rather than a rigid enum, since a self-hosted single-user app shouldn't hard-fail on an unanticipated meal label.
- FR3: User can log an entry either against a reference food (from a local food database) or as a fully ad-hoc entry (name + manually entered macros) — MyFitnessPal/SparkyFitness both need this escape hatch for homemade/restaurant food that isn't in any database. Ad-hoc entries do not require a `foods` row.
- FR4: User can edit or delete a logged entry for any past date (corrections happen after the fact — e.g., forgot to log lunch until dinner).
- FR5: User can set daily macro/calorie targets (calories, protein, carbs, fat at minimum). Targets are a point-in-time record, not a single mutable row — target changes over months should be visible in history (mirrors why `health_snapshots` is date-keyed rather than a single "current settings" row).

**Reference data**
- FR6: A local food/ingredient reference table exists so common foods don't need to be re-entered with macros every time. It starts empty and grows from user-saved custom foods (FR8) from day one; bulk-importing USDA/Open Food Facts data (§1's sourcing recommendation) is a later enhancement, not a v1 prerequisite — see §6's scope-discipline correction.
- FR7: User can search the reference food table by name when logging (server does the filtering — `WHERE name LIKE ?` is adequate at single-user single-digit-thousands-of-rows scale; no need for a search engine).
- FR8: User can save an ad-hoc entry as a new personal reference food for reuse (the "quick-add favorite" pattern common to all four researched products).

**Reads / aggregation**
- FR9: API can return a given day's logged entries grouped by meal, with per-meal and daily macro/calorie totals.
- FR10: API can return target-vs-actual for a given day (targets from FR5, actuals summed from FR9).
- FR11: API can return N-day trend history of daily totals (mirrors `fetchTrend(metric)` pattern already used by every other section's hook).

**MX-4 integration**
- FR12: MX-4 can query nutrition data via the existing `queryDb` tool (read-only) — no new tool needed, same as every other section.
- FR13: A `nutrition` entry exists in `server/lib/ai/sections.ts` `SECTIONS`, producing a briefing in the existing `mx4_briefings` shape.

### 2.2 Non-functional requirements

- NFR1: SQLite via better-sqlite3 (synchronous driver) — all queries must be fast enough not to block the Node event loop noticeably at single-user scale (thousands of rows, not millions). No async DB layer needed.
- NFR2: No new runtime dependency that requires Docker, a second process, or a network service — consistent with "no Docker yet" and the single-LXC deployment model. A bulk-imported local food database (flat file → SQLite import script, run once) is acceptable; a dependency on a second running service (e.g., a local Postgres, a search daemon) is not.
- NFR3: Follows existing auth model — routes sit behind the central `requireAuth` gate in `server/index.ts`; no new auth scheme.
- NFR4: Follows existing write-pattern conventions — `ON CONFLICT ... DO UPDATE` for upsertable rows (targets, ad-hoc food saves), `INSERT OR IGNORE`-style immutability where rows represent an immutable historical log entry (a logged meal entry, once logged, is edited by explicit UPDATE/DELETE endpoints, not by silent overwrite).
- NFR5: No new background service/cron needed for the backend sprint plan in §6 — unlike Garmin/wearables, there is no external polling source; all writes are user-initiated. (A future "photo → macro estimate via AI" feature would need a job-like flow, but that's out of scope per §2.3.)
- NFR6: Single user — no per-user scoping, no multi-tenant concerns, consistent with every other table in this schema.

### 2.3 Out of scope (explicitly rejected, to keep scope visible)

- **Barcode scanning.** Requires camera access + a barcode→product lookup service; MyFitnessPal/SparkyFitness both have it, but it's a mobile-native capability that doesn't fit a PWA-first, backend-planning-only pass. Revisit if/when the native app aspiration (tracked in memory) materializes.
- **Recipe builder** (multi-ingredient recipes saved as a single reusable logged item with computed aggregate macros). Real feature, real value, but is a second data-model layer on top of the food reference table — deferred to a follow-up phase after the core logging loop ships and proves out, not because it's a bad idea.
- **Social features** (any of it — friends, feeds, sharing). Bacta is single-user; this has zero applicability.
- **Photo-based / AI macro estimation from a picture of a meal.** Real differentiator some competitors are adding, but it's a distinct AI-integration project (vision model call, uncertainty handling) layered on top of a logging system that doesn't exist yet. Out of scope for this plan; worth a future issue once the core loop is live.
- **Adaptive TDEE/macro-target coaching** (MacroFactor's core differentiator — auto-adjusting targets from logged weight trend vs. intake). Flagged as a candidate MX-4 narrative feature in §5, but the plan does NOT propose building MacroFactor's actual adaptive algorithm as a v1 backend feature — that's a distinct, research-heavy statistical model (weight-trend regression against logged intake) that deserves its own design pass once real logging data exists to validate against. v1 targets are user-set, static until manually changed (FR5).
- **Third-party MacroFactor account integration.** Explicitly abandoned per `CLAUDE.md`/`docs/ROADMAP.md` — Nutrition is custom-built, not a pass-through.
- **Micronutrient tracking** (vitamins, minerals beyond the "big 4" macros + fiber). USDA FDC has this data if the food-db decision uses it, so it's not blocked structurally, but no UI/API surface is specified for it in this plan — a natural low-cost follow-up once the food reference table has the data, not a v1 requirement.
- **Water/hydration tracking.** Different data shape (a running daily counter, not a macro), no existing precedent in this schema, not requested by any project doc — cut for scope discipline (mirrors Macros First's own restraint signal from §1).

## 3. Data model

**Status: DONE.** Verified against the real `server/db/migrate.ts` pattern (read directly, not assumed): new tables go in `server/db/schema.sql` as `CREATE TABLE IF NOT EXISTS` (applied idempotently on every startup via `db.exec(schema)`), and one-time structural changes (renames, drops, column adds) go in `migrate.ts` as explicit idempotent blocks guarded by a `sqlite_master` existence check — exactly the pattern already used for the `garmin_*` → `health_*` renames and the `#41` `health_activities` column expansion.

### 3.1 `macrofactor_snapshots` resolution: **drop**, don't repurpose

Confirmed live via `bacta-sqlite` MCP: 0 rows (re-confirmed during the red-team pass by pulling the live `sqlite_master` DDL directly, not just re-reading the schema.sql file — the live table matches the checked-in schema exactly, no drift). Its EAV shape (`UNIQUE(date, metric)`, one row per metric per day) cannot represent the real requirement — multiple foods logged per meal, multiple meals per day — for the exact reason `health_activities` exists as a dedicated table instead of EAV (CLAUDE.md's own stated precedent). Repurposing it would mean fighting the schema from day one.

**"Actually justified, not just assumed" check (red-team pass):** a full-repo grep for `macrofactor` (`server/`, `client/`, `scripts/`, `mx4/`) turns up exactly one hit — the table's own `CREATE TABLE IF NOT EXISTS` line in `schema.sql`. No route, hook, orchestrator file, or script reads or writes it. The drop has zero blast radius beyond the table itself.

**Recommendation: drop it and create purpose-built tables below.** Migration:

```typescript
// in migrate(), following the exact pattern of the garmin_snapshots→health_snapshots block above
const hasMacrofactorSnapshots = db.prepare(
  "SELECT name FROM sqlite_master WHERE type='table' AND name='macrofactor_snapshots'"
).get()
if (hasMacrofactorSnapshots) {
  // Verified empty (0 rows) as of 2026-07 — safe to drop without a data-preserving INSERT step,
  // unlike the garmin_* renames above which carried real data forward.
  db.exec('DROP TABLE macrofactor_snapshots')
  console.log('[db] dropped unused macrofactor_snapshots')
}
```

### 3.2 New tables (add to `server/db/schema.sql`)

```sql
-- Reference food/ingredient data. Bulk-imported from USDA FoodData Central (SR Legacy +
-- Foundation Foods) and Open Food Facts, plus user-saved custom/ad-hoc foods (source='custom').
-- Macro values are per (default_qty, default_unit) — e.g. per 100g — mirroring how both
-- USDA and OFF publish their data, so import requires no unit conversion at write time.
CREATE TABLE IF NOT EXISTS foods (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  source       TEXT NOT NULL,              -- 'usda' | 'openfoodfacts' | 'custom'
  source_id    TEXT,                       -- USDA fdcId or OFF barcode/code; NULL for custom foods
  name         TEXT NOT NULL,
  brand        TEXT,                       -- packaged/branded foods only; NULL for generic/whole foods
  default_qty  REAL NOT NULL DEFAULT 100,  -- the quantity the macro columns below refer to
  default_unit TEXT NOT NULL DEFAULT 'g',
  calories     REAL,
  protein_g    REAL,
  carbs_g      REAL,
  fat_g        REAL,
  fiber_g      REAL,
  source_json  TEXT,                       -- raw import payload — mirrors health_snapshots' source_json,
                                            -- lets a future micronutrient feature (§2.3, deferred) mine
                                            -- fields we don't surface yet without re-importing
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(source, source_id)
);
CREATE INDEX IF NOT EXISTS idx_foods_name ON foods(name);

-- Logged diary entries. One row per food per meal per day — the same multi-row-per-day
-- shape as health_activities, for the same reason (EAV can't represent it).
-- Nutrient columns are a denormalized snapshot at log time (mirrors SparkyFitness's
-- food_entries design): editing or re-importing a `foods` row later must never silently
-- change what a past day's log says was eaten.
CREATE TABLE IF NOT EXISTS food_log_entries (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  date        TEXT NOT NULL,               -- ISO date this entry counts toward
  meal_type   TEXT NOT NULL,               -- 'breakfast' | 'lunch' | 'dinner' | 'snack' | free-form label
  logged_at   TEXT NOT NULL DEFAULT (datetime('now')),
  food_id     INTEGER REFERENCES foods(id),-- NULL for a fully ad-hoc entry (FR3)
  name        TEXT NOT NULL,               -- denormalized display name, always present
  quantity    REAL NOT NULL,
  unit        TEXT NOT NULL,
  calories    REAL,
  protein_g   REAL,
  carbs_g     REAL,
  fat_g       REAL,
  fiber_g     REAL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_food_log_entries_date ON food_log_entries(date);

-- Daily macro/calorie targets. Date-keyed (not a single mutable settings row) so target
-- changes over months stay visible in history — same reasoning as user_goals in SparkyFitness,
-- and the same "don't overwrite history" instinct behind health_snapshots being date-keyed.
-- "Current" targets = the row with the latest date <= the date being queried.
CREATE TABLE IF NOT EXISTS nutrition_targets (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  date       TEXT NOT NULL UNIQUE,         -- date this target set takes effect from
  calories   REAL,
  protein_g  REAL,
  carbs_g    REAL,
  fat_g      REAL,
  fiber_g    REAL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

**Design notes:**
- **Verified, not assumed (red-team pass):** `server/db/client.ts` calls `db.pragma('foreign_keys = ON')` — confirmed by reading the file directly. This means `food_log_entries.food_id REFERENCES foods(id)` is a **real, enforced** constraint, not documentation-only. A `POST /log` with a `food_id` that doesn't exist in `foods` will throw a foreign-key constraint error at the DB layer (a good thing — it's a cheap correctness guard), not silently insert a dangling reference. One consequence worth flagging for whoever implements this: SQLite's default FK action is effectively RESTRICT — if a `foods` row is ever deleted while `food_log_entries` rows still reference it, that delete will fail. This plan's API design (§4) has no `DELETE /api/nutrition/foods/:id` route, so this isn't an active concern in v1, but it's worth knowing before anyone adds one.
- No separate "favorites" table for FR8 (save ad-hoc entry as reusable food) — that's just an `INSERT INTO foods (source='custom', ...)`, then future log entries reference it via `food_id`. One fewer table, no duplicated concept.
- `food_log_entries` intentionally has **no** `UNIQUE` constraint blocking duplicate-looking rows (same food, same meal, same day) — logging two coffees at breakfast is a real, valid case, unlike `health_snapshots` where a metric truly can only have one value per day per source.
- Write pattern per NFR4: `foods` custom-save and `nutrition_targets` upsert use `INSERT ... ON CONFLICT DO UPDATE` (matching `bloodwork.ts`/`manual.ts`'s real convention); `food_log_entries` writes are plain `INSERT` (a new log entry) plus explicit `UPDATE`/`DELETE by id` for edits (FR4) — never a silent overwrite-on-conflict, because there's no natural uniqueness key to conflict on.
- `docs/MX4_REFERENCE.md` needs a new §2.x Data Dictionary section for these three tables once built (same treatment `health_snapshots`/`health_activities` already got), and `server/lib/ai/tools.ts`'s `QUERY_DB_DESCRIPTION` schema comment needs the three new table signatures added — both are called out again in §6 as explicit sprint tasks so they aren't forgotten the way `MX4_REFERENCE.md` was briefly stale after the multi-device table rename (a real incident logged in `docs/ROADMAP.md`).

## 4. API design

**Status: DONE.** Verified the exact router-mounting convention directly in `server/index.ts` (not assumed): every domain gets its own `Router()` in `server/api/`, imported and mounted in `index.ts` behind the shared `requireAuth` middleware — e.g. `app.use('/api/bloodwork', requireAuth, bloodworkRouter)`. New file `server/api/nutrition.ts`, mounted as:

```typescript
import nutritionRouter from './api/nutrition'
// ...
app.use('/api/nutrition', requireAuth, nutritionRouter)
```

All routes below are query-param or nested-path based (no bare `/:param` at the router root) — avoids the Express wildcard-swallowing bug class documented in `garmin.ts`/CLAUDE.md entirely, rather than needing to carefully order routes around it.

| Method | Path | Purpose | Requirement |
|---|---|---|---|
| `GET` | `/api/nutrition/foods?q=<search>` | Search reference foods by name (`WHERE name LIKE ?`, includes custom foods) | FR7 |
| `POST` | `/api/nutrition/foods` | Save a new custom/ad-hoc food for reuse (`source='custom'`) | FR8 |
| `GET` | `/api/nutrition/log?date=<iso>` | A day's logged entries, grouped by `meal_type`, with per-meal and daily macro/calorie totals | FR9 |
| `POST` | `/api/nutrition/log` | Log a new entry — either `{food_id, quantity, unit, meal_type, date}` (looked up + scaled from `foods`) or a fully ad-hoc `{name, quantity, unit, meal_type, date, calories, protein_g, carbs_g, fat_g, fiber_g}` | FR1, FR2, FR3 |
| `PUT` | `/api/nutrition/log/:id` | Edit a logged entry (any field) | FR4 |
| `DELETE` | `/api/nutrition/log/:id` | Delete a logged entry | FR4 |
| `GET` | `/api/nutrition/targets?date=<iso>` | The effective target set for a date — most recent `nutrition_targets` row with `date <= ?` | FR5, FR10 |
| `POST` | `/api/nutrition/targets` | Upsert a target set effective from a given date (`ON CONFLICT(date) DO UPDATE`) | FR5 |
| `GET` | `/api/nutrition/summary?date=<iso>` | Target-vs-actual for one day (composes `/log` totals against `/targets`) | FR10 |
| `GET` | `/api/nutrition/trend?days=<N>` | N-day daily-total history (calories + each macro per day) — same shape as `fetchTrend(metric)` already used by every hook via `garminApi.ts` | FR11 |

**Notes:**
- `POST /api/nutrition/log`'s food-lookup path computes the denormalized macro snapshot server-side at write time: `scaled = food.macro * (quantity / food.default_qty)` (adjusted for unit if `unit !== food.default_unit` — out of scope to build unit-conversion beyond simple mass/volume equivalence in v1; mismatched units on a reference food should reject with a 400 rather than silently guess, per FR3's "ad-hoc escape hatch" already covering the case where a reference food's unit doesn't fit).
- No route needs to be `EXTERNAL_DEP`/blocked-gated the way MacroFactor/Blood Work sections are — once the tables exist, every route here operates on data the user provides directly or that was bulk-imported ahead of time. This matters for §6's phased sprint plan clearing the `bacta-headless` triage gate cleanly.

## 5. MX-4 integration

**Status: DONE.** Verified directly against `server/lib/ai/orchestrator.ts` and `server/lib/ai/types.ts` (not assumed from `sections.ts` alone).

**Finding worth flagging (not this plan's to fix):** `SectionDef.metrics` and `SectionDef.includeManual` are declared in `types.ts`, populated on every existing section in `sections.ts`, but **never read anywhere in `orchestrator.ts`** (confirmed via grep — `runSection`/`runSectionById`/`runOrchestrator` only touch `section.id`, `section.name`, `section.promptAddendum`). They appear to be vestigial fields from an earlier design where the orchestrator pre-fetched a metric list before the LLM call; the current implementation just tells the model in the prompt to "use queryDb to pull the last 30 days of relevant metrics" and lets it decide. The nutrition entry below follows the existing convention (populates both fields for documentation consistency with the other three) rather than either fixing or removing the dead fields — that's an unrelated cleanup, noted in §7 Open Questions.

### New `SECTIONS` entry (`server/lib/ai/sections.ts`)

```typescript
{
  id: 'nutrition',
  name: 'Nutrition',
  metrics: [], // no health_snapshots metrics involved — see food_log_entries/nutrition_targets below
  includeManual: false,
  promptAddendum: `Pull today's and the last 14 days of logged food via queryDb against food_log_entries (NOT health_snapshots — this is a normal table, not EAV: SELECT date, meal_type, name, calories, protein_g, carbs_g, fat_g FROM food_log_entries WHERE date >= date('now', '-14 days') ORDER BY date, logged_at). Pull the effective target via nutrition_targets (most recent row with date <= today).

Sum today's logged totals against today's target — lead with whether the day is on track, over, or under, and by how much on the metric that matters most (usually protein or calories, use judgment from the trend). Note any day with zero logged entries as a logging gap, not a zero-calorie day — do not narrate a gap as an achievement.

Look for a pattern across the 14-day window: consistent shortfall on a specific macro, meal-timing patterns, or weekend/weekday divergence. Check your wiki for any documented goal (cut/maintain/bulk) before characterizing whether the trend is aligned with intent — do not assume a goal that isn't documented.

summary: 3–5 sentences. Today's target-vs-actual, the most significant multi-day pattern, one concrete action. No headers.
body: Use ## TODAY, ## PATTERN, ## DIRECTIVE. Bold all metric values. Bullets for multi-point findings.

Your entire response must be the analysis prose itself — never a summary of actions taken or a note about tools/wiki.`,
},
```

Mirrors the existing three sections' internal structure exactly (what to pull, how to lead, fixed `## HEADER` list, the verbatim closing guardrail line) — this is a real, load-bearing convention (every existing `promptAddendum` repeats it) worth preserving rather than "improving" in a one-off way.

### Supporting changes required elsewhere

- **`server/lib/ai/tools.ts`** — `QUERY_DB_DESCRIPTION` needs the two new table signatures added to its schema comment, same treatment `health_activities`/`mx4_briefings` already got:
  ```
  food_log_entries(id INTEGER, date TEXT, meal_type TEXT, logged_at TEXT, food_id INTEGER, name TEXT, quantity REAL, unit TEXT, calories REAL, protein_g REAL, carbs_g REAL, fat_g REAL, fiber_g REAL)
    — a normal table, NOT EAV like health_snapshots. Multiple rows per day (one per logged food).
  nutrition_targets(id INTEGER, date TEXT, calories REAL, protein_g REAL, carbs_g REAL, fat_g REAL, fiber_g REAL)
    — one row per date the targets changed. "Current" target = the row with the latest date <= the date in question.
  foods(id INTEGER, source TEXT, name TEXT, brand TEXT, calories REAL, protein_g REAL, carbs_g REAL, fat_g REAL, fiber_g REAL, default_qty REAL, default_unit TEXT)
    — reference/ingredient data, not user logs. Rarely needs querying directly by MX-4.
  ```
- **`docs/MX4_REFERENCE.md`** — needs a new §2.x "Data Dictionary — Nutrition" section documenting the three tables in the same table-format the existing Data Dictionary sections use, so it stays the single authoritative reference injected into every orchestrator run. This is explicitly called out because a stale/missing reference here caused a real production incident before (`docs/ROADMAP.md`'s "MX4_REFERENCE.md table name fix" — stale table names caused MX-4 to report "Biometric Database Inaccessible" for Recovery/Home). Do not let nutrition ship without this update.
- **No new tool needed.** `queryDb` already handles arbitrary read-only `SELECT`s against any table — normal (non-EAV) tables like `food_log_entries` work today with zero code changes to the tool itself, only its description string.
- **`home` section's synthesis** (`server/lib/ai/sections.ts`'s `home` entry) queries `mx4_briefings WHERE section IN (...)` — once nutrition is live, consider whether `home`'s prompt should be updated to include it in cross-channel synthesis. Left as an open question (§7) rather than a firm requirement, since Home's current three-channel (recovery/sleep/training) framing may or may not want a fourth voice — a product judgment call, not a technical one.

## 6. Phased backend sprint plan

**Status: DONE — restructured 2026-07-07 after red-team review.** Each phase is written in the `bacta-issues`/`bacta-headless` shape (description, acceptance criteria, a plausible failing test) so it can be filed with zero rework. All phases are backend-only per the task boundary — no frontend/UI phases here (that begins only after a Claude Design session consumes `docs/NUTRITION_DESIGN_BRIEF.md`).

**Scope-discipline correction (red-team finding — phases reordered from the original draft):** the original draft put bulk food-database import first, as if the Nutrition section needed a pre-populated food database to be useful. It doesn't. FR3 (ad-hoc entry) + FR8 (save-ad-hoc-as-custom-food) together let the user build their own personal food reference table organically, at zero import complexity, within the first few weeks of real use — which is realistically most of the value for a single person whose diet draws from a few hundred repeated foods. Bulk-importing USDA/OFF (~thousands to millions of foods neither this user nor almost any single user will ever search for) is real, defensible value for search-hit-rate on unfamiliar foods, but it is an **enhancement**, not a load-bearing prerequisite — building it first would gate a fully usable section behind a human multi-GB download step (§7, open question #2) for no structural reason. **Phases 1–6 below ship a complete, usable Nutrition section — logging, targets, trends, and MX-4 narration — using only user-entered data. Phases 7–8 (bulk import) are ordered last and can be deferred indefinitely without the section being incomplete.** This directly follows the project philosophy's instruction not to build complexity that doesn't earn its keep for one user on one LXC container.

**Design decision flagged, not researched:** the food-database bulk-import logic (Phases 7–8) is specified in **TypeScript**, not Python — a deliberate departure from the `garmin_poller.py`/`garmin_ingest.py` precedent. Reasoning: the Garmin scripts are Python because `garminconnect` is a Python library with no TS equivalent; USDA FDC and Open Food Facts are just static JSON/CSV/JSONL dumps with no language-specific client needed. Writing the mapping/import logic in TypeScript lets it live under the project's actual enforced test infrastructure (Vitest), rather than adding a second, untested-by-convention language surface. This is a judgment call, not a research finding — flagged again in §7 for confirmation.

**Prerequisite for Phases 7–8 only (human-executed, not a headless issue):** download the USDA FDC "Foundation + SR Legacy" JSON bulk export and an Open Food Facts JSONL/CSV export (or a filtered regional subset — the full OFF export is large) to a local path on LXC 109. This is genuinely `NOT_TESTABLE:EXTERNAL_DEP` — a multi-GB download from a third-party site isn't something to automate through the headless pipeline. Because of the reordering above, this prerequisite no longer blocks anything except the two enhancement phases at the end.

**Test-convention correction (red-team finding):** the original draft cited "the existing request/response test pattern used for `bloodwork.ts`/`manual.ts`" — a check during the red-team pass found **there is no `bloodwork.test.ts`** in `tests/server/`. The only real, verified precedent is `tests/server/manual.test.ts`: `supertest` against the live `app` export, `process.env.DB_PATH = ':memory:'` set at module scope, `migrate()` called in `beforeAll`, and `app`/`db` imported dynamically (`await import(...)`) inside each test body. Every route-test phase below cites this pattern specifically, not the nonexistent one.

---

**Phase 1 — Schema: nutrition tables + drop `macrofactor_snapshots`**
- Description: Add `foods`, `food_log_entries`, `nutrition_targets` to `server/db/schema.sql` (per §3.2). Add an idempotent migration block to `server/db/migrate.ts` that drops `macrofactor_snapshots` if present (per §3.1), following the exact existence-check pattern already used for the `garmin_*` → `health_*` renames.
- Acceptance criteria: after `migrate()` runs against a fresh or existing DB, `sqlite_master` contains `foods`, `food_log_entries`, `nutrition_targets`, and does NOT contain `macrofactor_snapshots`. Running `migrate()` twice in a row is a no-op the second time (no errors, no duplicate side effects).
- Failing test: a server test querying `sqlite_master` for the three new table names (fails now — tables don't exist) and asserting `macrofactor_snapshots` is absent after migration (fails now — table exists per the live DB check in §0).

**Phase 2 — Food search + custom-food save API**
- Description: `GET /api/nutrition/foods?q=` and `POST /api/nutrition/foods` in new `server/api/nutrition.ts`, mounted per §4. Depends only on Phase 1's `foods` table — works correctly with zero rows in it (search returns empty, custom-save populates it).
- Acceptance criteria: `GET ?q=chicken` returns foods whose `name` matches case-insensitively; `POST` with a valid ad-hoc food body inserts a `source='custom'` row and the same food is immediately returned by a subsequent search; `GET ?q=` against an entirely empty `foods` table returns an empty array, not an error.
- Failing test: route-level tests following the verified `tests/server/manual.test.ts` pattern (`supertest` + `:memory:` DB + dynamic `import()`) for both endpoints — search returns expected matches, custom-save round-trips through a search, empty-table search doesn't throw.

**Phase 3 — Food log CRUD API**
- Description: `GET/POST /api/nutrition/log`, `PUT/DELETE /api/nutrition/log/:id` per §4. The `POST` handler computes the denormalized macro snapshot server-side (scaled from `foods` when `food_id` is given; taken as-is for ad-hoc entries). Depends on Phase 1 (tables) and Phase 2 only insofar as `food_id`-based entries need a `foods` row to scale from — ad-hoc entries (FR3) have no dependency on Phase 2 ever having been used.
- Acceptance criteria: `POST` with `food_id` + `quantity` correctly scales macros (`food.calories * quantity/food.default_qty`, etc.); `POST` without `food_id` (ad-hoc) stores the caller-supplied macros as-is; `GET ?date=` returns entries grouped by `meal_type` with correct per-meal and daily totals; `PUT`/`DELETE` correctly mutate/remove a specific entry by id; `POST` with a `food_id` that doesn't exist in `foods` fails cleanly (the `foreign_keys = ON` pragma verified in §3 will throw at the DB layer — the route handler must catch this and return 400, not a raw 500).
- Failing test: route tests covering scaled-macro computation, ad-hoc storage, grouped-totals correctness (a day with 3 entries across 2 meals produces correct per-meal and daily sums), edit/delete round-trips, and the invalid-`food_id` 400 case.

**Phase 4 — Targets + summary API**
- Description: `GET/POST /api/nutrition/targets`, `GET /api/nutrition/summary?date=` per §4.
- Acceptance criteria: `POST /targets` upserts a row via `ON CONFLICT(date) DO UPDATE`; `GET /targets?date=X` returns the target row with the latest `date <= X` (not necessarily an exact match — a target set 2 weeks ago should still apply today if nothing newer exists); `GET /summary?date=X` returns `{target, actual, remaining}` computed by composing Phase 3's totals against the resolved target.
- Failing test: a test asserting `GET /targets?date=X` returns the correct historical row when queried for a date after the target was set but before any newer target exists; a test asserting `/summary` math is correct (target − actual = remaining, per macro).

**Phase 5 — Trend endpoint**
- Description: `GET /api/nutrition/trend?days=N` — daily calorie/macro totals for the last N days, zero-filled for days with no logged entries (a trend chart needs a continuous daily axis, unlike sparse Garmin metrics which can legitimately have gaps).
- Acceptance criteria: for a date range with some empty days, the response includes every day in the range (not just days with entries), with `0` totals for empty days; `days` param is clamped the same way `garmin.ts`'s `?days=` params are (e.g. max 30, mirroring `/api/garmin/activities?days=`).
- Failing test: a test seeding entries on 2 of 5 requested days and asserting the response has exactly 5 entries with correct zero-fill on the other 3.

**Phase 6 — MX-4 integration**
- Description: Add the `nutrition` entry to `SECTIONS` in `server/lib/ai/sections.ts` (§5); update `QUERY_DB_DESCRIPTION` in `server/lib/ai/tools.ts` with the new table signatures; add a Data Dictionary section to `docs/MX4_REFERENCE.md`.
- **Hidden dependency found in red-team review — must be handled explicitly, not discovered by trial and error:** two existing tests hardcode assumptions that break the moment a `nutrition` entry is added to `SECTIONS`, and neither is mentioned anywhere else in this plan:
  - `tests/server/sections.test.ts` asserts `expect(ids).toEqual(['recovery', 'sleep', 'training', 'home'])` (exact order) and `expect(s.metrics.length).toBeGreaterThan(0)` for every section except `home`. Adding `nutrition` with `metrics: []` (per §5's proposed entry) fails the second assertion immediately, and any run order fails the first.
  - `tests/server/orchestrator.test.ts` asserts `expect(rows.length).toBe(4)` and `expect(sections).toEqual(['home', 'recovery', 'sleep', 'training'])` (sorted) after calling the real `runOrchestrator()` (with `generateText`/`generateObject` mocked via `vi.mock('ai', ...)` — confirmed by reading the file directly; this is not a live-AI-API test, so it's genuinely reproducible in CI). Adding a fifth section breaks both.
  - **This phase's definition of done includes updating both test files**: change `sections.test.ts`'s array-equality to include `'nutrition'` in a decided position (see §7, open question — this plan places it after `training` and before `home`, i.e. `['recovery', 'sleep', 'training', 'nutrition', 'home']`, so that a future `home`-synthesis-includes-nutrition decision doesn't require re-ordering later), and either give `nutrition` a non-empty `metrics` array or add it to the same exclusion `home` gets in the "at least one metric" test (with a comment explaining why, mirroring the existing `home` exclusion's own inline reasoning). Change `orchestrator.test.ts`'s `toBe(4)` to `toBe(5)` and add `'nutrition'` to the sorted-array assertion.
- Acceptance criteria: `SECTIONS` contains an entry with `id: 'nutrition'` in the position decided above; `tests/server/sections.test.ts` and `tests/server/orchestrator.test.ts` both pass with the nutrition entry present (not just "a new test passes" — the two *existing* tests must still pass, updated to reflect five sections); running the orchestrator (mocked, per the existing test's own pattern) produces a `mx4_briefings` row with `section='nutrition'` and a non-empty `content_json`.
- Failing test: extend `tests/server/orchestrator.test.ts`'s existing `'writes a briefing row to mx4_briefings for each section'` test (or a colocated new one using the identical `vi.mock('ai', ...)` setup already in that file) to assert 5 rows including `'nutrition'`; extend `sections.test.ts` the same way. Both fail today because `SECTIONS` only has 4 entries — that's the real, accurate failing state, not a hypothetical one.

**Phase 7 — Food-reference import: mapping functions** *(enhancement — not required for Phases 1–6 to be complete and useful; see scope-discipline note above)*
- Description: Write pure TypeScript mapping functions — `mapUsdaFoodToRow(usdaJson)` and `mapOffProductToRow(offJson)` — that convert one record from each source's native JSON shape into a `foods`-table-shaped insert object (`source`, `source_id`, `name`, `brand`, `default_qty`, `default_unit`, `calories`, `protein_g`, `carbs_g`, `fat_g`, `fiber_g`, `source_json`). No network/file I/O in this phase — pure functions only, so they're trivially unit-testable without needing the actual multi-GB dump files present in CI.
- **Field-naming caveat found in red-team review, not independently re-verified against a live USDA FDC API response:** the acceptance criteria below states nutrient IDs 208/203/205/204/291. These are the classic USDA "nutrient number" codes (widely documented for the legacy SR database) — FDC's modern JSON export nests each nutrient as `{ nutrient: { id, number, name, unitName }, amount }`, where `number` (a string, e.g. `"208"`) is the classic code and `id` is a *different*, larger internal FDC identifier (commonly reported elsewhere as 1008/1003/1005/1004/1079 for the same five nutrients, though this plan did not independently confirm those specific values against a live API response). **Whoever implements this phase must fetch one real Foundation Foods record from the actual bulk download and confirm which field (`nutrient.number` vs `nutrient.id`) the fixture should match against before writing the mapping function** — do not assume the acceptance criteria's field name is exactly right without checking a real record first.
- Acceptance criteria: given a realistic sample USDA Foundation Foods JSON record (fixture, built from a real downloaded record — see caveat above), `mapUsdaFoodToRow` extracts calories/protein/carbs/fat/fiber by matching the correct nutrient code in whichever field actually carries it, and sets `source='usda'`, `source_id=String(fdcId)`. Given a sample OFF JSONL product record (fixture), `mapOffProductToRow` extracts per-100g values from `nutriments` (`energy-kcal_100g`, `proteins_100g`, `carbohydrates_100g`, `fat_100g`, `fiber_100g`) and sets `source='openfoodfacts'`, `source_id=code` (the barcode) — the OFF field names were not independently re-verified during the red-team pass and should also be checked against one real downloaded OFF record before the fixture is finalized.
- Failing test: unit tests asserting exact output shape/values for both mapping functions against fixture JSON snippets built from real downloaded records (fails now — functions don't exist).

**Phase 8 — Food-reference import: batch loader script** *(enhancement, depends on Phase 7)*
- Description: A `tsx`-run script (`scripts/nutrition/importFoods.ts`) that reads a local USDA JSON dump and/or OFF JSONL dump file (path via CLI arg, mirroring `garmin_ingest.py --days` flag-based convention), maps each record via Phase 7's functions, and writes to `foods` via `INSERT ... ON CONFLICT(source, source_id) DO UPDATE` (idempotent re-import — re-running with an updated dump refreshes existing rows instead of duplicating).
- Acceptance criteria: running the script against a small fixture dump file populates `foods` with the expected row count and values; running it twice does not duplicate rows (row count unchanged, values refreshed).
- Failing test: an integration test using a small fixture file (not the real multi-GB dump) asserting the row count and a specific known row's values in a temp/in-memory test DB after running the import function once, and asserting row count is unchanged after running it a second time.

---

No phase here requires `blocked`/`needs-design`/`needs-human-decision` gating — each has concrete, checkable acceptance criteria and a real failing test, so all eight clear the `bacta-issues`/`bacta-headless` triage gate as-is. The one true `EXTERNAL_DEP` item (downloading the bulk data files) is called out above as a human prerequisite for Phases 7–8 only, not filed as an issue, and no longer blocks the section from being usable.

## 7. Open questions

**Status: DONE.** Genuine product/human decisions this plan deliberately does not resolve unilaterally:

1. **TypeScript vs. Python for the bulk-import script (§6, Phase 7–8).** Flagged as a judgment call, not a research finding — the project's only existing bulk-import precedent (`garmin_ingest.py`) is Python, but for a language-agnostic static-file import, TypeScript gets real Vitest test coverage "for free." Confirm this is the right call before Phase 7 is filed, or state a preference for Python parity instead.
2. **How much of the USDA/OFF bulk data to actually import — and whether to bother at all for v1.** The full USDA Branded Foods dataset is ~3GB; the full OFF export is larger still (both confirmed via direct fetch during the red-team pass). A single-user app doesn't need every branded product on Earth, and per §6's scope-discipline correction, the section is fully usable without importing anything (FR3/FR8's ad-hoc-entry-and-save loop covers the common case). Needs a human call on: (a) whether Phases 7–8 are worth building at all before real usage reveals how often search-on-an-empty-database is actually annoying, and if so (b) a practical cutoff (e.g., USDA Foundation + SR Legacy only — a few thousand whole/generic foods, ~6.5MB — with OFF import deferred until a real gap in barcode/branded coverage is felt) versus importing everything up front. This plan's Phase 7/8 don't presuppose an answer to (b); the mapping functions work for either source independently.
3. **Should the `home` section's cross-channel synthesis include nutrition once it's live?** (§5, last bullet.) A product-voice decision about what MX-4's Home briefing should synthesize across, not a technical one. **Sequencing note:** §6 Phase 6 places `nutrition` in the `SECTIONS` run order *before* `home` (`[..., 'training', 'nutrition', 'home']`) specifically so this question can be answered "yes" later without needing a re-order — but the answer itself (whether `home`'s prompt should actually query and synthesize `nutrition`'s briefing) is still unresolved and left to the human.
4. **Meal-type vocabulary.** FR2 proposes an open string with conventional values (breakfast/lunch/dinner/snack) rather than a rigid enum, mirroring `health_activities.type_key`. Confirm this is the right amount of flexibility versus a stricter enum — affects nothing structurally either way (both are `TEXT` columns) but affects what the eventual UI needs to validate/present.
5. **Unit handling for `quantity`/`unit` on logged entries.** §4 notes that logging against a reference food whose `default_unit` doesn't match the caller's requested unit should reject with a 400 rather than attempt conversion. Is basic mass/volume conversion (g↔oz, ml↔cup) worth adding to v1, or is "log in whatever unit the reference food uses, or go ad-hoc" acceptable friction for a single user who'll quickly learn the pattern? Left as v1-acceptable-friction in this plan; revisit if it proves annoying in practice.
6. **Adaptive TDEE/macro coaching (§1, MacroFactor).** Explicitly deferred out of v1 (§2.3) as its own research-heavy project. Worth an explicit human decision on whether it's ever wanted as a Bacta feature, or whether static user-set targets (FR5) are the permanent design — affects nothing about this plan's phases either way, but affects the long-term roadmap framing.
7. **Micronutrient surfacing.** The `foods.source_json` column preserves USDA/OFF's full nutrient payload (§3.2) even though only 5 macros are surfaced in v1's schema/API. Worth a human call on whether micronutrient tracking is a real future want (informs whether it's worth normalizing into columns later, or leaving it in `source_json` for occasional `queryDb`-via-MX-4 lookups is sufficient).
