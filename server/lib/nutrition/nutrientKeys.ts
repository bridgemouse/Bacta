// Widened nutrient set (#140), single source of truth. Previously this list (and its
// descriptive-field counterpart) was hand-copied in 3 places -- server/api/nutrition.ts,
// server/lib/nutrition/foodImportLoader.ts's INSERT/UPDATE SQL, and server/lib/ai/tools.ts's
// MX-4 queryDb schema description -- meaning a future nutrient addition/removal only
// updated the first of the three unless someone remembered the other two by hand (#161).
//
// NUMERIC_NUTRIENT_KEYS covers every summable/scalable quantity (the original 5 macros
// plus the 12 new ones) — used everywhere a per-key loop already iterated the original 5,
// so scaling/totals/target-vs-actual logic stays mechanical instead of hand-duplicated per
// field. DESCRIPTIVE_NUTRIENT_KEYS are NOT summed or scaled — they describe the food
// itself (a "half" glycemic index or half an allergen list makes no sense), so they're
// only read/written on a single row, never aggregated.
export const NUMERIC_NUTRIENT_KEYS = [
  'calories', 'protein_g', 'carbs_g', 'fat_g', 'fiber_g',
  'sodium_mg', 'sugar_g', 'saturated_fat_g', 'polyunsaturated_fat_g', 'monounsaturated_fat_g',
  'trans_fat_g', 'cholesterol_mg', 'potassium_mg', 'vitamin_a_mcg', 'vitamin_c_mg',
  'calcium_mg', 'iron_mg',
] as const
export type NumericNutrientKey = typeof NUMERIC_NUTRIENT_KEYS[number]
export const JSON_NUTRIENT_KEYS = ['custom_nutrients', 'allergens', 'traces'] as const
export const DESCRIPTIVE_NUTRIENT_KEYS = ['glycemic_index', ...JSON_NUTRIENT_KEYS] as const
export type NumericRow = Partial<Record<NumericNutrientKey, number | null>>
