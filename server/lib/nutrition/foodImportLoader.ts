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
      ...Object.fromEntries(variantCols.map(k => [k, (variant as unknown as Record<string, unknown>)[k] ?? null])),
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
