import fs from 'fs'
import db from '../../db/client'
import { mapUsdaFoodToRow, mapOffProductToRow, type FoodImportRow, type UsdaFoodRecord, type OffProductRecord } from './foodImportMapping'

// USDA's full bulk-download JSON top-level wrapper key was NOT verified against a real
// downloaded file (only the per-record shape was, via the live /food/{fdcId} API — see
// foodImportMapping.ts). This scans the parsed JSON for the first array wherever it is,
// so the loader works regardless of the real wrapper key name (e.g. "FoundationFoods").
export function extractRecordsArray(parsed: unknown): unknown[] {
  if (Array.isArray(parsed)) return parsed
  if (parsed && typeof parsed === 'object') {
    for (const value of Object.values(parsed)) {
      if (Array.isArray(value)) return value
    }
  }
  throw new Error('Could not find a records array in the parsed JSON — unrecognized dump file shape')
}

const upsertFood = db.prepare(`
  INSERT INTO foods (source, source_id, name, brand, default_qty, default_unit, calories, protein_g, carbs_g, fat_g, fiber_g, source_json)
  VALUES (@source, @source_id, @name, @brand, @default_qty, @default_unit, @calories, @protein_g, @carbs_g, @fat_g, @fiber_g, @source_json)
  ON CONFLICT(source, source_id) DO UPDATE SET
    name         = excluded.name,
    brand        = excluded.brand,
    default_qty  = excluded.default_qty,
    default_unit = excluded.default_unit,
    calories     = excluded.calories,
    protein_g    = excluded.protein_g,
    carbs_g      = excluded.carbs_g,
    fat_g        = excluded.fat_g,
    fiber_g      = excluded.fiber_g,
    source_json  = excluded.source_json
`)

function writeRow(row: FoodImportRow): void {
  upsertFood.run(row)
}

// Reads a local USDA FoodData Central JSON dump file (Foundation Foods and/or SR
// Legacy — see NUTRITION_PLAN.md §1 for the recommended practical cutoff) and upserts
// every record into `foods`. Returns the number of records processed.
export function importUsdaDumpFile(filePath: string): number {
  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
  const records = extractRecordsArray(parsed) as UsdaFoodRecord[]
  for (const record of records) {
    writeRow(mapUsdaFoodToRow(record))
  }
  return records.length
}

// Reads a local Open Food Facts JSONL dump file (one JSON product document per line)
// and upserts every mappable record into `foods`. Records with no usable product name
// are skipped, not inserted. Returns the number of records actually written.
export function importOffDumpFile(filePath: string): number {
  const lines = fs.readFileSync(filePath, 'utf-8').split('\n').filter(line => line.trim().length > 0)
  let written = 0
  for (const line of lines) {
    const record = JSON.parse(line) as OffProductRecord
    const row = mapOffProductToRow(record)
    if (!row) continue
    writeRow(row)
    written++
  }
  return written
}
