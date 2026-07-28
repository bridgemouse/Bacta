import { describe, it, expect, beforeAll } from 'vitest'
import fs from 'fs'
import path from 'path'

process.env.DB_PATH = ':memory:'

// Mirrors migrate.ts's NEW_NUTRIENT_COLUMNS list (#140) -- schema.sql should declare
// these directly rather than relying solely on the runtime ALTER TABLE loop, matching
// how health_activities' widened columns were folded back into schema.sql (#41).
const WIDENED_NUTRIENT_COLUMNS = [
  'sodium_mg', 'sugar_g', 'saturated_fat_g', 'polyunsaturated_fat_g',
  'monounsaturated_fat_g', 'trans_fat_g', 'cholesterol_mg', 'potassium_mg',
  'vitamin_a_mcg', 'vitamin_c_mg', 'calcium_mg', 'iron_mg',
  'glycemic_index', 'custom_nutrients', 'allergens', 'traces',
]

function extractCreateTableBlock(schemaSql: string, table: string): string {
  const match = schemaSql.match(new RegExp(`CREATE TABLE IF NOT EXISTS ${table} \\(([\\s\\S]*?)\\);`))
  if (!match) throw new Error(`CREATE TABLE ${table} not found in schema.sql`)
  return match[1]
}

function tableExists(db: import('better-sqlite3').Database, name: string): boolean {
  return !!db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name=?"
  ).get(name)
}

describe('Nutrition schema migration', () => {
  beforeAll(async () => {
    const { migrate } = await import('../../server/db/migrate')
    migrate()
  })

  it('creates foods, food_log_entries, nutrition_targets tables', async () => {
    const { default: db } = await import('../../server/db/client')
    expect(tableExists(db, 'foods')).toBe(true)
    expect(tableExists(db, 'food_log_entries')).toBe(true)
    expect(tableExists(db, 'nutrition_targets')).toBe(true)
  })

  it('drops the dead macrofactor_snapshots table', async () => {
    const { default: db } = await import('../../server/db/client')
    expect(tableExists(db, 'macrofactor_snapshots')).toBe(false)
  })

  it('running migrate() twice is a no-op (idempotent)', async () => {
    const { migrate } = await import('../../server/db/migrate')
    expect(() => migrate()).not.toThrow()
    const { default: db } = await import('../../server/db/client')
    expect(tableExists(db, 'foods')).toBe(true)
    expect(tableExists(db, 'macrofactor_snapshots')).toBe(false)
  })

  it('actually drops macrofactor_snapshots when it exists on an established DB (not just a no-op on a fresh one)', async () => {
    // schema.sql no longer creates this table at all, so the prior tests only ever
    // exercise the "table never existed" no-op path. Simulate the real production
    // case — an existing DB that still has the pre-nutrition table — by creating it
    // directly, then confirm migrate()'s DROP TABLE branch actually fires.
    const { default: db } = await import('../../server/db/client')
    db.exec('CREATE TABLE IF NOT EXISTS macrofactor_snapshots (id INTEGER PRIMARY KEY)')
    expect(tableExists(db, 'macrofactor_snapshots')).toBe(true)

    const { migrate } = await import('../../server/db/migrate')
    expect(() => migrate()).not.toThrow()
    expect(tableExists(db, 'macrofactor_snapshots')).toBe(false)
  })

  it("schema.sql's CREATE TABLE statements for food_log_entries/nutrition_targets/recipe_ingredients already declare the widened nutrient columns (#162), not just migrate.ts's runtime ALTER TABLE loop", () => {
    const schemaSql = fs.readFileSync(path.join(__dirname, '../../server/db/schema.sql'), 'utf-8')
    // Note: foods table is excluded here since it's been slimmed to identity-only columns
    // in the food_variants migration; nutrient columns now live on food_variants instead.
    for (const table of ['food_log_entries', 'nutrition_targets', 'recipe_ingredients']) {
      const block = extractCreateTableBlock(schemaSql, table)
      for (const col of WIDENED_NUTRIENT_COLUMNS) {
        expect(block).toContain(col)
      }
    }
  })

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

  it('migrating an established DB (old foods/food_log_entries/recipe_ingredients shape) to the variant schema is idempotent', async () => {
    // Simulate a pre-migration production DB: recreate the OLD shape of all three
    // affected tables (not just foods) directly, then confirm migrate() both transforms
    // them AND running it twice doesn't throw. Reverting food_log_entries/
    // recipe_ingredients too (not just foods) is what actually exercises the DROP COLUMN
    // food_id / ADD COLUMN variant_id path below — a version of this test that only
    // reverted foods would pass without ever touching that code path.
    const { default: db } = await import('../../server/db/client')
    db.exec('DROP TABLE IF EXISTS food_variants')
    db.exec('DROP TABLE foods')
    db.exec(`
      CREATE TABLE foods (
        id INTEGER PRIMARY KEY AUTOINCREMENT, source TEXT NOT NULL, source_id TEXT, name TEXT NOT NULL,
        brand TEXT, default_qty REAL NOT NULL DEFAULT 100, default_unit TEXT NOT NULL DEFAULT 'g',
        calories REAL, source_json TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `)
    db.exec('ALTER TABLE food_log_entries ADD COLUMN food_id INTEGER')
    db.exec('ALTER TABLE food_log_entries DROP COLUMN variant_id')
    db.exec('ALTER TABLE recipe_ingredients ADD COLUMN food_id INTEGER')
    db.exec('ALTER TABLE recipe_ingredients DROP COLUMN variant_id')

    const { migrate } = await import('../../server/db/migrate')
    expect(() => migrate()).not.toThrow()
    expect(() => migrate()).not.toThrow()

    const logCols = (db.prepare("SELECT name FROM pragma_table_info('food_log_entries')").all() as { name: string }[]).map(c => c.name)
    expect(logCols).toContain('variant_id')
    expect(logCols).not.toContain('food_id')
    const ingredientCols = (db.prepare("SELECT name FROM pragma_table_info('recipe_ingredients')").all() as { name: string }[]).map(c => c.name)
    expect(ingredientCols).toContain('variant_id')
    expect(ingredientCols).not.toContain('food_id')
    const foodsCols = (db.prepare("SELECT name FROM pragma_table_info('foods')").all() as { name: string }[]).map(c => c.name)
    expect(foodsCols).not.toContain('default_qty')
    expect(tableExists(db, 'food_variants')).toBe(true)
  })

  it('foods table must have ONLY identity columns, never nutrient columns (regression test for #162)', async () => {
    // After food_variants migration, foods should be strictly identity-only. This test
    // guards against the pre-existing NEW_NUTRIENT_COLUMNS loop re-adding them on
    // subsequent migrate() calls (when foods no longer exists in its original state).
    // See migrate.ts line 150: 'foods' must NOT be in that table list.
    const { default: db } = await import('../../server/db/client')
    const foodsCols = (db.prepare("SELECT name FROM pragma_table_info('foods')").all() as { name: string }[]).map(c => c.name)

    // foods MUST have exactly these 7 identity columns (no more, no less)
    const expectedCols = ['id', 'source', 'source_id', 'name', 'brand', 'source_json', 'created_at']
    expect(foodsCols.sort()).toEqual(expectedCols.sort())

    // foods MUST NOT have ANY of the 16 widened nutrient columns
    for (const col of WIDENED_NUTRIENT_COLUMNS) {
      expect(foodsCols).not.toContain(col)
    }
  })
})
