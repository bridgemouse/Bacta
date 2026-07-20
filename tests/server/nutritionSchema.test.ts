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

  it("schema.sql's CREATE TABLE statements for foods/food_log_entries/nutrition_targets/recipe_ingredients already declare the widened nutrient columns (#162), not just migrate.ts's runtime ALTER TABLE loop", () => {
    const schemaSql = fs.readFileSync(path.join(__dirname, '../../server/db/schema.sql'), 'utf-8')
    for (const table of ['foods', 'food_log_entries', 'nutrition_targets', 'recipe_ingredients']) {
      const block = extractCreateTableBlock(schemaSql, table)
      for (const col of WIDENED_NUTRIENT_COLUMNS) {
        expect(block).toContain(col)
      }
    }
  })
})
