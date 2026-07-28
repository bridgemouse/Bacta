// Verified 2026-07-11 against USDA FDC's live /food/{fdcId} detail endpoint (which
// mirrors the bulk-download JSON schema, per FDC's own documentation) and Open Food
// Facts' live single-product API — not assumed from documentation prose. Two real
// discrepancies from the original import plan surfaced and are handled below:
//
// 1. USDA nutrient codes are NOT consistent across dataTypes. A real Foundation Foods
//    record (fdcId 2261421, "Flour, oat, whole grain") has NO "208" (classic Energy)
//    entry at all — only "957" (Atwater General Factors) and "958" (Atwater Specific
//    Factors) — and carries BOTH "291" (Fiber, total dietary) and "293" (Total dietary
//    fiber, AOAC 2011.25) simultaneously. A real SR Legacy record (fdcId 174988,
//    "Croissants, apple") uses only the classic "208"/"291" codes. The mapper below
//    tries each macro's codes in priority order and uses whichever is actually present.
// 2. Open Food Facts products can genuinely lack a nutrient key entirely (not just be
//    null) — a real fetch of Nutella's product record has no "fiber_100g" key at all.
//    Missing keys map to `null`, not 0 or a thrown error.

import { NUMERIC_NUTRIENT_KEYS, scaleNumericRow, type NumericRow } from './nutrientKeys'

interface UsdaFoodNutrient {
  nutrient: { number: string }
  amount: number
}

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

export interface OffProductRecord {
  code: string
  product_name?: string
  brands?: string
  nutriments?: Record<string, unknown>
  // Verified live 2026-07-19 against a real product record (barcode 3017620422003):
  // an array of tag strings, language-prefixed (e.g. "en:milk"). Can be entirely absent
  // (not just an empty array) when a product has no documented traces, same "missing key
  // vs. present-and-empty" ambiguity foodImportMapping already handles for nutriments.
  allergens_tags?: string[]
  traces_tags?: string[]
  // The single-product REST API (verified live) wraps the same document under a
  // "product" key alongside a "status" field. OFF's own docs describe the JSONL bulk
  // export as identical to their MongoDB dump, which is documented elsewhere as the
  // flat (unwrapped) document — inferred from docs, not independently verified live
  // against a real downloaded export. Accept either shape defensively either way.
  product?: {
    product_name?: string
    brands?: string
    nutriments?: Record<string, unknown>
    allergens_tags?: string[]
    traces_tags?: string[]
  }
}

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

// Priority-ordered nutrient-number candidates per macro. USDA's nutrient.number is a
// string classic code; a food record may carry more than one code for the same
// real-world quantity (see Foundation Foods energy/fiber note above) — first match wins.
const USDA_NUTRIENT_CODES = {
  calories: ['208', '957', '958'],
  protein_g: ['203'],
  carbs_g: ['205'],
  fat_g: ['204'],
  fiber_g: ['291', '293'],
} as const

// Widened nutrient set (#140) — verified live 2026-07-15 against real FDC records
// (fdcId 173944 "Bananas, raw", SR Legacy, and fdcId 2058595 "MARGARINE", Branded, for
// trans fat 605 which the banana record reports as an explicit 0.0 rather than omitting).
// USDA Foundation/SR Legacy data has no glycemic-index/allergen/traces concept — those
// three stay unmapped here and remain NULL for USDA-sourced rows.
const USDA_WIDENED_NUTRIENT_CODES = {
  sodium_mg: ['307'],
  sugar_g: ['269'],
  saturated_fat_g: ['606'],
  polyunsaturated_fat_g: ['646'],
  monounsaturated_fat_g: ['645'],
  trans_fat_g: ['605'],
  cholesterol_mg: ['601'],
  potassium_mg: ['306'],
  vitamin_a_mcg: ['320'],
  vitamin_c_mg: ['401'],
  calcium_mg: ['301'],
  iron_mg: ['303'],
} as const

function findUsdaAmount(nutrients: UsdaFoodNutrient[], codes: readonly string[]): number | null {
  for (const code of codes) {
    const match = nutrients.find(n => n.nutrient.number === code)
    if (match) return match.amount
  }
  return null
}

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

function numberOrNull(value: unknown): number | null {
  if (typeof value === 'number') return value
  // Some real OFF records carry a *_100g value as a numeric string rather than a
  // JSON number — parse rather than silently treating it the same as a missing key.
  if (typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value))) {
    return Number(value)
  }
  return null
}

// Strips OFF's language-tag prefix (e.g. "en:milk" -> "milk") and JSON-stringifies for
// storage, matching parseJsonField's convention elsewhere. An empty array (no allergens/
// traces documented) maps to null, same as an absent key -- both mean "nothing recorded",
// not "recorded as empty".
function tagListOrNull(tags: string[] | undefined): string | null {
  if (!tags || tags.length === 0) return null
  return JSON.stringify(tags.map(tag => tag.replace(/^[a-z]{2}:/, '')))
}

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
