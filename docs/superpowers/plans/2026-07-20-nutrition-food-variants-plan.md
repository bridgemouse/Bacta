# Nutrition Food Variants (Multi-Serving Model) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Bacta's current "one food = one locked unit" model with SparkyFitness-style `food_variants` (multiple servings per food, each independently searchable/loggable), so a food like bread can be logged as "1 slice" instead of forcing a 100g conversion.

**Architecture:** New `food_variants` table holds one row per servable unit (each with its own precomputed macros, an `is_default` flag, and the full widened nutrient set from #140). `foods` slims to identity-only (name/brand/source/source_json). `food_log_entries`/`recipe_ingredients` drop `food_id` in favor of `variant_id`; `quantity` changes meaning from "raw grams" to "count of that variant's serving." The 8,156 already-imported USDA foods are wiped and re-imported from the same source files on disk, using an updated import path that emits variants (seeded from USDA's own `foodPortions` data — already present in 7,818 of 8,156 records) instead of a one-time data-migration script, since nothing real references any of the current rows.

**Tech Stack:** Node/Express, TypeScript, SQLite via better-sqlite3, React 19, Vitest, Testing Library.

## Global Constraints

- Inline styles only — no CSS files, no Tailwind, no CSS modules (per `CLAUDE.md`).
- Dark UI always.
- All colors from `client/src/theme.ts` — never hardcode hex. Use `hexA()` from `client/src/lib/hexA.ts` for rgba.
- Numbers/labels/readouts use `FONT_MONO`; prose/names use `FONT_UI`.
- Prefer editing existing files over creating new ones.
- Do not add comments unless the WHY is genuinely non-obvious — match this codebase's existing dense-but-precise comment style (see any file already read during planning).
- `NUMERIC_NUTRIENT_KEYS`/`DESCRIPTIVE_NUTRIENT_KEYS`/`JSON_NUTRIENT_KEYS` (`server/lib/nutrition/nutrientKeys.ts`) are the **single source of truth** for the widened nutrient column list — every task that touches a nutrient-bearing table or route must reuse these constants, never hand-list the 17 columns again (this exact duplication caused issue #161).
- Server tests: `process.env.DB_PATH = ':memory:'` set at module scope, `migrate()` called in `beforeAll`, `db`/router imported via dynamic `await import(...)` inside test bodies (established pattern in `tests/server/nutrition.test.ts`, `tests/server/foodImportLoader.test.ts`).
- Client tests: `vi.mock('../../../../client/src/lib/nutritionApi', ...)` at module scope, `render`/`screen`/`userEvent` from Testing Library.
- Run `npm test && npx tsc --noEmit && npx tsc -p tsconfig.server.json --noEmit` after every task — all three must be clean before moving to the next task.
- Never use `git add -A` — stage only the files a task actually touched.

---

### Task 1: Schema — `food_variants` table, slim `foods`, `food_id` → `variant_id`

**Files:**
- Modify: `server/db/schema.sql`
- Modify: `server/db/migrate.ts`
- Modify: `tests/server/nutritionSchema.test.ts`

**Interfaces:**
- Consumes: nothing (first task).
- Produces: `food_variants` table (columns: `id, food_id, label, serving_qty, serving_unit, gram_weight, is_default, source`, all 17 columns from `NUMERIC_NUTRIENT_KEYS`/`DESCRIPTIVE_NUTRIENT_KEYS`, `created_at`). `foods` table with only `id, source, source_id, name, brand, source_json, created_at`. `food_log_entries.variant_id` and `recipe_ingredients.variant_id` (both `INTEGER REFERENCES food_variants(id)`, nullable), replacing `food_id`.

- [ ] **Step 1: Write the failing test**

Add to `tests/server/nutritionSchema.test.ts` (append inside the existing `describe('Nutrition schema migration', ...)` block, after the last `it(...)`):

```ts
  it('creates food_variants and slims foods to identity-only columns', async () => {
    const { default: db } = await import('../../server/db/client')
    expect(tableExists(db, 'food_variants')).toBe(true)

    const foodsCols = (db.prepare("SELECT name FROM pragma_table_info('foods')").all() as { name: string }[]).map(c => c.name)
    expect(foodsCols).toEqual(expect.arrayContaining(['id', 'source', 'source_id', 'name', 'brand', 'source_json', 'created_at']))
    expect(foodsCols).not.toContain('default_qty')
    expect(foodsCols).not.toContain('default_unit')
    expect(foodsCols).not.toContain('calories')

    const variantCols = (db.prepare("SELECT name FROM pragma_table_info('food_variants')").all() as { name: string }[]).map(c => c.name)
    for (const col of ['food_id', 'label', 'serving_qty', 'serving_unit', 'gram_weight', 'is_default', 'source', 'calories', 'protein_g', 'sodium_mg', 'glycemic_index', 'custom_nutrients']) {
      expect(variantCols).toContain(col)
    }
  })

  it('food_log_entries and recipe_ingredients have variant_id, not food_id', async () => {
    const { default: db } = await import('../../server/db/client')
    const logCols = (db.prepare("SELECT name FROM pragma_table_info('food_log_entries')").all() as { name: string }[]).map(c => c.name)
    expect(logCols).toContain('variant_id')
    expect(logCols).not.toContain('food_id')

    const ingredientCols = (db.prepare("SELECT name FROM pragma_table_info('recipe_ingredients')").all() as { name: string }[]).map(c => c.name)
    expect(ingredientCols).toContain('variant_id')
    expect(ingredientCols).not.toContain('food_id')
  })

  it('migrating an established DB (old foods shape with default_qty) to the variant schema is idempotent', async () => {
    // Simulate a pre-migration production DB: recreate the OLD foods shape directly,
    // then confirm migrate() both transforms it AND running it twice doesn't throw.
    const { default: db } = await import('../../server/db/client')
    db.exec('DROP TABLE IF EXISTS food_variants')
    db.exec('ALTER TABLE food_log_entries ADD COLUMN food_id_sim INTEGER') // won't collide, just proving ALTER works pre-migration in this sim
    db.exec('DROP TABLE foods')
    db.exec(`
      CREATE TABLE foods (
        id INTEGER PRIMARY KEY AUTOINCREMENT, source TEXT NOT NULL, source_id TEXT, name TEXT NOT NULL,
        brand TEXT, default_qty REAL NOT NULL DEFAULT 100, default_unit TEXT NOT NULL DEFAULT 'g',
        calories REAL, source_json TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `)
    db.exec('ALTER TABLE food_log_entries DROP COLUMN food_id_sim')

    const { migrate } = await import('../../server/db/migrate')
    expect(() => migrate()).not.toThrow()
    expect(() => migrate()).not.toThrow()

    const foodsCols = (db.prepare("SELECT name FROM pragma_table_info('foods')").all() as { name: string }[]).map(c => c.name)
    expect(foodsCols).not.toContain('default_qty')
    expect(tableExists(db, 'food_variants')).toBe(true)
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --config vitest.config.ts tests/server/nutritionSchema.test.ts`
Expected: FAIL — `food_variants` table doesn't exist yet; `foods` still has `default_qty`.

- [ ] **Step 3: Update `server/db/schema.sql`**

Replace the existing `foods` `CREATE TABLE` block (the one starting `-- Reference food/ingredient data...` through its closing `CREATE INDEX IF NOT EXISTS idx_foods_name ON foods(name);`) with:

```sql
-- Reference food/ingredient data (identity only). Bulk-imported from USDA FoodData Central
-- (SR Legacy + Foundation Foods), plus user-saved custom/ad-hoc foods (source='custom').
-- Servable-unit data (quantity/unit/macros) lives on food_variants, not here — a food can
-- have multiple variants ("100g", "1 slice", "1 cup"), each independently searchable and
-- loggable. See docs/superpowers/specs/2026-07-15-nutrition-food-variants-design.md.
CREATE TABLE IF NOT EXISTS foods (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  source       TEXT NOT NULL,              -- 'usda' | 'openfoodfacts' | 'custom'
  source_id    TEXT,                       -- USDA fdcId or OFF barcode/code; NULL for custom foods
  name         TEXT NOT NULL,
  brand        TEXT,                       -- packaged/branded foods only; NULL for generic/whole foods
  source_json  TEXT,                       -- raw import payload
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(source, source_id)
);
CREATE INDEX IF NOT EXISTS idx_foods_name ON foods(name);

-- One row per servable unit of a food (e.g. "100 g", "1 tbsp", "1 cup"), each with its own
-- precomputed macros. Every food must have at least one variant with is_default=1 — enforced
-- at the application layer (POST /foods and the import path always create a food + its first
-- variant together), not a DB constraint (SQLite can't express "at least one child row").
CREATE TABLE IF NOT EXISTS food_variants (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  food_id       INTEGER NOT NULL REFERENCES foods(id),
  label         TEXT NOT NULL,             -- display string, e.g. "1 tbsp"
  serving_qty   REAL NOT NULL,             -- e.g. 100, 1, 1
  serving_unit  TEXT NOT NULL,             -- e.g. "g", "tbsp", "cup"
  gram_weight   REAL,                      -- e.g. 100, 14.3, 240; NULL if unknown (e.g. a custom
                                            -- food logged in a non-mass unit with no gram equivalent)
  is_default    INTEGER NOT NULL DEFAULT 0,-- SQLite has no native boolean; 0/1
  source        TEXT NOT NULL,             -- 'usda' | 'openfoodfacts' | 'custom'
  calories     REAL,
  protein_g    REAL,
  carbs_g      REAL,
  fat_g        REAL,
  fiber_g      REAL,
  sodium_mg    REAL,
  sugar_g      REAL,
  saturated_fat_g       REAL,
  polyunsaturated_fat_g REAL,
  monounsaturated_fat_g REAL,
  trans_fat_g  REAL,
  cholesterol_mg REAL,
  potassium_mg REAL,
  vitamin_a_mcg REAL,
  vitamin_c_mg REAL,
  calcium_mg   REAL,
  iron_mg      REAL,
  glycemic_index   TEXT,
  custom_nutrients TEXT,
  allergens    TEXT,
  traces       TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_food_variants_food_id ON food_variants(food_id);
```

In the `food_log_entries` `CREATE TABLE` block, replace the line:
```sql
  food_id     INTEGER REFERENCES foods(id),-- NULL for a fully ad-hoc entry (FR3)
```
with:
```sql
  variant_id  INTEGER REFERENCES food_variants(id), -- NULL for a fully ad-hoc entry (FR3)
```

In the `recipe_ingredients` `CREATE TABLE` block, replace the line:
```sql
  food_id    INTEGER REFERENCES foods(id),   -- NULL for an ad-hoc ingredient
```
with:
```sql
  variant_id INTEGER REFERENCES food_variants(id), -- NULL for an ad-hoc ingredient
```

Leave `recipes.food_id INTEGER NOT NULL REFERENCES foods(id)` untouched — a recipe's own materialized food is unrelated to the variant model (it's the *target* of a `foods` row creation, not a reference into one).

- [ ] **Step 4: Add the migration block to `server/db/migrate.ts`**

Add this block inside `migrate()`, after the existing `NEW_NUTRIENT_COLUMNS` loop and before `initSettings()`:

```ts
  // Food variants (multi-serving model) — see
  // docs/superpowers/specs/2026-07-15-nutrition-food-variants-design.md. foods loses
  // default_qty/default_unit + all nutrient columns (moved to food_variants);
  // food_log_entries/recipe_ingredients lose food_id, gain variant_id. As of 2026-07-20,
  // nothing real referenced any of this data (0 log entries, 0 recipes; foods' rows are
  // 100% reproducible from source files on disk) — this wipes and re-derives rather than
  // converting rows in place. Gated on foods still having default_qty so this whole block
  // is a no-op (and thus idempotent) once the swap has happened once.
  const foodsHasDefaultQty = db.prepare(
    "SELECT 1 FROM pragma_table_info('foods') WHERE name = 'default_qty'"
  ).get()
  if (foodsHasDefaultQty) {
    db.exec('DROP TABLE IF EXISTS food_variants')
    db.exec(`
      CREATE TABLE food_variants (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        food_id       INTEGER NOT NULL REFERENCES foods(id),
        label         TEXT NOT NULL,
        serving_qty   REAL NOT NULL,
        serving_unit  TEXT NOT NULL,
        gram_weight   REAL,
        is_default    INTEGER NOT NULL DEFAULT 0,
        source        TEXT NOT NULL,
        ${NUMERIC_NUTRIENT_KEYS.map(k => `${k} REAL`).join(',\n        ')},
        ${DESCRIPTIVE_NUTRIENT_KEYS.map(k => `${k} TEXT`).join(',\n        ')},
        created_at    TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `)
    db.exec('CREATE INDEX IF NOT EXISTS idx_food_variants_food_id ON food_variants(food_id)')

    db.exec('DELETE FROM food_log_entries')
    db.exec('DELETE FROM recipe_ingredients')
    db.exec('DELETE FROM recipes')
    db.exec('DELETE FROM foods')

    db.exec('ALTER TABLE food_log_entries DROP COLUMN food_id')
    db.exec('ALTER TABLE food_log_entries ADD COLUMN variant_id INTEGER REFERENCES food_variants(id)')
    db.exec('ALTER TABLE recipe_ingredients DROP COLUMN food_id')
    db.exec('ALTER TABLE recipe_ingredients ADD COLUMN variant_id INTEGER REFERENCES food_variants(id)')

    // Rebuild foods without default_qty/default_unit/macro columns — SQLite can DROP
    // COLUMN one at a time but rebuilding via a new table is simpler for this many columns
    // at once, matching this file's existing rename-via-rebuild precedent above.
    db.exec(`
      CREATE TABLE foods_new (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        source       TEXT NOT NULL,
        source_id    TEXT,
        name         TEXT NOT NULL,
        brand        TEXT,
        source_json  TEXT,
        created_at   TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(source, source_id)
      )
    `)
    db.exec('DROP TABLE foods')
    db.exec('ALTER TABLE foods_new RENAME TO foods')
    db.exec('CREATE INDEX IF NOT EXISTS idx_foods_name ON foods(name)')

    console.log('[db] migrated to food_variants schema — foods/food_log_entries/recipe_ingredients/recipes wiped (0 real rows existed); re-run scripts/nutrition/importFoods.ts to repopulate foods')
  }

```

Add the import at the top of `server/db/migrate.ts` (alongside the existing imports):

```ts
import { NUMERIC_NUTRIENT_KEYS, DESCRIPTIVE_NUTRIENT_KEYS } from '../lib/nutrition/nutrientKeys'
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run --config vitest.config.ts tests/server/nutritionSchema.test.ts`
Expected: PASS (all tests including the pre-existing ones).

- [ ] **Step 6: Run the full suite and typecheck**

Run: `npm test && npx tsc --noEmit && npx tsc -p tsconfig.server.json --noEmit`
Expected: Some failures are expected here — `server/api/nutrition.ts`, `server/lib/nutrition/foodImportMapping.ts`/`foodImportLoader.ts`, and their tests all still reference the old `foods.default_qty`/`food_id` shape. That's fine; Tasks 2–7 fix them. Confirm the *new* schema tests pass and note (don't fix yet) which other test files/tsc errors reference the old shape, so Task 2 onward has a known starting point.

- [ ] **Step 7: Commit**

```bash
git add server/db/schema.sql server/db/migrate.ts tests/server/nutritionSchema.test.ts
git commit -m "feat: add food_variants table, slim foods, food_id->variant_id on log entries/recipe ingredients"
```

---

### Task 2: Import mapping — `mapUsdaFoodToRow`/`mapOffProductToRow` emit food + variants

**Files:**
- Modify: `server/lib/nutrition/nutrientKeys.ts`
- Modify: `server/lib/nutrition/foodImportMapping.ts`
- Modify: `tests/server/foodImportMapping.test.ts`
- Modify (add fixture): `tests/server/fixtures/nutrition/usda-foundation-oat-flour.json` (read-only reference — do not edit; a new fixture is added instead, see Step 1)
- Create: `tests/server/fixtures/nutrition/usda-with-portions.json`

**Interfaces:**
- Consumes: `NUMERIC_NUTRIENT_KEYS`, `DESCRIPTIVE_NUTRIENT_KEYS`, `NumericRow` (from Task 1's unchanged `nutrientKeys.ts`, plus this task's new `scaleNumericRow`).
- Produces:
  ```ts
  export interface FoodVariantImportRow extends NumericRow {
    label: string
    serving_qty: number
    serving_unit: string
    gram_weight: number | null
    is_default: boolean
    source: 'usda' | 'openfoodfacts'
    glycemic_index: string | null
    custom_nutrients: string | null
    allergens: string | null
    traces: string | null
  }
  export interface FoodImportResult {
    food: { source: 'usda' | 'openfoodfacts'; source_id: string; name: string; brand: string | null; source_json: string }
    variants: FoodVariantImportRow[]
  }
  export function mapUsdaFoodToRow(record: UsdaFoodRecord | null | undefined): FoodImportResult | null
  export function mapOffProductToRow(record: OffProductRecord): FoodImportResult | null
  ```
  Task 3 (loader) consumes `FoodImportResult` directly.

- [ ] **Step 1: Add a new fixture with real `foodPortions` data**

Create `tests/server/fixtures/nutrition/usda-with-portions.json` (a trimmed real Foundation Foods record — "Flour, oat, whole grain," fdcId 2261421, same food as the existing `usda-foundation-oat-flour.json` fixture, but with `foodPortions` added):

```json
{
  "fdcId": 2261421,
  "description": "Flour, oat, whole grain",
  "dataType": "Foundation",
  "foodNutrients": [
    { "type": "FoodNutrient", "nutrient": { "id": 1257, "number": "957", "name": "Energy (Atwater General Factors)", "unitName": "kcal" }, "amount": 389.125 },
    { "type": "FoodNutrient", "nutrient": { "id": 1003, "number": "203", "name": "Protein", "unitName": "g" }, "amount": 13.16875 },
    { "type": "FoodNutrient", "nutrient": { "id": 1005, "number": "205", "name": "Carbohydrate, by difference", "unitName": "g" }, "amount": 69.91725 },
    { "type": "FoodNutrient", "nutrient": { "id": 1004, "number": "204", "name": "Total lipid (fat)", "unitName": "g" }, "amount": 6.309 },
    { "type": "FoodNutrient", "nutrient": { "id": 1079, "number": "291", "name": "Fiber, total dietary", "unitName": "g" }, "amount": 10.5 }
  ],
  "foodPortions": [
    { "id": 118804, "amount": 2.0, "gramWeight": 33.9, "measureUnit": { "id": 1001, "name": "tablespoon", "abbreviation": "tbsp" } },
    { "id": 312701, "amount": 1.0, "gramWeight": 94.0, "measureUnit": { "id": 1002, "name": "cup", "abbreviation": "cup" } }
  ]
}
```

- [ ] **Step 2: Write the failing tests**

Replace the entire contents of `tests/server/foodImportMapping.test.ts` with (this rewrites every test to match the new `{food, variants}` return shape — the file's existing tests all assert on the old flat-row shape, which no longer exists):

```ts
import { describe, it, expect, vi, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'

const FIXTURES = path.join(__dirname, 'fixtures/nutrition')
function loadFixture(name: string): unknown {
  return JSON.parse(fs.readFileSync(path.join(FIXTURES, name), 'utf-8'))
}

describe('mapUsdaFoodToRow', () => {
  it('maps a Foundation Foods record into a food + a single default 100g variant when no foodPortions exist', async () => {
    const { mapUsdaFoodToRow } = await import('../../server/lib/nutrition/foodImportMapping')
    const record = loadFixture('usda-foundation-oat-flour.json')
    const result = mapUsdaFoodToRow(record as any)

    expect(result!.food).toMatchObject({ source: 'usda', source_id: '2261421', name: 'Flour, oat, whole grain', brand: null })
    expect(result!.variants).toHaveLength(1)
    expect(result!.variants[0]).toMatchObject({
      label: '100 g', serving_qty: 100, serving_unit: 'g', gram_weight: 100, is_default: true, source: 'usda',
      protein_g: 13.16875, carbs_g: 69.91725, fat_g: 6.309, calories: 389.125, fiber_g: 10.5,
    })
  })

  it('emits one variant per real foodPortions entry, scaled from the per-100g values, plus the 100g default', async () => {
    const { mapUsdaFoodToRow } = await import('../../server/lib/nutrition/foodImportMapping')
    const record = loadFixture('usda-with-portions.json')
    const result = mapUsdaFoodToRow(record as any)

    expect(result!.variants).toHaveLength(3) // 100g default + 2 real portions
    const tbsp = result!.variants.find(v => v.label === '2 tbsp')
    expect(tbsp).toMatchObject({ serving_qty: 2, serving_unit: 'tbsp', gram_weight: 33.9, is_default: false })
    // 33.9g is 0.339 of 100g -> calories 389.125 * 0.339 = 131.91 (rounded to 2dp)
    expect(tbsp!.calories).toBeCloseTo(131.91, 1)
    expect(tbsp!.protein_g).toBeCloseTo(4.46, 1)

    const cup = result!.variants.find(v => v.label === '1 cup')
    expect(cup).toMatchObject({ serving_qty: 1, serving_unit: 'cup', gram_weight: 94 })
    expect(cup!.calories).toBeCloseTo(365.78, 1)

    const defaultVariant = result!.variants.find(v => v.is_default)
    expect(defaultVariant).toMatchObject({ label: '100 g', calories: 389.125 })
  })

  it('returns null (does not throw) for a malformed record with no foodNutrients array', async () => {
    const { mapUsdaFoodToRow } = await import('../../server/lib/nutrition/foodImportMapping')
    expect(mapUsdaFoodToRow({ fdcId: 999, description: 'Malformed' } as any)).toBeNull()
    expect(mapUsdaFoodToRow({ fdcId: 999, description: 'Malformed', foodNutrients: 'not-an-array' } as any)).toBeNull()
  })

  it('returns null (does not throw) for a null/undefined record', async () => {
    const { mapUsdaFoodToRow } = await import('../../server/lib/nutrition/foodImportMapping')
    expect(mapUsdaFoodToRow(null as any)).toBeNull()
    expect(mapUsdaFoodToRow(undefined as any)).toBeNull()
  })

  it('skips a foodPortions entry with a zero/negative amount or gramWeight, or no usable unit name', async () => {
    const { mapUsdaFoodToRow } = await import('../../server/lib/nutrition/foodImportMapping')
    const record = {
      fdcId: 555, description: 'Weird Portions',
      foodNutrients: [{ type: 'FoodNutrient', nutrient: { id: 1008, number: '208', name: 'Energy', unitName: 'kcal' }, amount: 100 }],
      foodPortions: [
        { id: 1, amount: 0, gramWeight: 10, measureUnit: { name: 'x', abbreviation: 'x' } },
        { id: 2, amount: 1, gramWeight: 0, measureUnit: { name: 'y', abbreviation: 'y' } },
        { id: 3, amount: 1, gramWeight: 10, measureUnit: {} },
      ],
    }
    const result = mapUsdaFoodToRow(record as any)
    expect(result!.variants).toHaveLength(1) // only the 100g default — all 3 portions skipped
  })

  describe('unmapped nutrient codes', () => {
    afterEach(() => { vi.restoreAllMocks() })

    it('warns when none of the known nutrient codes matched any macro', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const { mapUsdaFoodToRow } = await import('../../server/lib/nutrition/foodImportMapping')
      const result = mapUsdaFoodToRow({
        fdcId: 777, description: 'Unrecognized Data Type Food',
        foodNutrients: [{ type: 'FoodNutrient', nutrient: { id: 9999, number: '9999', name: 'Some Unmapped Nutrient', unitName: 'g' }, amount: 1 }],
      } as any)
      expect(result!.variants[0]).toMatchObject({ calories: null, protein_g: null, carbs_g: null, fat_g: null })
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('777'))
    })
  })

  it('maps an SR Legacy record using the classic nutrient codes', async () => {
    const { mapUsdaFoodToRow } = await import('../../server/lib/nutrition/foodImportMapping')
    const record = loadFixture('usda-sr-legacy-croissant.json')
    const result = mapUsdaFoodToRow(record as any)
    expect(result!.food).toMatchObject({ source: 'usda', source_id: '174988', name: 'Croissants, apple' })
    expect(result!.variants[0]).toMatchObject({ calories: 254, protein_g: 7.4, carbs_g: 37.1, fat_g: 8.7, fiber_g: 2.5 })
  })
})

describe('mapOffProductToRow', () => {
  it('maps a flat product record into a food + single default 100g variant', async () => {
    const { mapOffProductToRow } = await import('../../server/lib/nutrition/foodImportMapping')
    const record = loadFixture('off-cheerios.json')
    const result = mapOffProductToRow(record as any)
    expect(result!.food).toMatchObject({ source: 'openfoodfacts', source_id: '0016000275287', name: 'Cheerios', brand: 'Cheerios' })
    expect(result!.variants).toHaveLength(1)
    expect(result!.variants[0]).toMatchObject({
      label: '100 g', serving_qty: 100, serving_unit: 'g', is_default: true, source: 'openfoodfacts',
      calories: 358.97, protein_g: 12.82, carbs_g: 74.36, fat_g: 6.41, fiber_g: 10.2564102564103,
    })
  })

  it('maps a product with no fiber_100g key at all to fiber_g: null', async () => {
    const { mapOffProductToRow } = await import('../../server/lib/nutrition/foodImportMapping')
    const record = loadFixture('off-nutella.json')
    const result = mapOffProductToRow(record as any)
    expect(result!.variants[0].calories).toBe(539)
    expect(result!.variants[0].fiber_g).toBeNull()
  })

  it('maps allergens/traces onto the single variant, stripped of language-tag prefixes', async () => {
    const { mapOffProductToRow } = await import('../../server/lib/nutrition/foodImportMapping')
    const record = loadFixture('off-cheerios.json')
    const result = mapOffProductToRow(record as any)
    if (result!.variants[0].allergens) {
      expect(JSON.parse(result!.variants[0].allergens as string)).not.toEqual(expect.arrayContaining([expect.stringMatching(/^[a-z]{2}:/)]))
    }
  })

  it('returns null for a record with no usable product name', async () => {
    const { mapOffProductToRow } = await import('../../server/lib/nutrition/foodImportMapping')
    expect(mapOffProductToRow({ code: '123', nutriments: {} } as any)).toBeNull()
  })
})
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run --config vitest.config.ts tests/server/foodImportMapping.test.ts`
Expected: FAIL — `mapUsdaFoodToRow`/`mapOffProductToRow` still return the old flat shape (`result.food` and `result.variants` are undefined).

- [ ] **Step 4: Add `scaleNumericRow` to `server/lib/nutrition/nutrientKeys.ts`**

Append to the file:

```ts

// Scales every numeric nutrient in a row by a factor (e.g. converting a per-100g value to
// a specific gram_weight), rounding to 2 decimal places. Shared so the import path's
// variant-from-portion computation and any future scaling code use identical rounding —
// this project has already paid once (#161) for hand-duplicated nutrient-column logic.
export function scaleNumericRow(row: NumericRow, factor: number): NumericRow {
  return Object.fromEntries(NUMERIC_NUTRIENT_KEYS.map(k => {
    const v = row[k] ?? null
    return [k, v == null ? null : Math.round(v * factor * 100) / 100]
  })) as NumericRow
}
```

- [ ] **Step 5: Rewrite `server/lib/nutrition/foodImportMapping.ts`**

Replace the file's `UsdaFoodRecord` interface, `FoodImportRow` interface, and everything from `mapUsdaFoodToRow` through the end of the file. Keep the file's top comment block, `UsdaFoodNutrient`/`OffProductRecord` interfaces, `USDA_NUTRIENT_CODES`, `USDA_WIDENED_NUTRIENT_CODES`, `findUsdaAmount`, `numberOrNull`, and `tagListOrNull` exactly as they are.

Change the import line at the top:
```ts
import { NUMERIC_NUTRIENT_KEYS, scaleNumericRow, type NumericRow } from './nutrientKeys'
```

Replace `export interface UsdaFoodRecord { ... }` with:
```ts
interface UsdaFoodPortion {
  amount: number
  gramWeight: number
  measureUnit?: { name?: string; abbreviation?: string }
}

export interface UsdaFoodRecord {
  fdcId: number
  description: string
  brandOwner?: string
  brandName?: string
  foodNutrients: UsdaFoodNutrient[]
  // Household-serving portions (e.g. "2 tbsp = 33.9g") — present on 7,818 of 8,156 records
  // in the 2026-04-30 Foundation Foods + SR Legacy exports. Seeds food_variants beyond the
  // always-present 100g default. Verified live 2026-07-15 against a real downloaded record.
  foodPortions?: UsdaFoodPortion[]
}
```

Replace `export interface FoodImportRow { ... }` (the whole interface) with:
```ts
export interface FoodVariantImportRow extends NumericRow {
  label: string
  serving_qty: number
  serving_unit: string
  gram_weight: number | null
  is_default: boolean
  source: 'usda' | 'openfoodfacts'
  glycemic_index: string | null
  custom_nutrients: string | null
  allergens: string | null
  traces: string | null
}

export interface FoodImportResult {
  food: { source: 'usda' | 'openfoodfacts'; source_id: string; name: string; brand: string | null; source_json: string }
  variants: FoodVariantImportRow[]
}
```

Replace the whole `mapUsdaFoodToRow` function with:

```ts
function buildVariant(
  label: string, serving_qty: number, serving_unit: string, gram_weight: number | null, is_default: boolean,
  source: 'usda' | 'openfoodfacts', numeric: NumericRow,
  descriptive: { glycemic_index: string | null; custom_nutrients: string | null; allergens: string | null; traces: string | null },
): FoodVariantImportRow {
  return { label, serving_qty, serving_unit, gram_weight, is_default, source, ...numeric, ...descriptive }
}

function portionToVariant(portion: UsdaFoodPortion, per100g: NumericRow): FoodVariantImportRow | null {
  const { amount, gramWeight, measureUnit } = portion
  if (!(amount > 0) || !(gramWeight > 0)) return null
  const unit = measureUnit?.abbreviation?.trim() || measureUnit?.name?.trim()
  if (!unit) return null
  const factor = gramWeight / 100
  return buildVariant(
    `${amount} ${unit}`, amount, unit, gramWeight, false, 'usda',
    scaleNumericRow(per100g, factor),
    { glycemic_index: null, custom_nutrients: null, allergens: null, traces: null },
  )
}

export function mapUsdaFoodToRow(record: UsdaFoodRecord | null | undefined): FoodImportResult | null {
  // A real USDA Foundation Foods bulk export can contain literal `null` entries in its
  // records array (32 of 395 in the 2026-04-30 export) — not just objects missing
  // foodNutrients. Must be checked before touching any property of record.
  if (!record) return null
  const nutrients = record.foodNutrients
  // A malformed/unexpected record must not throw here — importUsdaDumpFile wraps the whole
  // batch in one db.transaction(), so an uncaught exception on record N would roll back
  // every record already written in that call. Skip it instead.
  if (!Array.isArray(nutrients)) return null

  const per100g: NumericRow = {
    calories: findUsdaAmount(nutrients, USDA_NUTRIENT_CODES.calories),
    protein_g: findUsdaAmount(nutrients, USDA_NUTRIENT_CODES.protein_g),
    carbs_g: findUsdaAmount(nutrients, USDA_NUTRIENT_CODES.carbs_g),
    fat_g: findUsdaAmount(nutrients, USDA_NUTRIENT_CODES.fat_g),
    fiber_g: findUsdaAmount(nutrients, USDA_NUTRIENT_CODES.fiber_g),
    sodium_mg: findUsdaAmount(nutrients, USDA_WIDENED_NUTRIENT_CODES.sodium_mg),
    sugar_g: findUsdaAmount(nutrients, USDA_WIDENED_NUTRIENT_CODES.sugar_g),
    saturated_fat_g: findUsdaAmount(nutrients, USDA_WIDENED_NUTRIENT_CODES.saturated_fat_g),
    polyunsaturated_fat_g: findUsdaAmount(nutrients, USDA_WIDENED_NUTRIENT_CODES.polyunsaturated_fat_g),
    monounsaturated_fat_g: findUsdaAmount(nutrients, USDA_WIDENED_NUTRIENT_CODES.monounsaturated_fat_g),
    trans_fat_g: findUsdaAmount(nutrients, USDA_WIDENED_NUTRIENT_CODES.trans_fat_g),
    cholesterol_mg: findUsdaAmount(nutrients, USDA_WIDENED_NUTRIENT_CODES.cholesterol_mg),
    potassium_mg: findUsdaAmount(nutrients, USDA_WIDENED_NUTRIENT_CODES.potassium_mg),
    vitamin_a_mcg: findUsdaAmount(nutrients, USDA_WIDENED_NUTRIENT_CODES.vitamin_a_mcg),
    vitamin_c_mg: findUsdaAmount(nutrients, USDA_WIDENED_NUTRIENT_CODES.vitamin_c_mg),
    calcium_mg: findUsdaAmount(nutrients, USDA_WIDENED_NUTRIENT_CODES.calcium_mg),
    iron_mg: findUsdaAmount(nutrients, USDA_WIDENED_NUTRIENT_CODES.iron_mg),
  }

  // A record where every macro comes back null is a sign none of the known codes matched
  // at all — plausibly a dataType (Branded Foods, Survey/FNDDS) this mapper was never
  // checked against — surface it instead of silently importing an all-null variant.
  if (per100g.calories === null && per100g.protein_g === null && per100g.carbs_g === null && per100g.fat_g === null) {
    console.warn(`[nutrition-import] USDA fdcId ${record.fdcId} ("${record.description}") matched none of the known nutrient codes — check its dataType is Foundation Foods or SR Legacy`)
  }

  const descriptive = { glycemic_index: null, custom_nutrients: null, allergens: null, traces: null }
  const variants: FoodVariantImportRow[] = [
    buildVariant('100 g', 100, 'g', 100, true, 'usda', per100g, descriptive),
  ]
  for (const portion of record.foodPortions ?? []) {
    const variant = portionToVariant(portion, per100g)
    if (variant) variants.push(variant)
  }

  return {
    food: {
      source: 'usda',
      source_id: String(record.fdcId),
      name: record.description,
      brand: record.brandOwner ?? record.brandName ?? null,
      source_json: JSON.stringify(record),
    },
    variants,
  }
}
```

Replace `export function mapOffProductToRow(...)` with:

```ts
export function mapOffProductToRow(record: OffProductRecord): FoodImportResult | null {
  const doc = record.product ?? record
  const name = doc.product_name
  if (!name) return null

  const nutriments = doc.nutriments ?? {}
  const per100g: NumericRow = {
    calories: numberOrNull(nutriments['energy-kcal_100g']),
    protein_g: numberOrNull(nutriments['proteins_100g']),
    carbs_g: numberOrNull(nutriments['carbohydrates_100g']),
    fat_g: numberOrNull(nutriments['fat_100g']),
    fiber_g: numberOrNull(nutriments['fiber_100g']),
    sodium_mg: null, sugar_g: null, saturated_fat_g: null, polyunsaturated_fat_g: null,
    monounsaturated_fat_g: null, trans_fat_g: null, cholesterol_mg: null, potassium_mg: null,
    vitamin_a_mcg: null, vitamin_c_mg: null, calcium_mg: null, iron_mg: null,
  }

  const variant = buildVariant('100 g', 100, 'g', 100, true, 'openfoodfacts', per100g, {
    glycemic_index: null,
    custom_nutrients: null,
    allergens: tagListOrNull(doc.allergens_tags),
    traces: tagListOrNull(doc.traces_tags),
  })

  return {
    food: { source: 'openfoodfacts', source_id: record.code, name, brand: doc.brands ?? null, source_json: JSON.stringify(record) },
    variants: [variant],
  }
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run --config vitest.config.ts tests/server/foodImportMapping.test.ts`
Expected: PASS (all tests).

- [ ] **Step 7: Typecheck**

Run: `npx tsc -p tsconfig.server.json --noEmit`
Expected: Errors remain in `foodImportLoader.ts` (Task 3 fixes it) — confirm no NEW errors in `foodImportMapping.ts`/`nutrientKeys.ts` themselves.

- [ ] **Step 8: Commit**

```bash
git add server/lib/nutrition/nutrientKeys.ts server/lib/nutrition/foodImportMapping.ts tests/server/foodImportMapping.test.ts tests/server/fixtures/nutrition/usda-with-portions.json
git commit -m "feat: mapUsdaFoodToRow/mapOffProductToRow emit a food + variants, seeded from USDA foodPortions"
```

---

### Task 3: Import loader — write food + variants, refresh variants on re-import

**Files:**
- Modify: `server/lib/nutrition/foodImportLoader.ts`
- Modify: `tests/server/foodImportLoader.test.ts`
- Modify (add fixtures): `tests/server/fixtures/nutrition/usda-dump-with-portions.json` (new)

**Interfaces:**
- Consumes: `FoodImportResult`, `mapUsdaFoodToRow`, `mapOffProductToRow` (Task 2).
- Produces: `importUsdaDumpFile(filePath: string): number` and `importOffDumpFile(filePath: string): number` — **signatures unchanged** (still return the count of foods written), so `scripts/nutrition/importFoods.ts` needs no changes.

- [ ] **Step 1: Add a fixture with foodPortions for the loader-level test**

Create `tests/server/fixtures/nutrition/usda-dump-with-portions.json`:

```json
{
  "FoundationFoods": [
    {
      "fdcId": 9999001,
      "description": "Test Food With Portions",
      "dataType": "Foundation",
      "foodNutrients": [
        { "type": "FoodNutrient", "nutrient": { "id": 1008, "number": "208", "name": "Energy", "unitName": "kcal" }, "amount": 100.0 },
        { "type": "FoodNutrient", "nutrient": { "id": 1003, "number": "203", "name": "Protein", "unitName": "g" }, "amount": 5.0 }
      ],
      "foodPortions": [
        { "id": 1, "amount": 1.0, "gramWeight": 50.0, "measureUnit": { "name": "slice", "abbreviation": "slice" } }
      ]
    }
  ]
}
```

- [ ] **Step 2: Write the failing tests**

Replace the `describe('importUsdaDumpFile', ...)` block in `tests/server/foodImportLoader.test.ts` with:

```ts
  describe('importUsdaDumpFile', () => {
    it('populates foods and their variants from a wrapped USDA dump file', async () => {
      const { importUsdaDumpFile } = await import('../../server/lib/nutrition/foodImportLoader')
      const count = importUsdaDumpFile(path.join(FIXTURES, 'usda-dump-sample.json'))
      expect(count).toBe(2)

      const { default: db } = await import('../../server/db/client')
      const foods = db.prepare("SELECT * FROM foods WHERE source = 'usda' ORDER BY source_id").all() as any[]
      expect(foods.length).toBe(2)
      const oatFlour = foods.find(f => f.source_id === '2261421')
      expect(oatFlour).toMatchObject({ name: 'Flour, oat, whole grain' })
      expect(oatFlour.default_qty).toBeUndefined() // foods is identity-only now

      const variants = db.prepare('SELECT * FROM food_variants WHERE food_id = ?').all(oatFlour.id) as any[]
      expect(variants.length).toBe(1) // usda-dump-sample.json's records have no foodPortions
      expect(variants[0]).toMatchObject({ label: '100 g', is_default: 1, calories: 389.125 })
    })

    it('emits multiple variants for a record with foodPortions', async () => {
      const { importUsdaDumpFile } = await import('../../server/lib/nutrition/foodImportLoader')
      importUsdaDumpFile(path.join(FIXTURES, 'usda-dump-with-portions.json'))

      const { default: db } = await import('../../server/db/client')
      const food = db.prepare("SELECT * FROM foods WHERE source_id = '9999001'").get() as any
      const variants = db.prepare('SELECT * FROM food_variants WHERE food_id = ? ORDER BY is_default DESC').all(food.id) as any[]
      expect(variants.length).toBe(2) // 100g default + "1 slice"
      expect(variants[0]).toMatchObject({ label: '100 g', is_default: 1 })
      expect(variants[1]).toMatchObject({ label: '1 slice', serving_qty: 1, serving_unit: 'slice', gram_weight: 50, is_default: 0, calories: 50 })
    })

    it('skips a malformed record (no foodNutrients) instead of aborting the whole batch', async () => {
      const { importUsdaDumpFile } = await import('../../server/lib/nutrition/foodImportLoader')
      const count = importUsdaDumpFile(path.join(FIXTURES, 'usda-dump-with-malformed.json'))
      expect(count).toBe(1)

      const { default: db } = await import('../../server/db/client')
      const row = db.prepare("SELECT * FROM foods WHERE source_id = '5555555'").get()
      expect(row).toMatchObject({ name: 'Valid Record' })
      const malformedRow = db.prepare("SELECT * FROM foods WHERE source_id = '6666666'").get()
      expect(malformedRow).toBeUndefined()
    })

    it('running the import twice does not duplicate foods or variants (idempotent upsert, variants refreshed)', async () => {
      const { importUsdaDumpFile } = await import('../../server/lib/nutrition/foodImportLoader')
      importUsdaDumpFile(path.join(FIXTURES, 'usda-dump-sample.json'))
      importUsdaDumpFile(path.join(FIXTURES, 'usda-dump-sample.json'))

      const { default: db } = await import('../../server/db/client')
      const foods = db.prepare("SELECT * FROM foods WHERE source = 'usda' AND source_id IN ('2261421', '174988')").all() as any[]
      expect(foods.length).toBe(2)
      const oatFlour = foods.find(f => f.source_id === '2261421')
      const variants = db.prepare('SELECT * FROM food_variants WHERE food_id = ?').all(oatFlour.id) as any[]
      expect(variants.length).toBe(1) // not duplicated to 2
    })
  })
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run --config vitest.config.ts tests/server/foodImportLoader.test.ts`
Expected: FAIL — `food_variants` table has no rows (loader still writes flat rows into the old `foods` shape, which no longer has macro columns after Task 1).

- [ ] **Step 4: Rewrite `server/lib/nutrition/foodImportLoader.ts`**

Replace the whole file:

```ts
import fs from 'fs'
import db from '../../db/client'
import { mapUsdaFoodToRow, mapOffProductToRow, type FoodImportResult, type UsdaFoodRecord, type OffProductRecord } from './foodImportMapping'
import { NUMERIC_NUTRIENT_KEYS, DESCRIPTIVE_NUTRIENT_KEYS } from './nutrientKeys'

// USDA's full bulk-download JSON top-level wrapper key was NOT verified against a real
// downloaded file (only the per-record shape was — see foodImportMapping.ts). USDA's
// combined "all data types" downloads are known to carry multiple array-valued keys side
// by side (e.g. FoundationFoods + SRLegacyFoods + BrandedFoods + SurveyFoods) —
// concatenating every array found, rather than returning just the first one, means the
// loader can't silently drop an entire category of food records just because it appears
// second in the file.
export function extractRecordsArray(parsed: unknown): unknown[] {
  if (Array.isArray(parsed)) return parsed
  if (parsed && typeof parsed === 'object') {
    const arrays = Object.values(parsed).filter((v): v is unknown[] => Array.isArray(v))
    if (arrays.length > 0) return arrays.flat()
  }
  throw new Error('Could not find a records array in the parsed JSON — unrecognized dump file shape')
}

const upsertFood = db.prepare(`
  INSERT INTO foods (source, source_id, name, brand, source_json)
  VALUES (@source, @source_id, @name, @brand, @source_json)
  ON CONFLICT(source, source_id) DO UPDATE SET
    name        = excluded.name,
    brand       = excluded.brand,
    source_json = excluded.source_json
  RETURNING id
`)

const variantCols = [...NUMERIC_NUTRIENT_KEYS, ...DESCRIPTIVE_NUTRIENT_KEYS] as const
const insertVariant = db.prepare(`
  INSERT INTO food_variants (
    food_id, label, serving_qty, serving_unit, gram_weight, is_default, source,
    ${variantCols.join(', ')}
  )
  VALUES (
    @food_id, @label, @serving_qty, @serving_unit, @gram_weight, @is_default, @source,
    ${variantCols.map(k => '@' + k).join(', ')}
  )
`)
const deleteVariantsForFood = db.prepare('DELETE FROM food_variants WHERE food_id = ?')

// Writes one food + all its variants. On a fresh food this is a plain insert; on a
// re-import of an already-known (source, source_id) food, existing variants are deleted
// and reinserted wholesale — matches how a re-import already refreshes a food's own
// fields via ON CONFLICT DO UPDATE, applied consistently to its variants too.
function writeResult(result: FoodImportResult): void {
  const { id: foodId } = upsertFood.get(result.food) as { id: number }
  deleteVariantsForFood.run(foodId)
  for (const variant of result.variants) {
    insertVariant.run({
      food_id: foodId,
      label: variant.label,
      serving_qty: variant.serving_qty,
      serving_unit: variant.serving_unit,
      gram_weight: variant.gram_weight,
      is_default: variant.is_default ? 1 : 0,
      source: variant.source,
      ...Object.fromEntries(variantCols.map(k => [k, (variant as Record<string, unknown>)[k] ?? null])),
    })
  }
}

// Reads a local USDA FoodData Central JSON dump file (Foundation Foods and/or SR Legacy)
// and upserts every mappable record (+ its variants) into foods/food_variants. A record
// mapUsdaFoodToRow can't make sense of (e.g. missing foodNutrients) is skipped, not
// thrown — matching importOffDumpFile's skip-and-continue behavior, so one bad record in
// a real multi-thousand-record file doesn't lose the rest. Returns the number of foods
// actually written (not the variant count).
//
// Wrapped in db.transaction() — matches the batching convention every other bulk-write
// path in this codebase uses, and makes the import atomic against genuine DB-level
// failures: those abort and roll back the whole run rather than leaving foods/
// food_variants in a half-imported state with no way to detect it.
export function importUsdaDumpFile(filePath: string): number {
  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
  const records = extractRecordsArray(parsed) as UsdaFoodRecord[]
  let written = 0
  const writeAll = db.transaction((recs: UsdaFoodRecord[]) => {
    for (const record of recs) {
      const result = mapUsdaFoodToRow(record)
      if (!result) continue
      writeResult(result)
      written++
    }
  })
  writeAll(records)
  return written
}

// Reads a local Open Food Facts JSONL dump file (one JSON product document per line) and
// upserts every mappable record (+ its single default variant) into foods/food_variants.
// Records with no usable product name are skipped, not inserted. Returns the number of
// foods actually written. Transactional for the same reason as importUsdaDumpFile above.
export function importOffDumpFile(filePath: string): number {
  const lines = fs.readFileSync(filePath, 'utf-8').split('\n').filter(line => line.trim().length > 0)
  let written = 0
  const writeAll = db.transaction((allLines: string[]) => {
    for (const line of allLines) {
      const record = JSON.parse(line) as OffProductRecord
      const result = mapOffProductToRow(record)
      if (!result) continue
      writeResult(result)
      written++
    }
  })
  writeAll(lines)
  return written
}
```

Note: `upsertFood.get(...)` with `RETURNING id` requires better-sqlite3's `.get()` on a statement that both writes and returns a row — confirm this pattern works by running the tests in the next step; better-sqlite3 supports `RETURNING` since SQLite 3.35 and exposes it via `.get()`/`.all()` on an otherwise-INSERT statement.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run --config vitest.config.ts tests/server/foodImportLoader.test.ts`
Expected: PASS (all tests).

- [ ] **Step 6: Run full suite and typecheck**

Run: `npm test && npx tsc --noEmit && npx tsc -p tsconfig.server.json --noEmit`
Expected: `server/api/nutrition.ts` and its tests (`tests/server/nutrition.test.ts`) still fail/error — Tasks 5–8 fix those. Confirm no new failures beyond that known set.

- [ ] **Step 7: Commit**

```bash
git add server/lib/nutrition/foodImportLoader.ts tests/server/foodImportLoader.test.ts tests/server/fixtures/nutrition/usda-dump-with-portions.json
git commit -m "feat: import loader writes food + variants, refreshing variants wholesale on re-import"
```

---

### Task 4: Wipe and re-run the real import

**Files:** none changed — this is an operational task against the live database, not a code change.

**Interfaces:**
- Consumes: `importUsdaDumpFile` (Task 3), the real files at `data/nutrition-import/FoodData_Central_foundation_food_json_2026-04-30.json` and `data/nutrition-import/FoodData_Central_sr_legacy_food_json_2018-04.json`.
- Produces: a populated `foods`/`food_variants` table on the live DB (`/opt/bacta/data/bacta.db`), matching the shape Tasks 5+ assume.

- [ ] **Step 1: Confirm the live DB has no real data to lose**

Run (via the `bacta-sqlite` MCP or `sqlite3`-equivalent): 
```sql
SELECT (SELECT COUNT(*) FROM food_log_entries) as log_entries, (SELECT COUNT(*) FROM recipes) as recipes;
```
Expected: both `0`. **If either is nonzero, STOP — do not proceed with this task; the wipe-and-reimport assumption no longer holds and this plan needs re-scoping (see the design spec's "Migration strategy" section).**

- [ ] **Step 2: Restart `bacta-api` so it picks up the new schema via `migrate()`**

```bash
sudo systemctl restart bacta-api
sleep 2
sudo systemctl status bacta-api --no-pager | tail -10
```
Expected: `active (running)`, log line `[db] migrated to food_variants schema — ... re-run scripts/nutrition/importFoods.ts to repopulate foods`, then `[db] migrations complete`.

- [ ] **Step 3: Confirm `foods`/`food_variants` are now empty**

```sql
SELECT (SELECT COUNT(*) FROM foods) as foods, (SELECT COUNT(*) FROM food_variants) as variants;
```
Expected: both `0` (the migration's `DELETE FROM foods` ran).

- [ ] **Step 4: Re-run the import**

```bash
cd /opt/bacta
npx tsx scripts/nutrition/importFoods.ts --usda data/nutrition-import/FoodData_Central_foundation_food_json_2026-04-30.json
npx tsx scripts/nutrition/importFoods.ts --usda data/nutrition-import/FoodData_Central_sr_legacy_food_json_2018-04.json
```
Expected: `[nutrition-import] USDA: processed 363 record(s)...` then `[nutrition-import] USDA: processed 7793 record(s)...` (same counts as the original 2026-07-15 import — the same source files, same null-entry handling from PR #148).

- [ ] **Step 5: Verify variant counts roughly match the measured distribution**

```sql
SELECT COUNT(*) as foods, (SELECT COUNT(*) FROM food_variants) as variants FROM foods;
SELECT v, COUNT(*) FROM (SELECT food_id, COUNT(*) as v FROM food_variants GROUP BY food_id) GROUP BY v ORDER BY v;
```
Expected: `foods` = 8156 (unchanged from before). Variant-count-per-food distribution should resemble the `foodPortions`-count distribution measured during brainstorming (94% of foods with 1-4 variants, long tail to ~17), since every food gets `1 (default) + count(foodPortions)` variants.

- [ ] **Step 6: No commit** — this task changes only the running database, not source-controlled files.

---

### Task 5: API — `foods` and `food_variants` routes

**Files:**
- Modify: `server/api/nutrition.ts`
- Modify: `tests/server/nutrition.test.ts`

**Interfaces:**
- Consumes: `NUMERIC_NUTRIENT_KEYS`, `DESCRIPTIVE_NUTRIENT_KEYS`, `JSON_NUTRIENT_KEYS`, `NumericRow` (Task 1, unchanged).
- Produces:
  - `GET /api/nutrition/foods?q=` → `{ foods: Array<{ id, source, source_id, name, brand, variants: FoodVariantRow[] }> }`
  - `POST /api/nutrition/foods` → creates a food + its first (`is_default`) variant, returns `{ ...food, variants: [variant] }`
  - `POST /api/nutrition/foods/:id/variants` → adds a variant, returns the created variant row
  - `DELETE /api/nutrition/food_variants/:id` → `{ ok: true }` or 400 if it's the food's last variant
  - `GET /api/nutrition/foods/barcode/:code` → same nested shape as `GET /foods?q=`'s single-food entry
  - Task 6 (log routes) consumes: a `food_variants` row lookup by id, shape `{ id, food_id } & NumericRow & { glycemic_index, custom_nutrients, allergens, traces }`.

- [ ] **Step 1: Write the failing tests**

These replace the existing `foods`-related tests in `tests/server/nutrition.test.ts`. Find the existing `describe` blocks covering `POST /foods`, `GET /foods`, `DELETE /foods/:id`, and barcode lookup (search the file for `'/foods'` and `barcode`), and replace them with:

```ts
describe('GET/POST /api/nutrition/foods and variants', () => {
  it('POST /foods creates a food with its first variant as is_default', async () => {
    const { app } = await import('../../server/index')
    const res = await request(app).post('/api/nutrition/foods').send({
      name: 'Test Oats', brand: null,
      variant: { label: '100 g', serving_qty: 100, serving_unit: 'g', calories: 389, protein_g: 13.2 },
    })
    expect(res.status).toBe(201)
    expect(res.body).toMatchObject({ name: 'Test Oats', source: 'custom' })
    expect(res.body.variants).toHaveLength(1)
    expect(res.body.variants[0]).toMatchObject({ label: '100 g', is_default: 1, calories: 389, protein_g: 13.2 })
  })

  it('POST /foods rejects a variant with serving_qty <= 0', async () => {
    const { app } = await import('../../server/index')
    const res = await request(app).post('/api/nutrition/foods').send({
      name: 'Bad Food', variant: { label: 'bad', serving_qty: 0, serving_unit: 'g' },
    })
    expect(res.status).toBe(400)
  })

  it('GET /foods?q= returns matching foods with nested variants', async () => {
    const { app } = await import('../../server/index')
    await request(app).post('/api/nutrition/foods').send({
      name: 'Findable Bread', variant: { label: '1 slice', serving_qty: 1, serving_unit: 'slice', calories: 80 },
    })
    const res = await request(app).get('/api/nutrition/foods?q=Findable')
    expect(res.status).toBe(200)
    expect(res.body.foods).toHaveLength(1)
    expect(res.body.foods[0].variants[0]).toMatchObject({ label: '1 slice', calories: 80 })
  })

  it('POST /foods/:id/variants adds a non-default variant to an existing food', async () => {
    const { app } = await import('../../server/index')
    const created = await request(app).post('/api/nutrition/foods').send({
      name: 'Multi-Serving Food', variant: { label: '100 g', serving_qty: 100, serving_unit: 'g', calories: 200 },
    })
    const res = await request(app).post(`/api/nutrition/foods/${created.body.id}/variants`).send({
      label: '1 cup', serving_qty: 1, serving_unit: 'cup', calories: 240,
    })
    expect(res.status).toBe(201)
    expect(res.body).toMatchObject({ label: '1 cup', is_default: 0, food_id: created.body.id })

    const listRes = await request(app).get(`/api/nutrition/foods?q=Multi-Serving`)
    expect(listRes.body.foods[0].variants).toHaveLength(2)
  })

  it('POST /foods/:id/variants 404s for a nonexistent food', async () => {
    const { app } = await import('../../server/index')
    const res = await request(app).post('/api/nutrition/foods/999999/variants').send({ label: 'x', serving_qty: 1, serving_unit: 'g' })
    expect(res.status).toBe(404)
  })

  it('DELETE /food_variants/:id removes a non-default variant', async () => {
    const { app } = await import('../../server/index')
    const created = await request(app).post('/api/nutrition/foods').send({
      name: 'Deletable Variant Food', variant: { label: '100 g', serving_qty: 100, serving_unit: 'g' },
    })
    const added = await request(app).post(`/api/nutrition/foods/${created.body.id}/variants`).send({ label: '1 cup', serving_qty: 1, serving_unit: 'cup' })
    const res = await request(app).delete(`/api/nutrition/food_variants/${added.body.id}`)
    expect(res.status).toBe(200)
  })

  it('DELETE /food_variants/:id is blocked (400) when it is the food\'s last remaining variant', async () => {
    const { app } = await import('../../server/index')
    const created = await request(app).post('/api/nutrition/foods').send({
      name: 'Single Variant Food', variant: { label: '100 g', serving_qty: 100, serving_unit: 'g' },
    })
    const variantId = created.body.variants[0].id
    const res = await request(app).delete(`/api/nutrition/food_variants/${variantId}`)
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/at least one/i)
  })

  it('GET /foods/barcode/:code returns a matching Open Food Facts food with its variants', async () => {
    const { default: db } = await import('../../server/db/client')
    const foodInfo = db.prepare("INSERT INTO foods (source, source_id, name) VALUES ('openfoodfacts', '111222333', 'Barcode Food')").run()
    db.prepare(`
      INSERT INTO food_variants (food_id, label, serving_qty, serving_unit, is_default, source, calories)
      VALUES (?, '100 g', 100, 'g', 1, 'openfoodfacts', 150)
    `).run(foodInfo.lastInsertRowid)

    const { app } = await import('../../server/index')
    const res = await request(app).get('/api/nutrition/foods/barcode/111222333')
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ name: 'Barcode Food' })
    expect(res.body.variants[0]).toMatchObject({ calories: 150 })
  })

  it('GET /foods/barcode/:code 404s when no food matches', async () => {
    const { app } = await import('../../server/index')
    const res = await request(app).get('/api/nutrition/foods/barcode/nonexistent')
    expect(res.status).toBe(404)
  })
})
```

Confirm the file already imports `request` from `supertest` and `app` the established way (check the top of `tests/server/nutrition.test.ts` — it should already follow the `DB_PATH=':memory:'` + dynamic-import pattern established across this test suite; if `app`/`request` aren't already set up exactly this way, match whatever the file's existing tests do instead of introducing a new pattern).

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run --config vitest.config.ts tests/server/nutrition.test.ts -t "foods and variants"`
Expected: FAIL — routes still operate on the old flat `foods` shape.

- [ ] **Step 3: Rewrite the foods/variants section of `server/api/nutrition.ts`**

Replace everything from the `GET /foods/barcode/:code` route through the end of the `DELETE /api/nutrition/foods/:id` route (i.e. replace the barcode route, `GET /foods`, `FoodBody`/`POST /foods`, `FoodRow`, and `DELETE /foods/:id` — leave `scale`/`roundKcal`/`roundMacro` and everything from `GET /log` onward for now; Task 6 handles those) with:

```ts
interface VariantInput extends NumericRow {
  label: string
  serving_qty: number
  serving_unit: string
  gram_weight?: number | null
  glycemic_index?: string
  custom_nutrients?: unknown
  allergens?: unknown
  traces?: unknown
}

interface FoodBody {
  name: string
  brand?: string
  variant: VariantInput
}

const variantCols = [...NUMERIC_NUTRIENT_KEYS, ...DESCRIPTIVE_NUTRIENT_KEYS] as const

function insertVariant(foodId: number, v: VariantInput, isDefault: boolean, source: string): number | bigint {
  const info = db.prepare(`
    INSERT INTO food_variants (
      food_id, label, serving_qty, serving_unit, gram_weight, is_default, source,
      ${variantCols.join(', ')}
    )
    VALUES (
      @food_id, @label, @serving_qty, @serving_unit, @gram_weight, @is_default, @source,
      ${variantCols.map(k => '@' + k).join(', ')}
    )
  `).run({
    food_id: foodId, label: v.label, serving_qty: v.serving_qty, serving_unit: v.serving_unit,
    gram_weight: v.gram_weight ?? null, is_default: isDefault ? 1 : 0, source,
    ...Object.fromEntries(NUMERIC_NUTRIENT_KEYS.map(k => [k, v[k] ?? null])),
    glycemic_index: v.glycemic_index ?? null,
    custom_nutrients: parseJsonField(v.custom_nutrients),
    allergens: parseJsonField(v.allergens),
    traces: parseJsonField(v.traces),
  })
  return info.lastInsertRowid
}

function foodWithVariants(foodId: number): unknown {
  const food = db.prepare('SELECT * FROM foods WHERE id = ?').get(foodId)
  if (!food) return null
  const variants = db.prepare('SELECT * FROM food_variants WHERE food_id = ? ORDER BY is_default DESC, id').all(foodId)
  return { ...(food as object), variants }
}

// GET /api/nutrition/foods/barcode/:code — look up a food by barcode (#141). Registered
// before the generic GET /foods so it isn't shadowed.
nutritionRouter.get('/foods/barcode/:code', (req, res) => {
  const { code } = req.params
  const food = db.prepare(
    "SELECT * FROM foods WHERE source_id = ? AND source = 'openfoodfacts'"
  ).get(code) as { id: number } | undefined
  if (!food) {
    res.status(404).json({ error: 'No food matches this barcode' })
    return
  }
  res.json(foodWithVariants(food.id))
})

// GET /api/nutrition/foods?q= — search reference foods by name, each with its variants nested
nutritionRouter.get('/foods', (req, res) => {
  const q = (req.query.q as string | undefined) ?? ''
  const foods = db.prepare('SELECT * FROM foods WHERE name LIKE ? ORDER BY name').all(`%${q}%`) as Array<{ id: number }>
  const withVariants = foods.map(f => foodWithVariants(f.id))
  res.json({ foods: withVariants })
})

// POST /api/nutrition/foods — save a new custom/ad-hoc food + its first (default) variant,
// in one transaction (a food with zero variants is an invalid state — see schema.sql).
nutritionRouter.post('/foods', (req, res) => {
  const body = req.body as FoodBody
  const { name, brand, variant } = body

  if (!variant || !(variant.serving_qty > 0)) {
    res.status(400).json({ error: 'variant.serving_qty must be greater than 0' })
    return
  }

  try {
    const createFood = db.transaction(() => {
      const foodInfo = db.prepare('INSERT INTO foods (source, name, brand) VALUES (\'custom\', ?, ?)').run(name, brand ?? null)
      insertVariant(foodInfo.lastInsertRowid as number, variant, true, 'custom')
      return foodInfo.lastInsertRowid as number
    })
    const foodId = createFood()
    res.status(201).json(foodWithVariants(foodId))
  } catch (err: unknown) {
    console.error('[nutrition] custom food save failed:', err)
    res.status(400).json({ error: 'Could not save custom food' })
  }
})

// POST /api/nutrition/foods/:id/variants — add another serving size to an existing food
// (USDA-sourced or custom). Never marks the new variant is_default.
nutritionRouter.post('/foods/:id/variants', (req, res) => {
  const { id } = req.params
  const food = db.prepare('SELECT * FROM foods WHERE id = ?').get(id) as { id: number; source: string } | undefined
  if (!food) {
    res.status(404).json({ error: 'Food not found' })
    return
  }
  const variant = req.body as VariantInput
  if (!(variant.serving_qty > 0)) {
    res.status(400).json({ error: 'serving_qty must be greater than 0' })
    return
  }
  try {
    const variantId = insertVariant(food.id, variant, false, food.source)
    const row = db.prepare('SELECT * FROM food_variants WHERE id = ?').get(variantId)
    res.status(201).json(row)
  } catch (err: unknown) {
    console.error('[nutrition] add variant failed:', err)
    res.status(400).json({ error: 'Could not add variant' })
  }
})

function isForeignKeyErrorEarly(err: unknown): boolean {
  return err instanceof Error && err.message.includes('FOREIGN KEY constraint failed')
}

// DELETE /api/nutrition/food_variants/:id — remove a serving size. Blocked (400) if it's
// the food's last remaining variant (a food must always have at least one — see
// schema.sql's comment on food_variants) or if food_log_entries/recipe_ingredients rows
// still reference it.
nutritionRouter.delete('/food_variants/:id', (req, res) => {
  const { id } = req.params
  const variant = db.prepare('SELECT * FROM food_variants WHERE id = ?').get(id) as { food_id: number } | undefined
  if (!variant) {
    res.status(404).json({ error: 'Variant not found' })
    return
  }
  const remaining = db.prepare('SELECT COUNT(*) as n FROM food_variants WHERE food_id = ?').get(variant.food_id) as { n: number }
  if (remaining.n <= 1) {
    res.status(400).json({ error: 'A food must have at least one serving — delete the food itself instead' })
    return
  }
  try {
    db.prepare('DELETE FROM food_variants WHERE id = ?').run(id)
    res.json({ ok: true })
  } catch (err: unknown) {
    if (isForeignKeyErrorEarly(err)) {
      res.status(400).json({ error: 'Cannot delete — this variant has been logged or used in a recipe' })
      return
    }
    console.error('[nutrition] variant delete failed:', err)
    res.status(400).json({ error: 'Could not delete variant' })
  }
})

// DELETE /api/nutrition/foods/:id — remove a saved food and all its variants. Blocked
// (400) if any variant has ever been logged or used as a recipe ingredient.
nutritionRouter.delete('/foods/:id', (req, res) => {
  const { id } = req.params
  try {
    const deleteFood = db.transaction(() => {
      db.prepare('DELETE FROM food_variants WHERE food_id = ?').run(id)
      return db.prepare('DELETE FROM foods WHERE id = ?').run(id)
    })
    const info = deleteFood()
    if (info.changes === 0) {
      res.status(404).json({ error: 'Food not found' })
      return
    }
    res.json({ ok: true })
  } catch (err: unknown) {
    if (isForeignKeyErrorEarly(err)) {
      res.status(400).json({ error: 'Cannot delete — this food has been logged or used in a recipe' })
      return
    }
    console.error('[nutrition] food delete failed:', err)
    res.status(400).json({ error: 'Could not delete food' })
  }
})
```

Note: `isForeignKeyErrorEarly` is a temporary name to avoid a duplicate-declaration clash with the existing `isForeignKeyError` defined later in the file (used by the recipes routes). In Task 7, when the recipes section is touched, rename both call sites to share the single existing `isForeignKeyError` function and delete this temporary one — call this out explicitly in Task 7's steps so it isn't forgotten.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run --config vitest.config.ts tests/server/nutrition.test.ts -t "foods and variants"`
Expected: PASS.

- [ ] **Step 5: Run the full nutrition test file**

Run: `npx vitest run --config vitest.config.ts tests/server/nutrition.test.ts`
Expected: The `foods`/`variants`/barcode tests pass; log/recipe tests still fail (Tasks 6–7 fix them) — confirm failures are confined to those, not new breakage in the foods section.

- [ ] **Step 6: Commit**

```bash
git add server/api/nutrition.ts tests/server/nutrition.test.ts
git commit -m "feat: foods/food_variants API routes — nested variants, add-variant, variant delete with last-variant guard"
```

---

### Task 6: API — `POST/PUT /log` use `variant_id` + quantity-as-servings

**Files:**
- Modify: `server/api/nutrition.ts`
- Modify: `tests/server/nutrition.test.ts`

**Interfaces:**
- Consumes: `food_variants` row shape from Task 5.
- Produces: `food_log_entries` rows keyed by `variant_id`; `POST/PUT /log` request bodies take `variant_id` (not `food_id`) and `quantity` means "count of that variant's serving."

- [ ] **Step 1: Write the failing tests**

Find the existing `describe` blocks covering `POST /log`, `PUT /log/:id`, `GET /log`, `GET /summary`, `GET /trend` in `tests/server/nutrition.test.ts` — these mostly stay structurally similar but every `food_id` setup needs to become a variant creation + `variant_id`. Replace the food/variant setup helper at the top of whichever `describe` block seeds a reference food for log tests (search for wherever the file currently does something like `INSERT INTO foods ... default_qty ...` to seed a food for log-entry tests) with:

```ts
async function seedFoodWithVariant(overrides: Partial<{ name: string; serving_qty: number; serving_unit: string; calories: number; protein_g: number }> = {}) {
  const { default: db } = await import('../../server/db/client')
  const foodInfo = db.prepare("INSERT INTO foods (source, name) VALUES ('custom', ?)").run(overrides.name ?? 'Test Oats')
  const variantInfo = db.prepare(`
    INSERT INTO food_variants (food_id, label, serving_qty, serving_unit, is_default, source, calories, protein_g)
    VALUES (?, '100 g', ?, ?, 1, 'custom', ?, ?)
  `).run(
    foodInfo.lastInsertRowid,
    overrides.serving_qty ?? 100, overrides.serving_unit ?? 'g',
    overrides.calories ?? 389, overrides.protein_g ?? 13.2,
  )
  return { foodId: foodInfo.lastInsertRowid as number, variantId: variantInfo.lastInsertRowid as number }
}
```

Then add/replace these test cases:

```ts
describe('POST /api/nutrition/log with variant_id', () => {
  it('scales macros from the variant times quantity (quantity = count of that serving)', async () => {
    const { variantId } = await seedFoodWithVariant({ serving_qty: 100, calories: 389, protein_g: 13.2 })
    const { app } = await import('../../server/index')
    const res = await request(app).post('/api/nutrition/log').send({
      date: '2026-07-20', meal_type: 'breakfast', variant_id: variantId, quantity: 2,
    })
    expect(res.status).toBe(201)
    expect(res.body).toMatchObject({ calories: 778, protein_g: 26.4, unit: 'g', quantity: 2 })
  })

  it('400s for a variant_id that does not reference an existing variant', async () => {
    const { app } = await import('../../server/index')
    const res = await request(app).post('/api/nutrition/log').send({ date: '2026-07-20', meal_type: 'lunch', variant_id: 999999, quantity: 1 })
    expect(res.status).toBe(400)
  })

  it('ad-hoc entries (no variant_id) are unaffected', async () => {
    const { app } = await import('../../server/index')
    const res = await request(app).post('/api/nutrition/log').send({
      date: '2026-07-20', meal_type: 'snack', name: 'Handful of nuts', quantity: 1, unit: 'handful', calories: 180,
    })
    expect(res.status).toBe(201)
    expect(res.body).toMatchObject({ name: 'Handful of nuts', calories: 180 })
  })
})

describe('PUT /api/nutrition/log/:id with variant_id', () => {
  it('rescales from the entry\'s own stored quantity/macros on a quantity change, same as before', async () => {
    const { variantId } = await seedFoodWithVariant({ serving_qty: 100, calories: 200, protein_g: 10 })
    const { app } = await import('../../server/index')
    const created = await request(app).post('/api/nutrition/log').send({ date: '2026-07-20', meal_type: 'lunch', variant_id: variantId, quantity: 1 })
    const res = await request(app).put(`/api/nutrition/log/${created.body.id}`).send({ quantity: 2 })
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ quantity: 2, calories: 400, protein_g: 20 })
  })
})
```

Also update `GET /log`, `GET /summary`, `GET /trend` tests that seed entries directly via `db.prepare('INSERT INTO food_log_entries (..., food_id, ...) ...')` — change every such raw insert to use `variant_id` instead of `food_id` (search the file for `INSERT INTO food_log_entries` and update each occurrence's column list).

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run --config vitest.config.ts tests/server/nutrition.test.ts -t "variant_id"`
Expected: FAIL — routes still expect `food_id`.

- [ ] **Step 3: Rewrite the log routes in `server/api/nutrition.ts`**

Replace the `interface LogEntryBody`, `POST /log`, and `PUT /log/:id` sections:

```ts
interface LogEntryBody extends NumericRow {
  date: string
  meal_type: string
  variant_id?: number
  name?: string
  quantity: number
  unit?: string
  glycemic_index?: string
  custom_nutrients?: unknown
  allergens?: unknown
  traces?: unknown
}

interface VariantRow extends NumericRow {
  id: number
  food_id: number
  label: string
  serving_unit: string
  glycemic_index: string | null
  custom_nutrients: string | null
  allergens: string | null
  traces: string | null
}

// POST /api/nutrition/log — log a new entry, either against a variant (quantity = count
// of that variant's serving) or fully ad-hoc.
nutritionRouter.post('/log', (req, res) => {
  const body = req.body as LogEntryBody
  const { date, meal_type, variant_id, name, quantity } = body

  if (!(quantity > 0)) {
    res.status(400).json({ error: 'quantity must be greater than 0' })
    return
  }

  try {
    let unit: string
    let entry: { name: string } & NumericRow & { glycemic_index: string | null; custom_nutrients: unknown; allergens: unknown; traces: unknown }

    if (variant_id !== undefined && variant_id !== null) {
      const variant = db.prepare('SELECT fv.*, f.name as food_name FROM food_variants fv JOIN foods f ON f.id = fv.food_id WHERE fv.id = ?')
        .get(variant_id) as (VariantRow & { food_name: string }) | undefined
      if (!variant) {
        res.status(400).json({ error: 'variant_id does not reference an existing variant' })
        return
      }
      unit = variant.serving_unit
      entry = {
        name: variant.food_name,
        ...Object.fromEntries(NUMERIC_NUTRIENT_KEYS.map(k => [k, scale(variant[k] ?? null, quantity)])),
        glycemic_index: variant.glycemic_index ?? null,
        custom_nutrients: variant.custom_nutrients ?? null,
        allergens: variant.allergens ?? null,
        traces: variant.traces ?? null,
      }
    } else {
      unit = body.unit ?? ''
      entry = {
        name: name ?? '',
        ...Object.fromEntries(NUMERIC_NUTRIENT_KEYS.map(k => [k, body[k] ?? null])),
        glycemic_index: body.glycemic_index ?? null,
        custom_nutrients: parseJsonField(body.custom_nutrients),
        allergens: parseJsonField(body.allergens),
        traces: parseJsonField(body.traces),
      }
    }

    const stmt = db.prepare(`
      INSERT INTO food_log_entries (
        date, meal_type, variant_id, name, quantity, unit,
        ${NUMERIC_NUTRIENT_KEYS.join(', ')}, glycemic_index, custom_nutrients, allergens, traces
      )
      VALUES (
        @date, @meal_type, @variant_id, @name, @quantity, @unit,
        ${NUMERIC_NUTRIENT_KEYS.map(k => '@' + k).join(', ')}, @glycemic_index, @custom_nutrients, @allergens, @traces
      )
    `)
    const info = stmt.run({ date, meal_type, variant_id: variant_id ?? null, quantity, unit, ...entry })
    const row = db.prepare('SELECT * FROM food_log_entries WHERE id = ?').get(info.lastInsertRowid)
    res.status(201).json(row)
  } catch (err: unknown) {
    console.error('[nutrition] log entry save failed:', err)
    res.status(400).json({ error: 'Could not save log entry' })
  }
})

// PUT /api/nutrition/log/:id — edit a logged entry. Rescales from the entry's OWN prior
// quantity/macros (not a live variant re-read) for the same reason as before PUT already
// did this: the referenced variant can itself have changed since this entry was logged.
nutritionRouter.put('/log/:id', (req, res) => {
  const { id } = req.params
  const existing = db.prepare('SELECT * FROM food_log_entries WHERE id = ?').get(id) as
    Record<string, unknown> | undefined
  if (!existing) {
    res.status(404).json({ error: 'Log entry not found' })
    return
  }

  const editable = ['date', 'meal_type', 'name', 'quantity', 'unit', ...NUMERIC_NUTRIENT_KEYS, ...DESCRIPTIVE_NUTRIENT_KEYS] as const
  const updates: Record<string, unknown> = {}
  for (const key of editable) {
    if (key in req.body) {
      updates[key] = (JSON_NUTRIENT_KEYS as readonly string[]).includes(key) ? parseJsonField(req.body[key]) : req.body[key]
    }
  }

  if (existing.variant_id != null && 'quantity' in updates) {
    const finalQuantity = updates.quantity as number
    if (finalQuantity <= 0) {
      res.status(400).json({ error: 'quantity must be greater than 0' })
      return
    }
    const existingQuantity = existing.quantity as number
    if (existingQuantity <= 0) {
      res.status(400).json({ error: 'Log entry has an invalid stored quantity' })
      return
    }
    const factor = finalQuantity / existingQuantity
    for (const key of NUMERIC_NUTRIENT_KEYS) {
      if (!(key in updates)) {
        updates[key] = scale((existing[key] as number | null) ?? null, factor)
      }
    }
  }

  const merged = { ...existing, ...updates }
  db.prepare(`
    UPDATE food_log_entries SET
      date = @date, meal_type = @meal_type, name = @name, quantity = @quantity, unit = @unit,
      ${NUMERIC_NUTRIENT_KEYS.map(k => `${k} = @${k}`).join(', ')},
      glycemic_index = @glycemic_index, custom_nutrients = @custom_nutrients, allergens = @allergens, traces = @traces
    WHERE id = @id
  `).run({ ...merged, id })

  const row = db.prepare('SELECT * FROM food_log_entries WHERE id = ?').get(id)
  res.json(row)
})
```

Note the changed `scale` semantics: `POST /log`'s food-linked path now scales by `quantity` directly (not `quantity / default_qty`), since a variant's stored macros already represent exactly one serving — quantity=2 means "twice this variant's macros." Confirm `scale(value, factor)`'s existing definition (`Math.round(value * factor * 100) / 100`) is still imported/defined above this block unchanged — it is, from the untouched portion of the file.

Also note: `PUT /log/:id` no longer needs the "unit mismatch" check that used to re-validate against `food.default_unit` on every edit — a variant-linked entry's `unit` is denormalized at creation time from the variant and isn't independently editable in this API (the client doesn't send `unit` for a variant-linked PUT). This is a deliberate simplification versus the old behavior, consistent with the design spec's "quantity = count of that serving" decision.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run --config vitest.config.ts tests/server/nutrition.test.ts -t "variant_id"`
Expected: PASS.

- [ ] **Step 5: Run the full nutrition test file**

Run: `npx vitest run --config vitest.config.ts tests/server/nutrition.test.ts`
Expected: `foods`/`variants`/`log` tests pass; recipe tests still fail (Task 7). Confirm `GET /log`, `GET /summary`, `GET /trend` tests (which read denormalized columns, unaffected by the `food_id`→`variant_id` rename except in their seed helpers) now pass too.

- [ ] **Step 6: Commit**

```bash
git add server/api/nutrition.ts tests/server/nutrition.test.ts
git commit -m "feat: POST/PUT /log use variant_id, quantity means count of that variant's serving"
```

---

### Task 7: API — recipes use `variant_id`, merge the two `isForeignKeyError` helpers

**Files:**
- Modify: `server/api/nutrition.ts`
- Modify: `tests/server/nutrition.test.ts`

**Interfaces:**
- Consumes: Task 5's `food_variants`, Task 6's `NUMERIC_NUTRIENT_KEYS`-driven patterns.
- Produces: `recipe_ingredients.variant_id` used by `POST/GET/PUT /recipes` and `/recipes/:id`; a recipe's own materialized food (created by `POST/PUT /recipes`) also gets exactly one (`is_default`) variant, matching every other food's invariant.

- [ ] **Step 1: Write the failing tests**

Find the existing recipe-related tests in `tests/server/nutrition.test.ts` (search for `/recipes`). Replace any raw `food_id`-based ingredient seeding with variant-based seeding using the `seedFoodWithVariant` helper from Task 6, and replace `ingredients: [{ food_id: ..., ... }]` request bodies with `ingredients: [{ variant_id: ..., ... }]`. Add:

```ts
describe('POST /api/nutrition/recipes with variant_id ingredients', () => {
  it('creates a recipe whose materialized food has exactly one (default) variant', async () => {
    const { variantId } = await seedFoodWithVariant({ calories: 200, protein_g: 10 })
    const { app } = await import('../../server/index')
    const res = await request(app).post('/api/nutrition/recipes').send({
      name: 'Test Recipe', servings: 2,
      ingredients: [{ variant_id: variantId, name: 'Test Oats', quantity: 1, unit: 'g', calories: 200, protein_g: 10 }],
    })
    expect(res.status).toBe(201)
    expect(res.body.food.variants).toHaveLength(1)
    expect(res.body.food.variants[0]).toMatchObject({ is_default: 1, calories: 100 }) // 200/2 servings
  })

  it('PUT /recipes/:id updates ingredients keyed by variant_id', async () => {
    const { variantId } = await seedFoodWithVariant({ calories: 100 })
    const { app } = await import('../../server/index')
    const created = await request(app).post('/api/nutrition/recipes').send({
      name: 'Editable Recipe', servings: 1,
      ingredients: [{ variant_id: variantId, name: 'Test Oats', quantity: 1, unit: 'g', calories: 100 }],
    })
    const res = await request(app).put(`/api/nutrition/recipes/${created.body.id}`).send({
      name: 'Editable Recipe', servings: 2,
      ingredients: [{ variant_id: variantId, name: 'Test Oats', quantity: 1, unit: 'g', calories: 100 }],
    })
    expect(res.status).toBe(200)
    expect(res.body.food.variants[0].calories).toBe(50) // 100/2 servings
  })

  it('GET /recipes/:id returns ingredients with variant_id, not food_id', async () => {
    const { variantId } = await seedFoodWithVariant({ calories: 100 })
    const { app } = await import('../../server/index')
    const created = await request(app).post('/api/nutrition/recipes').send({
      name: 'Composition Recipe', servings: 1,
      ingredients: [{ variant_id: variantId, name: 'Test Oats', quantity: 1, unit: 'g', calories: 100 }],
    })
    const res = await request(app).get(`/api/nutrition/recipes/${created.body.id}`)
    expect(res.body.ingredients[0]).toMatchObject({ variant_id: variantId })
    expect(res.body.ingredients[0].food_id).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run --config vitest.config.ts tests/server/nutrition.test.ts -t "recipes with variant_id"`
Expected: FAIL.

- [ ] **Step 3: Rewrite the recipes section of `server/api/nutrition.ts`**

Throughout `RecipeIngredientInput`, `POST /recipes`, `GET /recipes/:id`, `PUT /recipes/:id`: rename every `food_id` reference to `variant_id`. Also: the recipe's own materialized food (`INSERT INTO foods ...`) now needs a paired variant insert, since `foods` has no macro columns anymore. Specifically:

Change:
```ts
interface RecipeIngredientInput extends NumericRow {
  food_id?: number
  ...
}
```
to:
```ts
interface RecipeIngredientInput extends NumericRow {
  variant_id?: number
  ...
}
```

In `POST /recipes`'s `createRecipe` transaction, replace:
```ts
      const foodInfo = db.prepare(`
        INSERT INTO foods (source, name, default_qty, default_unit, ${NUMERIC_NUTRIENT_KEYS.join(', ')})
        VALUES ('custom', @name, 1, 'serving', ${NUMERIC_NUTRIENT_KEYS.map(k => '@' + k).join(', ')})
      `).run({ name, ...perServing })
      const foodId = foodInfo.lastInsertRowid
```
with:
```ts
      const foodInfo = db.prepare("INSERT INTO foods (source, name) VALUES ('custom', ?)").run(name)
      const foodId = foodInfo.lastInsertRowid
      db.prepare(`
        INSERT INTO food_variants (food_id, label, serving_qty, serving_unit, is_default, source, ${NUMERIC_NUTRIENT_KEYS.join(', ')})
        VALUES (@food_id, '1 serving', 1, 'serving', 1, 'custom', ${NUMERIC_NUTRIENT_KEYS.map(k => '@' + k).join(', ')})
      `).run({ food_id: foodId, ...perServing })
```

And in the ingredient-insert loop, change every `food_id: ing.food_id ?? null` to `variant_id: ing.variant_id ?? null`, and the column list `food_id,` to `variant_id,` (both in `POST /recipes` and `PUT /recipes/:id`'s equivalent block). In `PUT /recipes/:id`'s materialized-food update, replace the direct `UPDATE foods SET ... ${NUMERIC_NUTRIENT_KEYS...}` with an `UPDATE food_variants SET ... WHERE food_id = @food_id AND is_default = 1` instead (since `foods` no longer has these columns):

```ts
      db.prepare('UPDATE recipes SET name = ?, servings = ? WHERE id = ?').run(name, servings, id)
      db.prepare('UPDATE foods SET name = ? WHERE id = ?').run(name, recipe.food_id)
      db.prepare(`
        UPDATE food_variants SET ${NUMERIC_NUTRIENT_KEYS.map(k => `${k} = @${k}`).join(', ')}
        WHERE food_id = @food_id AND is_default = 1
      `).run({ food_id: recipe.food_id, ...perServing })
```

In `GET /recipes/:id`, change the ingredients query's column list from `food_id,` to `variant_id,`.

In `GET /recipes` (the list route), the `per_serving_*` fields currently join `foods f ON f.id = r.food_id` and select `f.${k}` directly — change the join to select from the food's default variant instead:
```ts
nutritionRouter.get('/recipes', (req, res) => {
  const recipes = db.prepare(`
    SELECT r.id, r.name, r.servings, r.food_id, r.created_at,
      ${NUMERIC_NUTRIENT_KEYS.map(k => `fv.${k} as per_serving_${k}`).join(', ')},
      (SELECT COUNT(*) FROM recipe_ingredients ri WHERE ri.recipe_id = r.id) as ingredient_count
    FROM recipes r
    JOIN food_variants fv ON fv.food_id = r.food_id AND fv.is_default = 1
    ORDER BY r.name
  `).all()
  res.json({ recipes })
})
```

In `DELETE /recipes/:id`, the transaction deletes `recipe_ingredients`, `recipes`, then `foods` by `food_id` — add a `food_variants` delete before the `foods` delete (mirroring `DELETE /foods/:id` from Task 5):
```ts
    const deleteRecipe = db.transaction(() => {
      db.prepare('DELETE FROM recipe_ingredients WHERE recipe_id = ?').run(id)
      db.prepare('DELETE FROM recipes WHERE id = ?').run(id)
      db.prepare('DELETE FROM food_variants WHERE food_id = ?').run(recipe.food_id)
      db.prepare('DELETE FROM foods WHERE id = ?').run(recipe.food_id)
    })
```

Finally, per Task 5's note: delete the temporary `isForeignKeyErrorEarly` function added in Task 5, and change its two call sites (`DELETE /food_variants/:id`, `DELETE /foods/:id`) to call the file's single existing `isForeignKeyError` function instead (defined further down in the file, above `DELETE /recipes/:id`) — move that function's definition up to just after the `insertVariant`/`foodWithVariants` helpers (before its first use in `DELETE /food_variants/:id`) so both sections can share it without a forward-reference.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run --config vitest.config.ts tests/server/nutrition.test.ts`
Expected: PASS — the entire file, not just the recipe-scoped tests.

- [ ] **Step 5: Typecheck**

Run: `npx tsc -p tsconfig.server.json --noEmit`
Expected: Errors remain only in files Tasks 8–9 haven't touched yet (`server/lib/ai/tools.ts` if it references `default_qty`/`food_id` in a type — check now). Confirm no errors remain in `server/api/nutrition.ts` itself.

- [ ] **Step 6: Commit**

```bash
git add server/api/nutrition.ts tests/server/nutrition.test.ts
git commit -m "feat: recipe ingredients use variant_id; recipe's materialized food gets a default variant"
```

---

### Task 8: MX-4 reference — `queryDb` schema description and `MX4_REFERENCE.md`

**Files:**
- Modify: `server/lib/ai/tools.ts`
- Modify: `docs/MX4_REFERENCE.md`
- Modify: `tests/server/tools.test.ts` (or wherever `QUERY_DB_DESCRIPTION` is tested — search for it if the filename differs)

**Interfaces:**
- Consumes: `NUMERIC_NUTRIENT_KEYS`, `DESCRIPTIVE_NUTRIENT_KEYS` (unchanged, Task 1).
- Produces: `QUERY_DB_DESCRIPTION` string mentioning `food_variants` and the new `food_log_entries`/`recipe_ingredients` shape (`variant_id` not `food_id`; `foods` without `default_qty`/`default_unit`).

- [ ] **Step 1: Find and read the existing test for `QUERY_DB_DESCRIPTION`**

```bash
grep -rl "QUERY_DB_DESCRIPTION" tests/
```
Read whichever test file this returns to match its exact assertion style before writing new assertions.

- [ ] **Step 2: Write the failing test**

Add to that test file (adapt the `describe`/`it` wrapper to match the file's existing style):

```ts
it('queryDb schema description mentions food_variants and variant_id, not the old food_id/default_qty shape', async () => {
  const toolsModule = await import('../../server/lib/ai/tools.ts'.replace('.ts', '')) // adjust path per actual import convention in this test file
  // Actual assertion depends on how QUERY_DB_DESCRIPTION is exposed for testing in this
  // file already — match its existing pattern (e.g. exported directly, or read via the
  // queryDb tool's `.description` property) rather than guessing a new one.
})
```

**Note to implementer:** the exact test mechanics depend on how the existing test file currently accesses `QUERY_DB_DESCRIPTION` (it may not be exported directly — check whether the existing tests import the `queryDb` tool object and read `.description`, or import the constant directly). Write this step using that file's real, already-established pattern; don't introduce a new access pattern.

- [ ] **Step 3: Update `server/lib/ai/tools.ts`**

In `QUERY_DB_DESCRIPTION`, replace:
```
  food_log_entries(id INTEGER, date TEXT, meal_type TEXT, logged_at TEXT, food_id INTEGER, name TEXT, quantity REAL, unit TEXT, ${NUMERIC_NUTRIENT_COLS}, ${DESCRIPTIVE_NUTRIENT_COLS})
    — a normal table, NOT EAV like health_snapshots. Multiple rows per day (one per logged food).
    — custom_nutrients/allergens/traces are JSON-encoded strings (object / string array); NULL means not tracked for that entry, not zero/empty.
  nutrition_targets(id INTEGER, date TEXT, ${NUMERIC_NUTRIENT_COLS})
    — one row per date the targets changed. "Current" target = the row with the latest date <= the date in question.
  foods(id INTEGER, source TEXT, name TEXT, brand TEXT, ${NUMERIC_NUTRIENT_COLS}, ${DESCRIPTIVE_NUTRIENT_COLS}, default_qty REAL, default_unit TEXT)
    — reference/ingredient data, not user logs. Rarely needs querying directly by MX-4.
```
with:
```
  food_log_entries(id INTEGER, date TEXT, meal_type TEXT, logged_at TEXT, variant_id INTEGER, name TEXT, quantity REAL, unit TEXT, ${NUMERIC_NUTRIENT_COLS}, ${DESCRIPTIVE_NUTRIENT_COLS})
    — a normal table, NOT EAV like health_snapshots. Multiple rows per day (one per logged food).
    — variant_id references food_variants(id); NULL for a fully ad-hoc entry. quantity means "count of that variant's serving" (e.g. 2 = two of whatever unit the variant is), not raw grams.
    — custom_nutrients/allergens/traces are JSON-encoded strings (object / string array); NULL means not tracked for that entry, not zero/empty.
  nutrition_targets(id INTEGER, date TEXT, ${NUMERIC_NUTRIENT_COLS})
    — one row per date the targets changed. "Current" target = the row with the latest date <= the date in question.
  foods(id INTEGER, source TEXT, source_id TEXT, name TEXT, brand TEXT)
    — reference identity only, not user logs. A food's servable units/macros live on food_variants, not here.
  food_variants(id INTEGER, food_id INTEGER, label TEXT, serving_qty REAL, serving_unit TEXT, gram_weight REAL, is_default INTEGER, source TEXT, ${NUMERIC_NUTRIENT_COLS}, ${DESCRIPTIVE_NUTRIENT_COLS})
    — one row per servable unit of a food (e.g. "100 g", "1 slice"). Rarely needs querying directly by MX-4.
```

- [ ] **Step 4: Update `docs/MX4_REFERENCE.md`**

In §3.1 Data Dictionary — Nutrition, replace the `food_log_entries` bullet's `food_id` mention with `variant_id` (same phrasing pattern, updated field name and meaning), and replace the entire `foods` bullet with two bullets — a slimmed `foods` description and a new `food_variants` description, matching the file's existing prose style (see the bullets already read during planning for exact tone/density). Also correct the pre-existing stale sentence at the end of the old `foods` bullet — "Empty except for user-saved custom foods until a bulk import ships (not yet built)" — which is now doubly wrong (bulk import shipped 2026-07-15, and this plan's Task 4 re-populates it under the new schema): replace with a note that the table is bulk-imported from USDA FoodData Central (Foundation Foods + SR Legacy) plus user-saved custom foods.

- [ ] **Step 5: Run the test and full suite**

Run: `npm test && npx tsc --noEmit && npx tsc -p tsconfig.server.json --noEmit`
Expected: All server tests pass. Client tests/typecheck still fail (Tasks 10–14 fix those) — confirm failures are confined to `client/` files referencing the old `Food`/`FoodLogEntry` shape.

- [ ] **Step 6: Commit**

```bash
git add server/lib/ai/tools.ts docs/MX4_REFERENCE.md tests/server/tools.test.ts
git commit -m "docs: update MX-4's queryDb schema description and MX4_REFERENCE.md for food_variants"
```

(Adjust the test file path in the `git add` to whatever Step 1 actually found.)

---

### Task 9: Client API layer — `nutritionApi.ts` types and fetch functions

**Files:**
- Modify: `client/src/lib/nutritionApi.ts`
- Modify: `tests/client/lib/nutritionApi.test.ts`

**Interfaces:**
- Consumes: the API response/request shapes from Tasks 5–7.
- Produces:
  ```ts
  export interface FoodVariant extends WidenedNutrients, DescriptiveNutrients {
    id: number; food_id: number; label: string; serving_qty: number; serving_unit: string
    gram_weight: number | null; is_default: number; source: string
    calories: number | null; protein_g: number | null; carbs_g: number | null; fat_g: number | null; fiber_g: number | null
  }
  export interface Food { id: number; source: string; name: string; brand: string | null; variants: FoodVariant[] }
  export interface FoodLogEntry { ...; variant_id: number | null; ... } // was food_id
  export interface LogEntryInput { ...; variant_id?: number | null; ... } // was food_id
  export async function addFoodVariant(foodId: number, input: {...}): Promise<FoodVariant>
  export async function deleteFoodVariant(id: number): Promise<void>
  ```
  Tasks 10–13 (frontend) consume all of the above directly.

- [ ] **Step 1: Write the failing tests**

Read the current `tests/client/lib/nutritionApi.test.ts` in full first (its exact mocking pattern for `fetch` — likely `vi.stubGlobal('fetch', ...)` or similar) and match it. Then update/add:

```ts
it('createFood sends name/brand/variant and returns the food with nested variants', async () => {
  const mockFetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: 1, name: 'Test', variants: [{ id: 1, label: '100 g', is_default: 1 }] }) })
  vi.stubGlobal('fetch', mockFetch)
  const { createFood } = await import('../../../client/src/lib/nutritionApi')
  const result = await createFood({ name: 'Test', variant: { label: '100 g', serving_qty: 100, serving_unit: 'g', calories: 200 } })
  expect(mockFetch).toHaveBeenCalledWith('/api/nutrition/foods', expect.objectContaining({
    method: 'POST', body: JSON.stringify({ name: 'Test', variant: { label: '100 g', serving_qty: 100, serving_unit: 'g', calories: 200 } }),
  }))
  expect(result.variants).toHaveLength(1)
})

it('addFoodVariant POSTs to /foods/:id/variants', async () => {
  const mockFetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: 2, label: '1 cup' }) })
  vi.stubGlobal('fetch', mockFetch)
  const { addFoodVariant } = await import('../../../client/src/lib/nutritionApi')
  await addFoodVariant(1, { label: '1 cup', serving_qty: 1, serving_unit: 'cup' })
  expect(mockFetch).toHaveBeenCalledWith('/api/nutrition/foods/1/variants', expect.objectContaining({ method: 'POST' }))
})

it('deleteFoodVariant DELETEs /food_variants/:id', async () => {
  const mockFetch = vi.fn().mockResolvedValue({ ok: true })
  vi.stubGlobal('fetch', mockFetch)
  const { deleteFoodVariant } = await import('../../../client/src/lib/nutritionApi')
  await deleteFoodVariant(5)
  expect(mockFetch).toHaveBeenCalledWith('/api/nutrition/food_variants/5', expect.objectContaining({ method: 'DELETE' }))
})

it('createLogEntry sends variant_id (not food_id)', async () => {
  const mockFetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: 1 }) })
  vi.stubGlobal('fetch', mockFetch)
  const { createLogEntry } = await import('../../../client/src/lib/nutritionApi')
  await createLogEntry({ date: '2026-07-20', meal_type: 'breakfast', variant_id: 3, quantity: 2, unit: 'g' })
  const body = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string)
  expect(body.variant_id).toBe(3)
  expect(body.food_id).toBeUndefined()
})

it('entryToLogInput carries variant_id forward, not food_id', async () => {
  const { entryToLogInput } = await import('../../../client/src/lib/nutritionApi')
  const entry = { id: 1, meal_type: 'lunch', variant_id: 7, name: 'Test', quantity: 1, unit: 'g', calories: 100, protein_g: null, carbs_g: null, fat_g: null, fiber_g: null, logged_at: '' } as any
  const input = entryToLogInput(entry, { date: '2026-07-20' })
  expect(input.variant_id).toBe(7)
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run --config vitest.client.config.ts tests/client/lib/nutritionApi.test.ts`
Expected: FAIL — `addFoodVariant`/`deleteFoodVariant` don't exist; `createFood`/`createLogEntry` still use the old shape.

- [ ] **Step 3: Update `client/src/lib/nutritionApi.ts`**

Replace `export interface FoodLogEntry extends ... { food_id: number | null; ... }` — change `food_id` to `variant_id`.

Replace `export interface LogEntryInput extends ... { food_id?: number | null; ... }` — change `food_id` to `variant_id`.

Update `entryToLogInput` — change `food_id: entry.food_id ?? undefined` / `name: entry.food_id == null ? entry.name : undefined` to `variant_id: entry.variant_id ?? undefined` / `name: entry.variant_id == null ? entry.name : undefined`.

Replace `export interface Food extends ... { id: number; source: string; name: string; brand: string | null; default_qty: number; default_unit: string; calories: ...; }` with:

```ts
export interface FoodVariant extends WidenedNutrients, DescriptiveNutrients {
  id: number
  food_id: number
  label: string
  serving_qty: number
  serving_unit: string
  gram_weight: number | null
  is_default: number
  source: string
  calories: number | null
  protein_g: number | null
  carbs_g: number | null
  fat_g: number | null
  fiber_g: number | null
}

export interface Food {
  id: number
  source: string
  name: string
  brand: string | null
  variants: FoodVariant[]
}
```

Replace `export async function createFood(input: ...)`:

```ts
export interface VariantInput extends WidenedNutrients, DescriptiveNutrients {
  label: string
  serving_qty: number
  serving_unit: string
  gram_weight?: number | null
  calories?: number
  protein_g?: number
  carbs_g?: number
  fat_g?: number
  fiber_g?: number
}

export async function createFood(input: { name: string; brand?: string; variant: VariantInput }): Promise<Food> {
  const res = await fetch('/api/nutrition/foods', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) throw new Error(await parseErrorMessage(res, 'Could not save food'))
  return res.json()
}

export async function addFoodVariant(foodId: number, input: VariantInput): Promise<FoodVariant> {
  const res = await fetch(`/api/nutrition/foods/${foodId}/variants`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) throw new Error(await parseErrorMessage(res, 'Could not add variant'))
  return res.json()
}

export async function deleteFoodVariant(id: number): Promise<void> {
  const res = await fetch(`/api/nutrition/food_variants/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(await parseErrorMessage(res, 'Could not delete variant'))
}
```

In `RecipeIngredientInput`, change `food_id?: number` to `variant_id?: number`. In `RecipeDetail`'s `ingredients: RecipeIngredientInput[]`, no change needed (inherits the rename). In `Recipe`, `food_id: number` stays as-is (that's the recipe's own materialized food, unrelated to ingredient linking).

Update `lookupFoodByBarcode`'s return type from `Promise<Food | null>` — unchanged signature, but `Food` itself now carries `variants` per the type change above, so no code change needed there beyond the type already updating.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run --config vitest.client.config.ts tests/client/lib/nutritionApi.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: Errors remain in `LogEntrySheet.tsx`, `EditEntrySheet.tsx`, `NutritionLibrary.tsx` (Tasks 10–13 fix those) — confirm no errors in `nutritionApi.ts` itself.

- [ ] **Step 6: Commit**

```bash
git add client/src/lib/nutritionApi.ts tests/client/lib/nutritionApi.test.ts
git commit -m "feat: client nutritionApi types/functions for food_variants (variant_id, addFoodVariant, deleteFoodVariant)"
```

---

### Task 10: Frontend — `LogEntrySheet` variant selection

**Files:**
- Modify: `client/src/pages/nutrition/LogEntrySheet.tsx`
- Modify: `tests/client/pages/nutrition/LogEntrySheet.test.tsx`

**Interfaces:**
- Consumes: `Food`, `FoodVariant`, `createLogEntry` (with `variant_id`) from Task 9.
- Produces: no new exports — this is a leaf UI component.

- [ ] **Step 1: Write the failing tests**

Read the current `tests/client/pages/nutrition/LogEntrySheet.test.tsx` in full first (existing mocking pattern for `searchFoods`/`createLogEntry`). Update the mock `Food` fixtures used throughout the file to the new nested-variant shape (search for wherever the file currently mocks a `Food` object with `default_qty`/`default_unit`/`calories` directly on it, and change to `{ id, name, variants: [{ id, label, serving_qty, serving_unit, is_default: 1, calories, protein_g, carbs_g, fat_g }] }`). Add:

```ts
it('shows a variant dropdown after picking a search result, defaulting to the is_default variant', async () => {
  const food = { id: 1, name: 'Test Bread', variants: [
    { id: 10, label: '100 g', serving_qty: 100, serving_unit: 'g', is_default: 1, calories: 265, protein_g: 9 },
    { id: 11, label: '1 slice', serving_qty: 1, serving_unit: 'slice', is_default: 0, calories: 80, protein_g: 3 },
  ] }
  const { searchFoods } = await import('../../../../client/src/lib/nutritionApi')
  ;(searchFoods as ReturnType<typeof vi.fn>).mockResolvedValue([food])
  const user = userEvent.setup()
  render(<LogEntrySheet open date="2026-07-20" meal="breakfast" onClose={vi.fn()} onLogged={vi.fn()} />)
  await user.type(screen.getByPlaceholderText('Search saved foods…'), 'bread')
  await user.click(await screen.findByText('Test Bread'))

  const select = screen.getByLabelText('Serving') as HTMLSelectElement
  expect(select.value).toBe('10') // defaults to the is_default variant's id
  expect(screen.getByText('1 slice')).toBeInTheDocument() // the other option is present
})

it('submits with variant_id + quantity (count of servings), switching variant_id when a different serving is picked', async () => {
  const food = { id: 1, name: 'Test Bread', variants: [
    { id: 10, label: '100 g', serving_qty: 100, serving_unit: 'g', is_default: 1, calories: 265 },
    { id: 11, label: '1 slice', serving_qty: 1, serving_unit: 'slice', is_default: 0, calories: 80 },
  ] }
  const { searchFoods, createLogEntry } = await import('../../../../client/src/lib/nutritionApi')
  ;(searchFoods as ReturnType<typeof vi.fn>).mockResolvedValue([food])
  ;(createLogEntry as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 1 })
  const user = userEvent.setup()
  render(<LogEntrySheet open date="2026-07-20" meal="breakfast" onClose={vi.fn()} onLogged={vi.fn()} />)
  await user.type(screen.getByPlaceholderText('Search saved foods…'), 'bread')
  await user.click(await screen.findByText('Test Bread'))
  await user.selectOptions(screen.getByLabelText('Serving'), '11')
  await user.clear(screen.getByLabelText('Quantity'))
  await user.type(screen.getByLabelText('Quantity'), '2')
  await user.click(screen.getByRole('button', { name: 'LOG ENTRY' }))

  expect(createLogEntry).toHaveBeenCalledWith(expect.objectContaining({ variant_id: 11, quantity: 2 }))
})
```

Also update the existing "recomputes quantity from a macro goal" test — `qtyForGoal` now needs to operate against the *selected variant's* macros, not `food.default_qty`/`food[macroKey]` directly; adjust its fixture and expected math to route through the default variant's `calories`/`protein_g`/etc.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run --config vitest.client.config.ts tests/client/pages/nutrition/LogEntrySheet.test.tsx`
Expected: FAIL — no `Serving` label exists yet; `createLogEntry` still called with `food_id`.

- [ ] **Step 3: Update `LogEntrySheet.tsx`**

Replace `scaledPreview` and `qtyForGoal` (which currently take a `Food` and use `food.default_qty`/`food.default_unit`/`food[macroKey]`) to instead take a `FoodVariant`:

```ts
function scaledPreview(variant: FoodVariant, qty: number) {
  const round2 = (v: number | null) => v == null ? null : Math.round(v * qty * 100) / 100
  return {
    calories: variant.calories == null ? null : Math.round(variant.calories * qty),
    protein_g: round2(variant.protein_g),
    carbs_g: round2(variant.carbs_g),
    fat_g: round2(variant.fat_g),
  }
}

function qtyForGoal(variant: FoodVariant, macroKey: 'calories' | 'protein_g' | 'carbs_g' | 'fat_g', goal: number): number | null {
  const perServing = variant[macroKey]
  if (perServing == null || perServing === 0) return null
  return Math.round((goal / perServing) * 100) / 100
}
```

Update the import line to bring in `FoodVariant`:
```ts
import { createLogEntry, searchFoods, fetchRecentEntries, entryToLogInput, lookupFoodByBarcode, estimateMealFromPhoto, type Food, type FoodVariant, type FoodLogEntry } from '../../lib/nutritionApi'
```

Add a `selectedVariant` piece of state, initialized from the food's `is_default` variant when a food is selected. In the component body, replace:
```ts
  const [selectedFood, setSelectedFood] = useState<Food | null>(null)
```
with:
```ts
  const [selectedFood, setSelectedFood] = useState<Food | null>(null)
  const [selectedVariantId, setSelectedVariantId] = useState<number | null>(null)
  const selectedVariant = selectedFood?.variants.find(v => v.id === selectedVariantId) ?? null
```

Everywhere `setSelectedFood(f)` is called after picking a search result or barcode match, also set the default variant. Replace:
```ts
                <button key={f.id} onClick={() => { setSelectedFood(f); setQuery('') }} style={{
```
with:
```ts
                <button key={f.id} onClick={() => {
                  setSelectedFood(f)
                  setSelectedVariantId(f.variants.find(v => v.is_default)?.id ?? f.variants[0]?.id ?? null)
                  setQuery('')
                }} style={{
```

And in `handleBarcodeFile`, replace `setSelectedFood(food)` with the same pattern:
```ts
      setSelectedFood(food)
      setSelectedVariantId(food.variants.find(v => v.is_default)?.id ?? food.variants[0]?.id ?? null)
```

Everywhere `setSelectedFood(null)` is called to clear (the ✕ button, `reset()`, `handleMealPhotoFile`), also clear `setSelectedVariantId(null)`.

Replace the selected-food display block's quantity/unit row:
```ts
              <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                <input aria-label="Quantity" value={qty} onChange={e => setQty(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
                <span style={{ ...inputStyle, flex: 1, display: 'flex', alignItems: 'center', gap: 6, color: A, borderColor: hexA(A, 0.4) }}>
                  🔒 <span style={{ fontFamily: FONT_MONO }}>{selectedFood.default_unit}</span> <span style={{ fontSize: 8, color: COLORS.textMuted, fontFamily: FONT_MONO }}>LOCKED</span>
                </span>
              </div>
```
with:
```ts
              <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                <input aria-label="Quantity" value={qty} onChange={e => setQty(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
                <select aria-label="Serving" value={selectedVariantId ?? ''} onChange={e => setSelectedVariantId(Number(e.target.value))}
                  style={{ ...inputStyle, flex: 1 }}>
                  {selectedFood.variants.map(v => <option key={v.id} value={v.id}>{v.label}</option>)}
                </select>
              </div>
```

Replace the preview block's `scaledPreview(selectedFood, Number(qty))` call with `selectedVariant && scaledPreview(selectedVariant, Number(qty))`, guarding for `selectedVariant` being non-null:
```ts
              {qty !== '' && selectedVariant && (() => {
                const preview = scaledPreview(selectedVariant, Number(qty))
```

Replace the goal-macro `useEffect` and its `qtyForGoal` call to use `selectedVariant` instead of `selectedFood`:
```ts
  useEffect(() => {
    if (!selectedVariant || !goalMacro || goalValue === '') return
    const computed = qtyForGoal(selectedVariant, goalMacro, Number(goalValue))
    if (computed != null && !Number.isNaN(computed)) setQty(String(computed))
  }, [selectedVariant, goalMacro, goalValue])
```

Replace `handleSubmit`'s food-linked branch:
```ts
        await createLogEntry({ date, meal_type: meal, food_id: selectedFood.id, quantity: Number(qty), unit: selectedFood.default_unit })
```
with:
```ts
        if (!selectedVariant) { showToast('Pick a serving.', 'error'); setSubmitting(false); return }
        await createLogEntry({ date, meal_type: meal, variant_id: selectedVariant.id, quantity: Number(qty), unit: selectedVariant.serving_unit })
```

And the `setSelectedFood(null); setGoalMacro(null); setGoalValue('')` line right after — add `setSelectedVariantId(null)`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run --config vitest.client.config.ts tests/client/pages/nutrition/LogEntrySheet.test.tsx`
Expected: PASS.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: Errors remain in `EditEntrySheet.tsx`/`NutritionLibrary.tsx` (Tasks 11–13) — confirm none remain in `LogEntrySheet.tsx`.

- [ ] **Step 6: Commit**

```bash
git add client/src/pages/nutrition/LogEntrySheet.tsx tests/client/pages/nutrition/LogEntrySheet.test.tsx
git commit -m "feat: LogEntrySheet — variant dropdown replaces locked-unit chip, quantity means count of servings"
```

---

### Task 11: Frontend — `EditEntrySheet` variant selection and switching

**Files:**
- Modify: `client/src/pages/nutrition/EditEntrySheet.tsx`
- Modify: `tests/client/pages/nutrition/EditEntrySheet.test.tsx`

**Interfaces:**
- Consumes: `FoodLogEntry` (now with `variant_id`), `updateLogEntry`, `Food`/`FoodVariant`, `searchFoods` (Task 9) — this sheet needs to fetch the linked food's variant list to populate the dropdown, since `FoodLogEntry` itself only carries the denormalized macro snapshot, not the full variant list.
- Produces: no new exports.

- [ ] **Step 1: Write the failing tests**

Read the current `tests/client/pages/nutrition/EditEntrySheet.test.tsx` in full first. The sheet needs a way to fetch the current food's variants when editing a linked entry — add a `fetchFoodVariants(foodId: number): Promise<FoodVariant[]>` helper to `nutritionApi.ts` in this task (not Task 9, since it's specific to this sheet's needs — YAGNI, don't add it speculatively earlier):

Add to `tests/client/lib/nutritionApi.test.ts`:
```ts
it('fetchFoodVariants GETs /foods/:id/variants', async () => {
  const mockFetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ variants: [{ id: 1, label: '100 g' }] }) })
  vi.stubGlobal('fetch', mockFetch)
  const { fetchFoodVariants } = await import('../../../client/src/lib/nutritionApi')
  const variants = await fetchFoodVariants(1)
  expect(mockFetch).toHaveBeenCalledWith('/api/nutrition/foods/1/variants')
  expect(variants).toEqual([{ id: 1, label: '100 g' }])
})
```

Add to `tests/client/pages/nutrition/EditEntrySheet.test.tsx`:
```ts
it('shows a variant dropdown for a linked entry, fetched from the food\'s variant list', async () => {
  const { fetchFoodVariants } = await import('../../../../client/src/lib/nutritionApi')
  ;(fetchFoodVariants as ReturnType<typeof vi.fn>).mockResolvedValue([
    { id: 10, label: '100 g', serving_qty: 100, serving_unit: 'g', is_default: 1, calories: 389, protein_g: 13.2, carbs_g: 66.3, fat_g: 6.9, fiber_g: 10.6 },
    { id: 11, label: '1 cup', serving_qty: 1, serving_unit: 'cup', is_default: 0, calories: 300, protein_g: 10, carbs_g: 50, fat_g: 5, fiber_g: 8 },
  ])
  render(<EditEntrySheet open entry={linkedEntry} date="2026-07-20" onClose={vi.fn()} onSaved={vi.fn()} />)
  expect(await screen.findByLabelText('Serving')).toBeInTheDocument()
  expect(await screen.findByText('1 cup')).toBeInTheDocument()
})

it('switching to a different variant sends the new variant_id on save', async () => {
  const { fetchFoodVariants } = await import('../../../../client/src/lib/nutritionApi')
  ;(fetchFoodVariants as ReturnType<typeof vi.fn>).mockResolvedValue([
    { id: 10, label: '100 g', serving_qty: 100, serving_unit: 'g', is_default: 1, calories: 389, protein_g: null, carbs_g: null, fat_g: null, fiber_g: null },
    { id: 11, label: '1 cup', serving_qty: 1, serving_unit: 'cup', is_default: 0, calories: 300, protein_g: null, carbs_g: null, fat_g: null, fiber_g: null },
  ])
  const user = userEvent.setup()
  render(<EditEntrySheet open entry={linkedEntry} date="2026-07-20" onClose={vi.fn()} onSaved={vi.fn()} />)
  await screen.findByLabelText('Serving')
  await user.selectOptions(screen.getByLabelText('Serving'), '11')
  await user.click(screen.getByText('SAVE CHANGES'))
  await waitFor(() => expect(mockUpdate).toHaveBeenCalledWith(7, expect.objectContaining({ variant_id: 11 })))
})
```

Update `linkedEntry`'s fixture at the top of the file: change `food_id: 3` to `variant_id: 3`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run --config vitest.client.config.ts tests/client/lib/nutritionApi.test.ts tests/client/pages/nutrition/EditEntrySheet.test.tsx`
Expected: FAIL — `fetchFoodVariants` doesn't exist; no `Serving` label rendered.

- [ ] **Step 3: Add `fetchFoodVariants` to `client/src/lib/nutritionApi.ts`**

```ts
export async function fetchFoodVariants(foodId: number): Promise<FoodVariant[]> {
  const res = await fetch(`/api/nutrition/foods/${foodId}/variants`)
  if (!res.ok) return []
  const data = await res.json() as { variants: FoodVariant[] } | FoodVariant[]
  return Array.isArray(data) ? data : data.variants
}
```

Note: this reuses `GET /api/nutrition/foods/:id/variants` — **this route does not exist yet**. Add it to `server/api/nutrition.ts` as part of this step (a small addition, not deferred to a later task since this frontend task directly depends on it):

```ts
// GET /api/nutrition/foods/:id/variants — a food's variant list, for the Edit Entry
// sheet's "switch serving" dropdown (it only has the linked variant's id, not the food's
// full list of servings).
nutritionRouter.get('/foods/:id/variants', (req, res) => {
  const { id } = req.params
  const food = db.prepare('SELECT id FROM foods WHERE id = ?').get(id)
  if (!food) {
    res.status(404).json({ error: 'Food not found' })
    return
  }
  const variants = db.prepare('SELECT * FROM food_variants WHERE food_id = ? ORDER BY is_default DESC, id').all(id)
  res.json({ variants })
})
```

Add a corresponding server test to `tests/server/nutrition.test.ts`:
```ts
it('GET /foods/:id/variants returns a food\'s variant list', async () => {
  const { foodId } = await seedFoodWithVariant()
  const { app } = await import('../../server/index')
  const res = await request(app).get(`/api/nutrition/foods/${foodId}/variants`)
  expect(res.status).toBe(200)
  expect(res.body.variants).toHaveLength(1)
})
```

- [ ] **Step 4: Update `EditEntrySheet.tsx`**

Update the import line:
```ts
import { updateLogEntry, deleteLogEntry, createLogEntry, entryToLogInput, fetchFoodVariants, type FoodLogEntry, type FoodVariant, type LogEntryInput } from '../../lib/nutritionApi'
```

Add variant-list state and a fetch effect, and a `selectedVariantId` state initialized from the entry:

```ts
  const [variants, setVariants] = useState<FoodVariant[]>([])
  const [selectedVariantId, setSelectedVariantId] = useState<number | null>(null)
```

`fetchFoodVariants` takes a `foodId`, but `FoodLogEntry` only carries `variant_id` — a variant id and a food id are different id spaces, so this sheet needs the entry's underlying `food_id` too, not just `variant_id`. Step 5 below adds a `food_id` (distinct from `variant_id`) to `GET /log`/`GET /log/recent`'s response via a join on `food_variants`, and the matching field to the client `FoodLogEntry` type — do Step 5 before this step's fetch effect will typecheck.

In the existing `useEffect(() => { if (entry) {...} }, [entry])`, add variant-fetching for a linked entry:
```ts
  useEffect(() => {
    if (entry) {
      setDisplayEntry(entry)
      setQty(String(entry.quantity))
      setUnit(entry.unit)
      setSelectedVariantId(entry.variant_id)
      setMacros({ /* unchanged */
        calories: entry.calories == null ? '' : String(entry.calories),
        protein_g: entry.protein_g == null ? '' : String(entry.protein_g),
        carbs_g: entry.carbs_g == null ? '' : String(entry.carbs_g),
        fat_g: entry.fat_g == null ? '' : String(entry.fat_g),
        fiber_g: entry.fiber_g == null ? '' : String(entry.fiber_g),
      })
      setExtended(payloadToExtendedNutrients(entry))
      if (entry.variant_id != null && entry.food_id != null) {
        fetchFoodVariants(entry.food_id).then(setVariants)
      } else {
        setVariants([])
      }
    }
  }, [entry])
```

Replace the quantity/unit row:
```ts
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <input aria-label="Quantity" value={qty} onChange={e => setQty(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
            {isLinked ? (
              <span style={{ ...inputStyle, flex: 1, display: 'flex', alignItems: 'center', gap: 6, color: A, borderColor: hexA(A, 0.4) }}>
                🔒 {unit} <span style={{ fontSize: 8, color: COLORS.textMuted }}>LOCKED</span>
              </span>
            ) : (
              <input aria-label="Unit" value={unit} onChange={e => setUnit(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
            )}
          </div>
```
with:
```ts
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <input aria-label="Quantity" value={qty} onChange={e => setQty(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
            {isLinked ? (
              <select aria-label="Serving" value={selectedVariantId ?? ''} onChange={e => setSelectedVariantId(Number(e.target.value))} style={{ ...inputStyle, flex: 1 }}>
                {variants.map(v => <option key={v.id} value={v.id}>{v.label}</option>)}
              </select>
            ) : (
              <input aria-label="Unit" value={unit} onChange={e => setUnit(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
            )}
          </div>
```

Update `handleSave` to include `variant_id` in `updates` when it changed:
```ts
      const updates: Partial<LogEntryInput> = {}
      if (Number(qty) !== currentEntry.quantity) updates.quantity = Number(qty)
      if (isLinked && selectedVariantId !== currentEntry.variant_id) updates.variant_id = selectedVariantId
      if (!isLinked && unit !== currentEntry.unit) updates.unit = unit
```

The copy notice text ("TO CHANGE THE FOOD ITSELF, DELETE AND RE-LOG") stays accurate — switching *variant* is now allowed inline, but switching to a different *food* still requires delete + re-log; update the copy string to reflect this distinction:
```ts
              ? 'LINKED TO A SAVED FOOD — PICK A DIFFERENT SERVING ABOVE, OR CHANGE QUANTITY (RESCALES EACH MACRO UNLESS YOU OVERRIDE IT BELOW) · TO CHANGE THE FOOD ITSELF, DELETE AND RE-LOG'
```

- [ ] **Step 5: Add `food_id` to the server's `GET /log`/`GET /log/recent` responses**

In `server/api/nutrition.ts`'s `GET /log` and `GET /log/recent` routes, change the `SELECT * FROM food_log_entries` queries to also join the variant's food id:
```ts
  const rows = db.prepare(
    'SELECT fle.*, fv.food_id as food_id FROM food_log_entries fle LEFT JOIN food_variants fv ON fv.id = fle.variant_id WHERE fle.date = ? ORDER BY fle.logged_at'
  ).all(date) as ...
```
(apply the same `LEFT JOIN food_variants fv ON fv.id = fle.variant_id` pattern to `GET /log/recent`'s query too). Add `food_id: number | null` to `FoodLogEntry` in `client/src/lib/nutritionApi.ts` (Task 9's file, touched again here).

Update the corresponding server tests (`GET /log`, `GET /log/recent` in `tests/server/nutrition.test.ts`) to assert `food_id` is present on returned rows, and re-run:
```bash
npx vitest run --config vitest.config.ts tests/server/nutrition.test.ts
```

- [ ] **Step 6: Run client tests to verify they pass**

Run: `npx vitest run --config vitest.client.config.ts tests/client/lib/nutritionApi.test.ts tests/client/pages/nutrition/EditEntrySheet.test.tsx`
Expected: PASS.

- [ ] **Step 7: Run full suite and typecheck**

Run: `npm test && npx tsc --noEmit && npx tsc -p tsconfig.server.json --noEmit`
Expected: Only `NutritionLibrary.tsx`/its tests still fail (Tasks 12–13).

- [ ] **Step 8: Commit**

```bash
git add server/api/nutrition.ts client/src/lib/nutritionApi.ts client/src/pages/nutrition/EditEntrySheet.tsx tests/server/nutrition.test.ts tests/client/lib/nutritionApi.test.ts tests/client/pages/nutrition/EditEntrySheet.test.tsx
git commit -m "feat: EditEntrySheet — variant dropdown lets a linked entry switch servings inline"
```

---

### Task 12: Frontend — `NutritionLibrary` new-food/add-variant flows

**Files:**
- Modify: `client/src/pages/nutrition/NutritionLibrary.tsx`
- Modify: `tests/client/pages/nutrition/NutritionLibrary.test.tsx`

**Interfaces:**
- Consumes: `Food`, `FoodVariant`, `createFood`, `addFoodVariant`, `deleteFoodVariant` (Task 9).
- Produces: no new exports.

- [ ] **Step 1: Write the failing tests**

Read the current test file in full first (its `Food`/`Recipe` fixtures). Update the `oats` fixture from the flat shape to the nested-variant shape:
```ts
const oats = { id: 1, source: 'custom', name: 'Test Oats', brand: null, variants: [
  { id: 100, food_id: 1, label: '100 g', serving_qty: 100, serving_unit: 'g', is_default: 1, source: 'custom', calories: 389, protein_g: 16.9, carbs_g: 66.3, fat_g: 6.9, fiber_g: 10.6 },
] }
```
Update every existing assertion that reads `f.default_qty`/`f.default_unit`/`f.calories` directly to instead read `f.variants[0].calories` etc. (search the file for `default_qty`, `default_unit`, and direct `.calories` reads on a food fixture).

Add:
```ts
it('NewFoodForm submits a single default variant', async () => {
  mockCreateFood.mockResolvedValue({ id: 5, name: 'Greek Yogurt', variants: [{ id: 50, label: '170 g', is_default: 1 }] })
  const user = userEvent.setup()
  render(<NutritionLibrary />)
  await screen.findByText('Test Oats')
  await user.click(screen.getByText('+ NEW FOOD'))
  await user.type(screen.getByLabelText('Food name'), 'Greek Yogurt')
  await user.type(screen.getByLabelText('Default quantity'), '170')
  await user.type(screen.getByLabelText('Default unit'), 'g')
  await user.click(screen.getByText('SAVE FOOD — SEARCHABLE IMMEDIATELY'))
  await waitFor(() => expect(mockCreateFood).toHaveBeenCalledWith(expect.objectContaining({
    name: 'Greek Yogurt', variant: expect.objectContaining({ label: '170 g', serving_qty: 170, serving_unit: 'g' }),
  })))
})

it('food list shows the default variant\'s macros', async () => {
  render(<NutritionLibrary />)
  expect(await screen.findByText(/per 100 g · 389 kcal/)).toBeInTheDocument()
})

it('+ ADD SERVING adds another variant to an existing food', async () => {
  mockAddFoodVariant.mockResolvedValue({ id: 101, label: '1 cup', is_default: 0 })
  const user = userEvent.setup()
  render(<NutritionLibrary />)
  await screen.findByText('Test Oats')
  await user.click(screen.getByLabelText('Add serving to Test Oats'))
  await user.type(screen.getByLabelText('New serving label'), '1 cup')
  await user.type(screen.getByLabelText('New serving quantity'), '1')
  await user.type(screen.getByLabelText('New serving unit'), 'cup')
  await user.click(screen.getByText('SAVE SERVING'))
  await waitFor(() => expect(mockAddFoodVariant).toHaveBeenCalledWith(1, expect.objectContaining({ label: '1 cup', serving_qty: 1, serving_unit: 'cup' })))
})
```

Add `addFoodVariant`/`deleteFoodVariant` to the file's `vi.mock('../../../../client/src/lib/nutritionApi', ...)` block and their `mockAddFoodVariant`/`mockDeleteFoodVariant` const declarations, matching the file's existing pattern for `mockCreateFood` etc.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run --config vitest.client.config.ts tests/client/pages/nutrition/NutritionLibrary.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Update `NutritionLibrary.tsx` — `NewFoodForm`**

Replace `NewFoodForm`'s `handleSave`:
```ts
  async function handleSave() {
    if (!name || submitting) return
    if (!(Number(qty) > 0)) { showToast('Default quantity must be greater than 0.', 'error'); return }
    setSubmitting(true)
    try {
      const food = await createFood({
        name,
        variant: {
          label: `${qty} ${unit}`, serving_qty: Number(qty), serving_unit: unit,
          calories: macros.calories === '' ? undefined : Number(macros.calories),
          protein_g: macros.protein_g === '' ? undefined : Number(macros.protein_g),
          carbs_g: macros.carbs_g === '' ? undefined : Number(macros.carbs_g),
          fat_g: macros.fat_g === '' ? undefined : Number(macros.fat_g),
          fiber_g: macros.fiber_g === '' ? undefined : Number(macros.fiber_g),
          ...extendedNutrientsToPayload(extended),
        },
      })
      onDone(food)
    } catch (err) {
      showToast(errorMessage(err, 'Could not save food.'), 'error')
    } finally {
      setSubmitting(false)
    }
  }
```

- [ ] **Step 4: Add an "add serving" mini-form to the food list**

Add a new small component above `NutritionLibrary`:

```ts
function AddVariantForm({ food, onDone, onCancel }: { food: Food; onDone: (variant: FoodVariant) => void; onCancel: () => void }) {
  const { showToast } = useToast()
  const [label, setLabel] = useState('')
  const [qty, setQty] = useState('')
  const [unit, setUnit] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSave() {
    if (!(Number(qty) > 0) || !unit || submitting) { showToast('Quantity and unit are required.', 'error'); return }
    setSubmitting(true)
    try {
      const variant = await addFoodVariant(food.id, { label: label || `${qty} ${unit}`, serving_qty: Number(qty), serving_unit: unit })
      onDone(variant)
    } catch (err) {
      showToast(errorMessage(err, 'Could not add serving.'), 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.line}`, borderRadius: 6, padding: 10, marginBottom: 6 }}>
      <label htmlFor="new-variant-label" style={{ display: 'block', fontFamily: FONT_MONO, fontSize: 8, color: COLORS.textMuted, marginBottom: 3 }}>LABEL</label>
      <input id="new-variant-label" aria-label="New serving label" value={label} onChange={e => setLabel(e.target.value)} placeholder="e.g. 1 slice" style={{ ...inputStyle, marginBottom: 6 }} />
      <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
        <input aria-label="New serving quantity" value={qty} onChange={e => setQty(e.target.value)} placeholder="qty" style={inputStyle} />
        <input aria-label="New serving unit" value={unit} onChange={e => setUnit(e.target.value)} placeholder="unit" style={inputStyle} />
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <button onClick={onCancel} style={{ flex: 1, padding: '8px 0', borderRadius: 6, border: `1px solid ${COLORS.line}`, background: 'transparent', color: COLORS.textMuted, fontFamily: FONT_MONO, fontSize: 9, cursor: 'pointer' }}>CANCEL</button>
        <button onClick={handleSave} disabled={submitting} style={{ flex: 1, padding: '8px 0', borderRadius: 6, border: 'none', background: A, color: COLORS.base, fontFamily: FONT_MONO, fontSize: 9, fontWeight: 700, cursor: 'pointer' }}>SAVE SERVING</button>
      </div>
    </div>
  )
}
```

Import `addFoodVariant`, `type FoodVariant` in the top import line, and `useToast` (already imported).

In `NutritionLibrary`, add state to track which food's "add serving" form is open:
```ts
  const [addingVariantTo, setAddingVariantTo] = useState<number | null>(null)
```

Replace the food-list rendering block:
```ts
          {foods.map(f => (
            <div key={f.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: COLORS.surface, border: `1px solid ${COLORS.line}`, borderRadius: 6, padding: '8px 10px', marginBottom: 6 }}>
              <div>
                <div style={{ fontFamily: FONT_UI, fontSize: 13, color: COLORS.text }}>{f.name}</div>
                <div style={{ fontFamily: FONT_MONO, fontSize: 8.5, color: COLORS.textMuted }}>
                  per {f.default_qty} {f.default_unit} · {f.calories ?? '—'} kcal · P {f.protein_g ?? '—'} · C {f.carbs_g ?? '—'} · F {f.fat_g ?? '—'}
                </div>
              </div>
              <button aria-label={`Delete ${f.name}`} onClick={() => handleDeleteFood(f.id)} style={{ background: 'none', border: 'none', color: COLORS.red, cursor: 'pointer', fontSize: 14 }}>✕</button>
            </div>
          ))}
```
with:
```ts
          {foods.map(f => {
            const dv = f.variants.find(v => v.is_default) ?? f.variants[0]
            return (
              <div key={f.id} style={{ marginBottom: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: COLORS.surface, border: `1px solid ${COLORS.line}`, borderRadius: 6, padding: '8px 10px' }}>
                  <div>
                    <div style={{ fontFamily: FONT_UI, fontSize: 13, color: COLORS.text }}>{f.name}</div>
                    <div style={{ fontFamily: FONT_MONO, fontSize: 8.5, color: COLORS.textMuted }}>
                      per {dv?.label ?? '—'} · {dv?.calories ?? '—'} kcal · P {dv?.protein_g ?? '—'} · C {dv?.carbs_g ?? '—'} · F {dv?.fat_g ?? '—'}
                      {f.variants.length > 1 ? ` · ${f.variants.length} servings` : ''}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <button aria-label={`Add serving to ${f.name}`} onClick={() => setAddingVariantTo(id => id === f.id ? null : f.id)} style={{ background: 'none', border: 'none', color: A, cursor: 'pointer', fontSize: 12 }}>+</button>
                    <button aria-label={`Delete ${f.name}`} onClick={() => handleDeleteFood(f.id)} style={{ background: 'none', border: 'none', color: COLORS.red, cursor: 'pointer', fontSize: 14 }}>✕</button>
                  </div>
                </div>
                {addingVariantTo === f.id && (
                  <AddVariantForm food={f} onCancel={() => setAddingVariantTo(null)} onDone={() => {
                    setAddingVariantTo(null)
                    reload()
                  }} />
                )}
              </div>
            )
          })}
```

(Using `reload()` after adding a variant, rather than local-state splicing, since the new variant needs to be nested correctly under the right food and this is a rare-enough action that the extra round trip is fine — don't over-engineer this path relative to #146's create/delete optimization, which was about the *common* save path, not this occasional one.)

- [ ] **Step 5: Update `NewRecipeForm`'s `addFromFood`/`IngredientRow`**

`addFromFood` currently builds a snapshot from `food.default_qty`/`food.calories` etc. directly — change it to use the food's default variant:

```ts
  function addFromFood(food: Food) {
    const variant = food.variants.find(v => v.is_default) ?? food.variants[0]
    if (!variant) return
    const snapshot: MacroSnapshot = {
      quantity: variant.serving_qty, calories: variant.calories, protein_g: variant.protein_g,
      carbs_g: variant.carbs_g, fat_g: variant.fat_g, fiber_g: variant.fiber_g,
    }
    setIngredients(rows => [...rows, {
      food_id: variant.id, name: food.name, unit: variant.serving_unit, ...snapshot, baseline: snapshot,
    }])
    setQuery('')
  }
```

Note: `IngredientRow.food_id` should be renamed to `variant_id` throughout `NewRecipeForm` (it's actually holding a variant id now, per Task 7's API change) — rename `food_id` to `variant_id` in `IngredientRow`, `toIngredientRows`, `addFromFood` above, and the `handleSave` payload mapping (`food_id: i.food_id` → `variant_id: i.variant_id`), and every `isAdHoc = ing.food_id == null` check to `ing.variant_id == null`.

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run --config vitest.client.config.ts tests/client/pages/nutrition/NutritionLibrary.test.tsx`
Expected: PASS.

- [ ] **Step 7: Run full suite and typecheck**

Run: `npm test && npx tsc --noEmit && npx tsc -p tsconfig.server.json --noEmit`
Expected: All green.

- [ ] **Step 8: Commit**

```bash
git add client/src/pages/nutrition/NutritionLibrary.tsx tests/client/pages/nutrition/NutritionLibrary.test.tsx
git commit -m "feat: NutritionLibrary — new-food creates a single variant, + ADD SERVING adds more, recipe ingredients use variant_id"
```

---

### Task 13: Full-suite verification, live sanity check, Playwright walkthrough

**Files:** none changed — verification only.

**Interfaces:**
- Consumes: everything from Tasks 1–12.
- Produces: nothing — this is the plan's final gate.

- [ ] **Step 1: Full suite + typecheck**

```bash
npm test && npx tsc --noEmit && npx tsc -p tsconfig.server.json --noEmit
```
Expected: All tests pass, both typechecks clean.

- [ ] **Step 2: Rebuild the client and restart the service**

```bash
npm run build:client
sudo systemctl restart bacta-api
sleep 2
sudo systemctl status bacta-api --no-pager | tail -10
```
Expected: `active (running)`, `[db] migrations complete` (the `foods` migration block is now a no-op since it already ran in Task 4 — confirm the log does NOT print the "migrated to food_variants schema" line again, proving idempotency on the real DB).

- [ ] **Step 3: Confirm the live data survived Tasks 1–12's schema/API changes**

```sql
SELECT COUNT(*) as foods, (SELECT COUNT(*) FROM food_variants) as variants FROM foods;
```
Expected: `foods` = 8156, `variants` roughly matching the distribution measured in Task 4 — confirms nothing after Task 4 accidentally re-wiped or corrupted the real data (the migration's wipe-gate in Task 1 only fires once, keyed on `foods.default_qty` existing, which is already gone).

- [ ] **Step 4: Playwright live walkthrough**

1. `browser_navigate` to `http://localhost:3001/nutrition`.
2. Open the Log Entry sheet, search "oat", pick "Flour, oat, whole grain" — confirm the `Serving` dropdown shows "100 g" plus its real `foodPortions`-derived options (e.g. "2 tbsp", "1 cup" if that specific food has portions; if not, confirm at least "100 g" alone renders correctly).
3. Change quantity, confirm the auto-scale preview updates: `browser_take_screenshot`.
4. Submit, confirm the entry appears in the Overview's meal group with the correct scaled macros.
5. Open Edit Entry on that logged item, confirm the `Serving` dropdown is populated and pre-selected to the variant that was actually logged; switch to a different serving, save, confirm the entry updates.
6. Go to Library → + NEW FOOD, save a food, confirm it appears with its single variant's macros in the list; tap "+" to add a second serving, save, confirm the list now shows "N servings".
7. Build a recipe using a saved food as an ingredient, confirm quantity-edit-rescale still works (this was the bug fixed during the original PR #138 review — confirm it isn't regressed).
8. Check console: 0 errors throughout.
9. `browser_close`; `rm -rf /tmp/pw-*`.

- [ ] **Step 5: No commit** — verification only. If any step in this task surfaces a real bug, fix it in the relevant task's files, add a regression test, and commit there — do not accumulate fixes as an unstructured final patch.

---

## Self-Review Notes (for whoever executes this plan)

- **Spec coverage:** Every section of `docs/superpowers/specs/2026-07-15-nutrition-food-variants-design.md` maps to a task — schema (Task 1), import path (Tasks 2–4), API (Tasks 5–8), frontend (Tasks 9–12), verification (Task 13). The spec's explicit "last variant can't be deleted" rule is Task 5's `DELETE /food_variants/:id`. The spec's `PUT /api/nutrition/recipes/:id` gap (added by #150 after the spec was written) is covered in Task 7.
- **Known gap surfaced during planning, not the spec's fault:** Task 11 discovers mid-task that `FoodLogEntry` needs a `food_id` field (distinct from `variant_id`) for the Edit Entry sheet's variant-switcher to know which food's variant list to fetch — this wasn't anticipated in the spec (which didn't design the Edit Entry sheet's exact data-fetching mechanics) and is called out explicitly in Task 11's steps as a retroactive addition to Tasks 6 and 9, not silently patched over.
- **Out of scope, confirmed unchanged by this plan:** live multi-provider API integration, the Settings-page bulk-import upload affordance, barcode/photo logging (#141, already shipped and left working throughout — Task 5's barcode route is updated to the new nested shape but its behavior is otherwise untouched), arbitrary unit conversion.
