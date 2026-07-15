import { describe, it, expect, vi, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'

const FIXTURES = path.join(__dirname, 'fixtures/nutrition')
function loadFixture(name: string): unknown {
  return JSON.parse(fs.readFileSync(path.join(FIXTURES, name), 'utf-8'))
}

describe('mapUsdaFoodToRow', () => {
  it('maps a Foundation Foods record, preferring nutrient number 208 for energy and 291 for fiber, falling back when absent', async () => {
    const { mapUsdaFoodToRow } = await import('../../server/lib/nutrition/foodImportMapping')
    const record = loadFixture('usda-foundation-oat-flour.json')
    const row = mapUsdaFoodToRow(record as any)

    expect(row).toMatchObject({
      source: 'usda',
      source_id: '2261421',
      name: 'Flour, oat, whole grain',
      brand: null,
      default_qty: 100,
      default_unit: 'g',
      protein_g: 13.16875,
      carbs_g: 69.91725,
      fat_g: 6.309,
    })
    // This Foundation record has no "208" entry — only 957 (Atwater General) and 958
    // (Atwater Specific). The mapper prefers 957 over 958 when 208 is absent.
    expect(row!.calories).toBe(389.125)
    // This record has both 291 (Fiber, total dietary) and 293 (AOAC 2011.25) — the
    // mapper prefers 291, the classic/more universally-present code.
    expect(row!.fiber_g).toBe(10.5)
    expect(JSON.parse(row!.source_json)).toMatchObject({ fdcId: 2261421 })
  })

  it('returns null (does not throw) for a malformed record with no foodNutrients array, rather than crashing a whole bulk-import transaction over one bad record', async () => {
    const { mapUsdaFoodToRow } = await import('../../server/lib/nutrition/foodImportMapping')
    expect(mapUsdaFoodToRow({ fdcId: 999, description: 'Malformed' } as any)).toBeNull()
    expect(mapUsdaFoodToRow({ fdcId: 999, description: 'Malformed', foodNutrients: 'not-an-array' } as any)).toBeNull()
  })

  describe('unmapped nutrient codes (e.g. a Branded/Survey Foods record outside the verified Foundation+SR Legacy scope)', () => {
    afterEach(() => {
      vi.restoreAllMocks()
    })

    it('warns when none of the known nutrient codes matched any macro, rather than silently returning an all-null row', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const { mapUsdaFoodToRow } = await import('../../server/lib/nutrition/foodImportMapping')
      const row = mapUsdaFoodToRow({
        fdcId: 777,
        description: 'Unrecognized Data Type Food',
        foodNutrients: [
          { type: 'FoodNutrient', nutrient: { id: 9999, number: '9999', name: 'Some Unmapped Nutrient', unitName: 'g' }, amount: 1 },
        ],
      } as any)

      expect(row).toMatchObject({ calories: null, protein_g: null, carbs_g: null, fat_g: null })
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('777'))
    })

    it('does not warn when at least one macro was successfully mapped', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const { mapUsdaFoodToRow } = await import('../../server/lib/nutrition/foodImportMapping')
      mapUsdaFoodToRow(loadFixture('usda-sr-legacy-croissant.json') as any)
      expect(warnSpy).not.toHaveBeenCalled()
    })
  })

  it('maps an SR Legacy record using the classic nutrient codes (208 energy, 291 fiber) when they are the only ones present', async () => {
    const { mapUsdaFoodToRow } = await import('../../server/lib/nutrition/foodImportMapping')
    const record = loadFixture('usda-sr-legacy-croissant.json')
    const row = mapUsdaFoodToRow(record as any)

    expect(row).toMatchObject({
      source: 'usda',
      source_id: '174988',
      name: 'Croissants, apple',
      calories: 254,
      protein_g: 7.4,
      carbs_g: 37.1,
      fat_g: 8.7,
      fiber_g: 2.5,
    })
  })

  it('maps the widened nutrient set (#140) — sodium 307, sugar 269, saturated/mono/poly/trans fat 606/645/646/605, cholesterol 601, potassium 306, vitamin A (RAE) 320, vitamin C 401, calcium 301, iron 303 — verified live against a real SR Legacy record', async () => {
    const { mapUsdaFoodToRow } = await import('../../server/lib/nutrition/foodImportMapping')
    const record = loadFixture('usda-sr-legacy-banana-extended.json')
    const row = mapUsdaFoodToRow(record as any)

    expect(row).toMatchObject({
      source_id: '173944',
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
    // The original croissant fixture (used above) carries none of the widened codes.
    const record = loadFixture('usda-sr-legacy-croissant.json')
    const row = mapUsdaFoodToRow(record as any)
    expect(row!.sodium_mg).toBeNull()
    expect(row!.vitamin_a_mcg).toBeNull()
  })
})

describe('mapOffProductToRow', () => {
  it('maps a flat (JSONL bulk-export-shaped) product record with fiber present', async () => {
    const { mapOffProductToRow } = await import('../../server/lib/nutrition/foodImportMapping')
    const record = loadFixture('off-cheerios.json')
    const row = mapOffProductToRow(record as any)

    expect(row).toMatchObject({
      source: 'openfoodfacts',
      source_id: '0016000275287',
      name: 'Cheerios',
      brand: 'Cheerios',
      default_qty: 100,
      default_unit: 'g',
      calories: 358.97,
      protein_g: 12.82,
      carbs_g: 74.36,
      fat_g: 6.41,
      fiber_g: 10.2564102564103,
    })
  })

  it('maps a product with no fiber_100g key at all to fiber_g: null, not 0 or an error', async () => {
    const { mapOffProductToRow } = await import('../../server/lib/nutrition/foodImportMapping')
    const record = loadFixture('off-nutella.json')
    const row = mapOffProductToRow(record as any)

    expect(row).toMatchObject({
      source: 'openfoodfacts',
      source_id: '3017620422003',
      name: 'Nutella t.400',
      calories: 539,
    })
    expect(row!.fiber_g).toBeNull()
  })

  it('parses a nutriment value even when OFF returns it as a numeric string rather than a number', async () => {
    const { mapOffProductToRow } = await import('../../server/lib/nutrition/foodImportMapping')
    const row = mapOffProductToRow({
      code: '111', product_name: 'String-valued nutriments',
      nutriments: { 'energy-kcal_100g': '250', 'proteins_100g': '10.5' },
    } as any)
    expect(row).toMatchObject({ calories: 250, protein_g: 10.5 })
  })

  it('also accepts the API-response shape (nested under "product") defensively', async () => {
    const { mapOffProductToRow } = await import('../../server/lib/nutrition/foodImportMapping')
    const record = loadFixture('off-api-nested-example.json')
    const row = mapOffProductToRow(record as any)

    expect(row).toMatchObject({ source: 'openfoodfacts', source_id: '0016000275287', name: 'Cheerios' })
  })

  it('returns null for a record with no usable product name, rather than inserting a garbage row', async () => {
    const { mapOffProductToRow } = await import('../../server/lib/nutrition/foodImportMapping')
    const row = mapOffProductToRow({ code: '123', nutriments: {} } as any)
    expect(row).toBeNull()
  })
})
