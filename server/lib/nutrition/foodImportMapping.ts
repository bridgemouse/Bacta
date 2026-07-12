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

interface UsdaFoodNutrient {
  nutrient: { number: string }
  amount: number
}

export interface UsdaFoodRecord {
  fdcId: number
  description: string
  brandOwner?: string
  brandName?: string
  foodNutrients: UsdaFoodNutrient[]
}

export interface OffProductRecord {
  code: string
  product_name?: string
  brands?: string
  nutriments?: Record<string, unknown>
  // The single-product REST API wraps the same document under a "product" key
  // (alongside a "status" field) — the JSONL bulk export does not. Accept either.
  product?: {
    product_name?: string
    brands?: string
    nutriments?: Record<string, unknown>
  }
}

export interface FoodImportRow {
  source: 'usda' | 'openfoodfacts'
  source_id: string
  name: string
  brand: string | null
  default_qty: number
  default_unit: string
  calories: number | null
  protein_g: number | null
  carbs_g: number | null
  fat_g: number | null
  fiber_g: number | null
  source_json: string
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

function findUsdaAmount(nutrients: UsdaFoodNutrient[], codes: readonly string[]): number | null {
  for (const code of codes) {
    const match = nutrients.find(n => n.nutrient.number === code)
    if (match) return match.amount
  }
  return null
}

export function mapUsdaFoodToRow(record: UsdaFoodRecord): FoodImportRow {
  const nutrients = record.foodNutrients
  return {
    source: 'usda',
    source_id: String(record.fdcId),
    name: record.description,
    brand: record.brandOwner ?? record.brandName ?? null,
    default_qty: 100,
    default_unit: 'g',
    calories: findUsdaAmount(nutrients, USDA_NUTRIENT_CODES.calories),
    protein_g: findUsdaAmount(nutrients, USDA_NUTRIENT_CODES.protein_g),
    carbs_g: findUsdaAmount(nutrients, USDA_NUTRIENT_CODES.carbs_g),
    fat_g: findUsdaAmount(nutrients, USDA_NUTRIENT_CODES.fat_g),
    fiber_g: findUsdaAmount(nutrients, USDA_NUTRIENT_CODES.fiber_g),
    source_json: JSON.stringify(record),
  }
}

function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' ? value : null
}

export function mapOffProductToRow(record: OffProductRecord): FoodImportRow | null {
  // Unwrap the REST API's "product" nesting if present; otherwise treat the record
  // itself as the flat document (the shape the real JSONL bulk export uses).
  const doc = record.product ?? record
  const name = doc.product_name
  if (!name) return null

  const nutriments = doc.nutriments ?? {}
  return {
    source: 'openfoodfacts',
    source_id: record.code,
    name,
    brand: doc.brands ?? null,
    default_qty: 100,
    default_unit: 'g',
    calories: numberOrNull(nutriments['energy-kcal_100g']),
    protein_g: numberOrNull(nutriments['proteins_100g']),
    carbs_g: numberOrNull(nutriments['carbohydrates_100g']),
    fat_g: numberOrNull(nutriments['fat_100g']),
    fiber_g: numberOrNull(nutriments['fiber_100g']),
    source_json: JSON.stringify(record),
  }
}
