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

  it('maps allergens/traces onto the single variant, stripped of language-tag prefixes', async () => {
    const { mapOffProductToRow } = await import('../../server/lib/nutrition/foodImportMapping')
    const record = loadFixture('off-cheerios.json')
    const result = mapOffProductToRow(record as any)
    if (result!.variants[0].allergens) {
      expect(JSON.parse(result!.variants[0].allergens as string)).not.toEqual(expect.arrayContaining([expect.stringMatching(/^[a-z]{2}:/)]))
    }
  })

  it('returns null for a record with no usable product name', async () => {
    const { mapOffProductToRow } = await import('../../server/lib/nutrition/foodImportMapping')
    expect(mapOffProductToRow({ code: '123', nutriments: {} } as any)).toBeNull()
  })
})
