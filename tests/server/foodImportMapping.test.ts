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

  it('maps the widened nutrient set (#140) — sodium 307, sugar 269, saturated/mono/poly/trans fat 606/645/646/605, cholesterol 601, potassium 306, vitamin A (RAE) 320, vitamin C 401, calcium 301, iron 303 — verified live against a real SR Legacy record', async () => {
    const { mapUsdaFoodToRow } = await import('../../server/lib/nutrition/foodImportMapping')
    const record = loadFixture('usda-sr-legacy-banana-extended.json')
    const result = mapUsdaFoodToRow(record as any)

    expect(result!.food).toMatchObject({ source_id: '173944' })
    expect(result!.variants[0]).toMatchObject({
      sodium_mg: 1.0,
      sugar_g: 12.23,
      saturated_fat_g: 0.112,
      monounsaturated_fat_g: 0.032,
      polyunsaturated_fat_g: 0.073,
      trans_fat_g: 0.0,
      cholesterol_mg: 0.0,
      potassium_mg: 358.0,
      vitamin_a_mcg: 3.0,
      vitamin_c_mg: 8.7,
      calcium_mg: 5.0,
      iron_mg: 0.26,
    })
  })

  it('maps a record missing a widened-nutrient code to null for that field, not 0', async () => {
    const { mapUsdaFoodToRow } = await import('../../server/lib/nutrition/foodImportMapping')
    // The croissant fixture (used above) carries none of the widened codes.
    const record = loadFixture('usda-sr-legacy-croissant.json')
    const result = mapUsdaFoodToRow(record as any)
    expect(result!.variants[0].sodium_mg).toBeNull()
    expect(result!.variants[0].vitamin_a_mcg).toBeNull()
  })

  it('leaves all 4 descriptive fields null -- USDA Foundation/SR Legacy data has no glycemic-index/allergen/traces concept', async () => {
    const { mapUsdaFoodToRow } = await import('../../server/lib/nutrition/foodImportMapping')
    const record = loadFixture('usda-sr-legacy-banana-extended.json')
    const result = mapUsdaFoodToRow(record as any)
    expect(result!.variants[0].glycemic_index).toBeNull()
    expect(result!.variants[0].custom_nutrients).toBeNull()
    expect(result!.variants[0].allergens).toBeNull()
    expect(result!.variants[0].traces).toBeNull()
  })

  describe('does not warn when a macro was successfully mapped', () => {
    afterEach(() => { vi.restoreAllMocks() })

    it('does not warn when at least one macro was successfully mapped', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const { mapUsdaFoodToRow } = await import('../../server/lib/nutrition/foodImportMapping')
      mapUsdaFoodToRow(loadFixture('usda-sr-legacy-croissant.json') as any)
      expect(warnSpy).not.toHaveBeenCalled()
    })
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

  it('returns null for a record with no usable product name', async () => {
    const { mapOffProductToRow } = await import('../../server/lib/nutrition/foodImportMapping')
    expect(mapOffProductToRow({ code: '123', nutriments: {} } as any)).toBeNull()
  })

  it('returns null (does not throw) for a null/undefined record — a real OFF JSONL dump can contain a literal null line (#181)', async () => {
    const { mapOffProductToRow } = await import('../../server/lib/nutrition/foodImportMapping')
    expect(mapOffProductToRow(null as any)).toBeNull()
    expect(mapOffProductToRow(undefined as any)).toBeNull()
  })

  it('maps allergens_tags to the allergens field, stripping the language prefix, and leaves traces null when traces_tags is absent', async () => {
    const { mapOffProductToRow } = await import('../../server/lib/nutrition/foodImportMapping')
    const record = loadFixture('off-nutella.json')
    const result = mapOffProductToRow(record as any)

    expect(JSON.parse(result!.variants[0].allergens!)).toEqual(['milk', 'nuts', 'soybeans'])
    expect(result!.variants[0].traces).toBeNull()
  })

  it('maps traces_tags to the traces field the same way, and treats an empty allergens_tags array as null rather than an empty list', async () => {
    const { mapOffProductToRow } = await import('../../server/lib/nutrition/foodImportMapping')
    const result = mapOffProductToRow({
      code: '222', product_name: 'Trace Peanuts Product',
      nutriments: { 'energy-kcal_100g': 100 },
      allergens_tags: [],
      traces_tags: ['en:peanuts', 'en:tree-nuts'],
    } as any)

    expect(result!.variants[0].allergens).toBeNull()
    expect(JSON.parse(result!.variants[0].traces!)).toEqual(['peanuts', 'tree-nuts'])
  })

  it('leaves glycemic_index and custom_nutrients null -- OFF has no standard field for either', async () => {
    const { mapOffProductToRow } = await import('../../server/lib/nutrition/foodImportMapping')
    const record = loadFixture('off-nutella.json')
    const result = mapOffProductToRow(record as any)

    expect(result!.variants[0].glycemic_index).toBeNull()
    expect(result!.variants[0].custom_nutrients).toBeNull()
  })

  it('parses a nutriment value even when OFF returns it as a numeric string rather than a number', async () => {
    const { mapOffProductToRow } = await import('../../server/lib/nutrition/foodImportMapping')
    const result = mapOffProductToRow({
      code: '111', product_name: 'String-valued nutriments',
      nutriments: { 'energy-kcal_100g': '250', 'proteins_100g': '10.5' },
    } as any)
    expect(result!.variants[0]).toMatchObject({ calories: 250, protein_g: 10.5 })
  })

  it('also accepts the API-response shape (nested under "product") defensively', async () => {
    const { mapOffProductToRow } = await import('../../server/lib/nutrition/foodImportMapping')
    const record = loadFixture('off-api-nested-example.json')
    const result = mapOffProductToRow(record as any)

    expect(result!.food).toMatchObject({ source: 'openfoodfacts', source_id: '0016000275287', name: 'Cheerios' })
  })
})
