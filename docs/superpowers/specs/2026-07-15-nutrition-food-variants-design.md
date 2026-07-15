# Nutrition: Food Variants (Multi-Serving Model) — Design Spec

**Date:** 2026-07-15
**Branch:** TBD (create at implementation time)
**Status:** Approved — ready for implementation planning

---

## Overview

Bacta's Nutrition section (merged via PR #136/#138, food database populated 2026-07-15 from USDA FoodData Central) currently locks every food to exactly one serving definition: `foods.default_qty` + `foods.default_unit` (almost always `100g`). Logging against a reference food requires that exact unit — a mismatch is rejected with a 400, by design, with no conversion. This is a real UX cost: bread is naturally "1 slice," peanut butter is naturally "1 tbsp," but today the user must either know the USDA record's 100g-scaled macros for that portion or fall back to an ad-hoc entry.

Benchmarked against SparkyFitness (github.com/CodeWithCJ/SparkyFitness — the project's acknowledged benchmark for this feature), whose schema splits `foods` (identity) from `food_variants` (one row per servable unit, each with its own precomputed macros and an `is_default` flag). This spec brings Bacta to that same shape.

**Concrete motivating fact:** of the 8,156 USDA foods already imported, 7,818 (96%) carry real household-serving data in their raw `foodNutrients`/`foodPortions` payload (already sitting unused in `source_json`) — e.g. "2 tablespoons = 33.9g." This data is sitting idle today and can seed real variants with no new external data source.

**Out of scope for this spec** (each is either a separate future spec or a separate already-filed issue):
- Live multi-provider API integration (USDA/OFF/Nutritionix/FatSecret live search) — a second, later brainstorming/spec pass that builds on this one. Bulk import and live search are complementary, not exclusive: bulk import remains the zero-config, no-external-account offline bootstrap; live search (when built) is an opt-in enhancement whose results cache into the same `foods`/`food_variants` schema this spec introduces.
- A Settings-page affordance for triggering the bulk import (upload a file, click a button) instead of the current CLI-only flow (`npx tsx scripts/nutrition/importFoods.ts --usda <path>`) — a good idea raised during brainstorming, but orthogonal to the schema change. Worth its own future issue.
- Barcode scanning / photo-based logging — already tracked as issue #141.
- Arbitrary unit conversion (e.g. converting a user-typed "50g" against a food whose only variant is "1 cup") — variants sidestep most of the practical need for this (portions arrive pre-converted from USDA data), but general mass/volume conversion stays deferred, same as today.
- The wider nutrient set (sodium, sugar, fats breakdown, vitamins, minerals, `custom_nutrients`, `allergens`/`traces`) is being implemented separately via issue #140, sequenced *before* this spec (both are queued behind the current `bacta-headless` backlog). This spec's `food_variants` schema is designed to carry that full widened set from the start — see Section 1.

**Dependency:** this spec assumes issue #140 has already merged (i.e. `foods`/`food_log_entries` already carry the widened nutrient columns) by the time implementation starts. If #140 hasn't landed yet when this is picked up, the implementer should either wait for it or fold its column list into this same migration pass rather than building `food_variants` with only the original 5 macros and widening it again later.

---

## 1. Data Layer

### `foods` — slimmed to identity only

```sql
CREATE TABLE foods (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  source      TEXT NOT NULL,              -- 'usda' | 'openfoodfacts' | 'custom'
  source_id   TEXT,                       -- USDA fdcId or OFF barcode; NULL for custom foods
  name        TEXT NOT NULL,
  brand       TEXT,                       -- packaged/branded foods only
  source_json TEXT,                       -- raw import payload (unchanged from today)
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(source, source_id)
);
```

Drops `default_qty`, `default_unit`, and all five (soon nine-plus, per #140) macro columns — those move to `food_variants` below. A `foods` row with zero variants is a data-integrity bug, not a valid state (every food must have at least one `is_default` variant); this is enforced at the application layer (both import and the `POST /foods` route always create the food + its first variant in one transaction), not a DB constraint, since SQLite doesn't cleanly express "at least one child row" as a table-level check.

### `food_variants` — new

```sql
CREATE TABLE food_variants (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  food_id       INTEGER NOT NULL REFERENCES foods(id),
  label         TEXT NOT NULL,            -- e.g. "100 g", "1 tbsp", "1 cup" — display string
  serving_qty   REAL NOT NULL,            -- e.g. 100, 1, 1
  serving_unit  TEXT NOT NULL,            -- e.g. "g", "tbsp", "cup"
  gram_weight   REAL,                     -- e.g. 100, 14.3, 240 — for reference/future recompute; NULL if unknown (e.g. a custom food logged in a non-mass unit with no known gram equivalent)
  is_default    INTEGER NOT NULL DEFAULT 0, -- SQLite has no native boolean; 0/1
  source        TEXT NOT NULL,            -- 'usda' | 'openfoodfacts' | 'custom'
  calories      REAL,
  protein_g     REAL,
  carbs_g       REAL,
  fat_g         REAL,
  fiber_g       REAL,
  sodium_mg     REAL,
  sugar_g       REAL,
  saturated_fat_g      REAL,
  polyunsaturated_fat_g REAL,
  monounsaturated_fat_g REAL,
  trans_fat_g   REAL,
  cholesterol_mg REAL,
  potassium_mg  REAL,
  vitamin_a_mcg REAL,
  vitamin_c_mg  REAL,
  calcium_mg    REAL,
  iron_mg       REAL,
  glycemic_index TEXT,                    -- one of: None | Very Low | Low | Medium | High | Very High
  custom_nutrients TEXT,                  -- JSON-encoded key→value map (open escape hatch, mirrors SparkyFitness's JSONB column)
  allergens     TEXT,                     -- JSON-encoded string array
  traces        TEXT,                     -- JSON-encoded string array
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_food_variants_food_id ON food_variants(food_id);
```

Every nutrient column stays nullable — a variant only stores what its source actually reported, same null-discipline the current `foods`/`food_log_entries` already follow (never coerce a missing value to 0). `custom_nutrients`/`allergens`/`traces` round-trip through `JSON.parse`/`JSON.stringify` at the API boundary, same pattern `source_json` already uses.

USDA Foundation/SR Legacy data has no allergen, traces, or glycemic-index concept — those three fields stay NULL for every USDA-sourced variant and only populate for custom foods where the user tags them directly.

### `food_log_entries` / `recipe_ingredients` — `food_id` → `variant_id`

```sql
-- food_log_entries: drop food_id, add variant_id
-- (recipe_ingredients gets the identical treatment)
ALTER TABLE food_log_entries DROP COLUMN food_id;
ALTER TABLE food_log_entries ADD COLUMN variant_id INTEGER REFERENCES food_variants(id);
```

`variant_id` is nullable — NULL means a fully ad-hoc entry (unchanged from today's `food_id IS NULL` meaning). `quantity` changes meaning: today it's the raw amount in `unit` (e.g. `200` grams); going forward, for a variant-linked entry, it means **the count of that variant's serving** (e.g. `2` × the "1 slice" variant = 2 slices). `unit` and every macro column stay denormalized at log time exactly as today (a variant's own values times `quantity`), just computed from the variant row instead of `foods.calories * (quantity / foods.default_qty)`. Ad-hoc entries are unaffected — they never had a `food_id`/`variant_id` and keep working exactly as they do today.

### Migration strategy: wipe and re-import, not an in-place converter

As of this spec, `food_log_entries`, `recipe_ingredients`, and `recipes` are all empty (confirmed live, 2026-07-15) — the Nutrition frontend merged the same day the food database was populated, and nothing has been logged yet. `foods` (8,156 rows) is 100% machine-derived from the USDA JSON dump files still on disk at `data/nutrition-import/`.

Given that, writing a one-time script to convert existing `foods` rows into the new `food_variants` shape would be dead code that runs exactly once, immediately after which it's never needed again. Instead:

1. Ship the schema change (drop old columns from `foods`, create `food_variants`, alter `food_log_entries`/`recipe_ingredients`).
2. Update `mapUsdaFoodToRow` (and the loader) to emit `food_variants` rows instead of flattening macros onto `foods` — one row per real `foodPortions` entry, plus one `100 g` default variant, per food.
3. `TRUNCATE`/`DELETE FROM foods` (cascades nothing today since nothing references it yet) and re-run `npx tsx scripts/nutrition/importFoods.ts --usda <path>` against the same two files already on disk.

No migration script converting old rows; the import path itself becomes the only source of truth for how USDA data becomes `foods`+`food_variants` rows, tested the normal way (unit tests against fixtures, same as `foodImportMapping.test.ts`/`foodImportLoader.test.ts` already do).

---

## 2. Import Path Changes

`mapUsdaFoodToRow` (`server/lib/nutrition/foodImportMapping.ts`) currently returns one flat `FoodImportRow`. It needs to return a food row plus an array of variant rows:

```ts
interface FoodVariantImportRow {
  label: string
  serving_qty: number
  serving_unit: string
  gram_weight: number | null
  is_default: boolean
  // ...full nutrient set, scaled to this variant's serving
}

interface FoodImportResult {
  food: { source: 'usda'; source_id: string; name: string; brand: string | null; source_json: string }
  variants: FoodVariantImportRow[]
}
```

For each real `foodPortions` entry (`{ amount, gramWeight, measureUnit: { name } }`), compute a scaled-macro variant: `factor = gramWeight / 100` (USDA per-100g base), apply the same `scale()` rounding already used elsewhere. Always emit one additional `100 g` variant with `is_default: true` and the record's raw per-100g values — this is what today's single-variant behavior already stores, so it's guaranteed to exist even for the 338 Foundation/SR Legacy records with zero `foodPortions`.

`importUsdaDumpFile` (`foodImportLoader.ts`) changes its upsert from one `INSERT ... ON CONFLICT(source, source_id) DO UPDATE` into `foods` to: upsert the food row, then (for a fresh food) insert its variants, or (for a re-imported/updated food — the `ON CONFLICT DO UPDATE` case) delete-and-reinsert that food's variants, since a re-import should refresh a food's serving data the same way it refreshes macros today.

The null-entry bug fixed in PR #148 (32 literal `null` entries in the real Foundation Foods array) stays fixed and applies identically here — this spec doesn't touch that guard.

---

## 3. API Changes

- `GET /api/nutrition/foods?q=` — returns each matching food with its variants nested: `{ foods: [{ id, name, brand, variants: [{ id, label, serving_qty, serving_unit, is_default, calories, ... }] }] }`.
- `POST /api/nutrition/foods` — creates a food + its first variant (`is_default: true`) in one transaction; request body shape changes from today's flat `{name, default_qty, default_unit, calories, ...}` to `{name, brand?, variant: {label, serving_qty, serving_unit, calories, ...}}`.
- `POST /api/nutrition/foods/:id/variants` — new. Adds another serving size to an existing food (USDA-sourced or custom). Body: `{label, serving_qty, serving_unit, calories, ...}`. Never marks the new variant `is_default` (that stays with whichever variant was created first, unless a future issue adds a "make default" action — out of scope here).
- `POST /api/nutrition/log` / `PUT /api/nutrition/log/:id` — take `variant_id` + `quantity` (servings) for a linked entry, replacing today's `food_id` + `quantity` (grams). Server resolves the variant, computes `macro = variant.macro * quantity` (not `* quantity/default_qty` — the division by serving size is already baked into the variant row), same per-field override behavior PUT already has (explicit macro overrides in the request are respected; unspecified macros rescale).
- `POST /api/nutrition/recipes` — `ingredients[].food_id` becomes `ingredients[].variant_id`; the per-serving computation (`sum / servings`) is unaffected since it already operates on each ingredient's stored macro values, not on the food/variant relationship.
- No changes needed to `GET /summary`, `GET /trend`, or `GET/POST /targets` — all operate on `food_log_entries`' already-denormalized macro columns, unaffected by whether the row's link column is named `food_id` or `variant_id`.

---

## 4. Frontend Changes

**Log Entry sheet:** picking a food from search shows a variant dropdown (not the current locked-unit chip) populated from that food's variants, defaulting to the `is_default` one. The "locked unit chip + no picker" UI is replaced — quantity now means "how many of this serving," and the preview line recomputes as `quantity × selected variant's macros`.

**Edit Entry sheet:** same dropdown for a linked entry's variant. Per the earlier decision on quantity semantics, changing quantity still rescales (now: `newQuantity × variant.macro`, not a `factor` against `default_qty`); changing the *variant* itself (not just quantity) is allowed here for the first time — today's "delete and re-log to change the food" rule was really about changing food/unit together, and picking a different variant of the *same* food is a smaller, safe operation (all its macros are already known, no rescale ambiguity).

**Library:** "add another serving size" action on an existing food (USDA or custom) — a small form (label/qty/unit/macros) that calls the new `POST /foods/:id/variants` route. New-food creation stays exactly as today (one variant, `is_default`), per the earlier decision.

**Recipe ingredient rows:** `addFromFood` (in `NewRecipeForm`) picks a variant instead of always using the food's single implicit serving; quantity-edit-rescale (the bug fixed in the PR #138 review) continues to work the same way, now scaled from the chosen variant's macros instead of `food.default_qty`.

This spec does not require a new Claude Design session — it's an extension of already-built sheet/dropdown patterns, not a new section or visual system. The dropdown itself would be Bacta's first use of a native/custom select in the Nutrition section (everything else uses buttons/chips); the implementation plan should confirm whether an existing primitive covers this or a small new one is needed.

---

## 5. Error Handling

- `POST /log` / `PUT /log/:id` with a `variant_id` that doesn't reference an existing row: 400 (mirrors today's `food_id does not reference an existing food` 400).
- `POST /foods/:id/variants` for a nonexistent `food_id`: 404.
- Deleting a food (`DELETE /foods/:id`) must now cascade-check against `food_variants` in addition to `food_log_entries`/`recipe_ingredients` — a food with variants that are themselves referenced by logged entries is still blocked the same FK-violation-caught-as-400 way it is today; the existing `isForeignKeyError` helper and pattern in `server/api/nutrition.ts` is reused, not reinvented.
- A variant with zero rows referencing it (never logged) can be deleted directly via FK constraints alone — **except** deleting a food's last remaining variant must be blocked with a 400 (e.g. "A food must have at least one serving — delete the food itself instead"), since `foods` has no DB-level constraint enforcing "at least one child row" (per Section 1) and a zero-variant food is an invalid state, not just an inconvenient one. This check runs in the `DELETE /food_variants/:id` handler: count the food's remaining variants before allowing the delete.

---

## 6. Testing

- `foodImportMapping.test.ts` / `foodImportLoader.test.ts`: extend fixtures to cover multi-variant emission (a record with `foodPortions`, a record without), asserting the right number of variant rows and correct per-variant scaled macros.
- New route tests for `GET /foods?q=` (nested variants shape), `POST /foods` (food + first variant in one call), `POST /foods/:id/variants` (add a second variant), `POST/PUT /log` (variant_id + quantity-as-servings math).
- Client tests: `LogEntrySheet`/`EditEntrySheet` variant-dropdown selection and submit payload; `NutritionLibrary`'s add-variant flow; the recipe quantity-rescale test added during the PR #138 review needs updating to operate on variant selection instead of the food's implicit single serving.
- A live-data sanity check (via `bacta-sqlite` MCP, same practice used throughout this project) after the wipe-and-reimport step: variant counts per food should roughly match the `foodPortions`-count distribution already measured (94% of foods with 1-4 variants, long tail to 17).

---

## 7. What This Enables Later (context, not scope)

This spec exists specifically so the next spec (live multi-provider API integration) has a `food_variants` shape to land search results into — a live USDA/OFF/Nutritionix search result is naturally "one food, one or more servings," which fits this model directly and wouldn't fit today's single-locked-unit `foods` table without another rework. That second spec is a separate brainstorming pass, done after this one is implemented.
