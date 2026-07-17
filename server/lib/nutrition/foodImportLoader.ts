import fs from 'fs'
import db from '../../db/client'
import { mapUsdaFoodToRow, mapOffProductToRow, type FoodImportRow, type UsdaFoodRecord, type OffProductRecord } from './foodImportMapping'

// USDA's full bulk-download JSON top-level wrapper key was NOT verified against a real
// downloaded file (only the per-record shape was, via the live /food/{fdcId} API — see
// foodImportMapping.ts). USDA's combined "all data types" downloads are known to carry
// multiple array-valued keys side by side (e.g. FoundationFoods + SRLegacyFoods +
// BrandedFoods + SurveyFoods) — concatenating every array found, rather than returning
// just the first one, means the loader can't silently drop an entire category of food
// records just because it appears second in the file.
export function extractRecordsArray(parsed: unknown): unknown[] {
  if (Array.isArray(parsed)) return parsed
  if (parsed && typeof parsed === 'object') {
    const arrays = Object.values(parsed).filter((v): v is unknown[] => Array.isArray(v))
    if (arrays.length > 0) return arrays.flat()
  }
  throw new Error('Could not find a records array in the parsed JSON — unrecognized dump file shape')
}

const upsertFood = db.prepare(`
  INSERT INTO foods (
    source, source_id, name, brand, default_qty, default_unit,
    calories, protein_g, carbs_g, fat_g, fiber_g,
    sodium_mg, sugar_g, saturated_fat_g, polyunsaturated_fat_g, monounsaturated_fat_g,
    trans_fat_g, cholesterol_mg, potassium_mg, vitamin_a_mcg, vitamin_c_mg, calcium_mg, iron_mg,
    source_json
  )
  VALUES (
    @source, @source_id, @name, @brand, @default_qty, @default_unit,
    @calories, @protein_g, @carbs_g, @fat_g, @fiber_g,
    @sodium_mg, @sugar_g, @saturated_fat_g, @polyunsaturated_fat_g, @monounsaturated_fat_g,
    @trans_fat_g, @cholesterol_mg, @potassium_mg, @vitamin_a_mcg, @vitamin_c_mg, @calcium_mg, @iron_mg,
    @source_json
  )
  ON CONFLICT(source, source_id) DO UPDATE SET
    name                   = excluded.name,
    brand                  = excluded.brand,
    default_qty            = excluded.default_qty,
    default_unit           = excluded.default_unit,
    calories               = excluded.calories,
    protein_g              = excluded.protein_g,
    carbs_g                = excluded.carbs_g,
    fat_g                  = excluded.fat_g,
    fiber_g                = excluded.fiber_g,
    sodium_mg              = excluded.sodium_mg,
    sugar_g                = excluded.sugar_g,
    saturated_fat_g        = excluded.saturated_fat_g,
    polyunsaturated_fat_g  = excluded.polyunsaturated_fat_g,
    monounsaturated_fat_g  = excluded.monounsaturated_fat_g,
    trans_fat_g            = excluded.trans_fat_g,
    cholesterol_mg         = excluded.cholesterol_mg,
    potassium_mg           = excluded.potassium_mg,
    vitamin_a_mcg          = excluded.vitamin_a_mcg,
    vitamin_c_mg           = excluded.vitamin_c_mg,
    calcium_mg             = excluded.calcium_mg,
    iron_mg                = excluded.iron_mg,
    source_json            = excluded.source_json
`)

function writeRow(row: FoodImportRow): void {
  upsertFood.run(row)
}

// Reads a local USDA FoodData Central JSON dump file (Foundation Foods and/or SR
// Legacy — see NUTRITION_PLAN.md §1 for the recommended practical cutoff) and upserts
// every mappable record into `foods`. A record mapUsdaFoodToRow can't make sense of
// (e.g. missing foodNutrients) is skipped, not thrown — matching importOffDumpFile's
// skip-and-continue behavior, so one bad record in a real multi-thousand-record file
// doesn't lose the rest. Returns the number of records actually written.
//
// Wrapped in db.transaction() — matches the batching convention every other bulk-write
// path in this codebase uses (server/lib/integrations/*Processor.ts) rather than one
// autocommit per row, which would make a real multi-thousand-record file take far
// longer than necessary. It also makes the import atomic against genuine DB-level
// failures (e.g. a constraint violation): those still abort and roll back the whole
// run rather than leaving `foods` in a half-imported state with no way to detect it.
export function importUsdaDumpFile(filePath: string): number {
  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
  const records = extractRecordsArray(parsed) as UsdaFoodRecord[]
  let written = 0
  const writeAll = db.transaction((recs: UsdaFoodRecord[]) => {
    for (const record of recs) {
      const row = mapUsdaFoodToRow(record)
      if (!row) continue
      writeRow(row)
      written++
    }
  })
  writeAll(records)
  return written
}

// Reads a local Open Food Facts JSONL dump file (one JSON product document per line)
// and upserts every mappable record into `foods`. Records with no usable product name
// are skipped, not inserted. Returns the number of records actually written.
// Transactional for the same reason as importUsdaDumpFile above.
export function importOffDumpFile(filePath: string): number {
  const lines = fs.readFileSync(filePath, 'utf-8').split('\n').filter(line => line.trim().length > 0)
  let written = 0
  const writeAll = db.transaction((allLines: string[]) => {
    for (const line of allLines) {
      const record = JSON.parse(line) as OffProductRecord
      const row = mapOffProductToRow(record)
      if (!row) continue
      writeRow(row)
      written++
    }
  })
  writeAll(lines)
  return written
}
