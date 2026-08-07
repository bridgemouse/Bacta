import { describe, it, expect, beforeAll } from 'vitest'
import path from 'path'

process.env.DB_PATH = ':memory:'

const FIXTURES = path.join(__dirname, 'fixtures/nutrition')

describe('food import loader', () => {
  beforeAll(async () => {
    const { migrate } = await import('../../server/db/migrate')
    migrate()
  })

  describe('extractRecordsArray', () => {
    it('returns a bare array as-is', async () => {
      const { extractRecordsArray } = await import('../../server/lib/nutrition/foodImportLoader')
      expect(extractRecordsArray([{ a: 1 }])).toEqual([{ a: 1 }])
    })

    it('finds the array inside a wrapper object regardless of the wrapper key name', async () => {
      const { extractRecordsArray } = await import('../../server/lib/nutrition/foodImportLoader')
      expect(extractRecordsArray({ FoundationFoods: [{ a: 1 }, { a: 2 }] })).toEqual([{ a: 1 }, { a: 2 }])
      expect(extractRecordsArray({ SRLegacyFoods: [{ b: 1 }] })).toEqual([{ b: 1 }])
    })

    it('throws a clear error when no array is found anywhere in the parsed JSON', async () => {
      const { extractRecordsArray } = await import('../../server/lib/nutrition/foodImportLoader')
      expect(() => extractRecordsArray({ someKey: 'not an array' })).toThrow()
    })

    it('concatenates every array-valued key when a dump has more than one (e.g. a combined USDA export with FoundationFoods + SRLegacyFoods + BrandedFoods side by side) rather than silently picking one and dropping the rest', async () => {
      const { extractRecordsArray } = await import('../../server/lib/nutrition/foodImportLoader')
      const result = extractRecordsArray({
        FoundationFoods: [{ a: 1 }],
        SRLegacyFoods: [{ b: 1 }, { b: 2 }],
        SurveyFoods: [],
      })
      expect(result).toEqual([{ a: 1 }, { b: 1 }, { b: 2 }])
    })
  })

  describe('importUsdaDumpFile', () => {
    it('populates foods and their variants from a wrapped USDA dump file', async () => {
      const { importUsdaDumpFile } = await import('../../server/lib/nutrition/foodImportLoader')
      const count = importUsdaDumpFile(path.join(FIXTURES, 'usda-dump-sample.json'))
      expect(count).toBe(2)

      const { default: db } = await import('../../server/db/client')
      const foods = db.prepare("SELECT * FROM foods WHERE source = 'usda' ORDER BY source_id").all() as any[]
      expect(foods.length).toBe(2)
      const oatFlour = foods.find(f => f.source_id === '2261421')
      expect(oatFlour).toMatchObject({ name: 'Flour, oat, whole grain' })
      expect(oatFlour.default_qty).toBeUndefined() // foods is identity-only now

      const variants = db.prepare('SELECT * FROM food_variants WHERE food_id = ?').all(oatFlour.id) as any[]
      expect(variants.length).toBe(1) // usda-dump-sample.json's records have no foodPortions
      expect(variants[0]).toMatchObject({ label: '100 g', is_default: 1, calories: 389.125 })
    })

    it('emits multiple variants for a record with foodPortions', async () => {
      const { importUsdaDumpFile } = await import('../../server/lib/nutrition/foodImportLoader')
      importUsdaDumpFile(path.join(FIXTURES, 'usda-dump-with-portions.json'))

      const { default: db } = await import('../../server/db/client')
      const food = db.prepare("SELECT * FROM foods WHERE source_id = '9999001'").get() as any
      const variants = db.prepare('SELECT * FROM food_variants WHERE food_id = ? ORDER BY is_default DESC').all(food.id) as any[]
      expect(variants.length).toBe(2) // 100g default + "1 slice"
      expect(variants[0]).toMatchObject({ label: '100 g', is_default: 1 })
      expect(variants[1]).toMatchObject({ label: '1 slice', serving_qty: 1, serving_unit: 'slice', gram_weight: 50, is_default: 0, calories: 50 })
    })

    it('skips a malformed record (no foodNutrients) instead of aborting the whole batch', async () => {
      const { importUsdaDumpFile } = await import('../../server/lib/nutrition/foodImportLoader')
      const count = importUsdaDumpFile(path.join(FIXTURES, 'usda-dump-with-malformed.json'))
      expect(count).toBe(1)

      const { default: db } = await import('../../server/db/client')
      const row = db.prepare("SELECT * FROM foods WHERE source_id = '5555555'").get()
      expect(row).toMatchObject({ name: 'Valid Record' })
      const malformedRow = db.prepare("SELECT * FROM foods WHERE source_id = '6666666'").get()
      expect(malformedRow).toBeUndefined()
    })

    it('skips a null entry in the records array instead of aborting the whole batch — a real USDA Foundation Foods dump has literal null entries', async () => {
      const { importUsdaDumpFile } = await import('../../server/lib/nutrition/foodImportLoader')
      const count = importUsdaDumpFile(path.join(FIXTURES, 'usda-dump-with-null-entry.json'))
      // 3 entries in the file's array: one valid record, one literal null, one valid record.
      expect(count).toBe(2)

      const { default: db } = await import('../../server/db/client')
      const rows = db.prepare("SELECT * FROM foods WHERE source_id IN ('7777777', '8888888')").all() as any[]
      expect(rows.length).toBe(2)
    })

    it('running the import twice does not duplicate foods or variants (idempotent upsert, variants refreshed)', async () => {
      const { importUsdaDumpFile } = await import('../../server/lib/nutrition/foodImportLoader')
      importUsdaDumpFile(path.join(FIXTURES, 'usda-dump-sample.json'))
      importUsdaDumpFile(path.join(FIXTURES, 'usda-dump-sample.json'))

      const { default: db } = await import('../../server/db/client')
      const foods = db.prepare("SELECT * FROM foods WHERE source = 'usda' AND source_id IN ('2261421', '174988')").all() as any[]
      expect(foods.length).toBe(2)
      const oatFlour = foods.find(f => f.source_id === '2261421')
      const variants = db.prepare('SELECT * FROM food_variants WHERE food_id = ?').all(oatFlour.id) as any[]
      expect(variants.length).toBe(1) // not duplicated to 2
    })
  })

  describe('importOffDumpFile', () => {
    it('populates foods and their default variant from a JSONL dump, skipping unmappable lines', async () => {
      const { importOffDumpFile } = await import('../../server/lib/nutrition/foodImportLoader')
      const count = importOffDumpFile(path.join(FIXTURES, 'off-dump-sample.jsonl'))
      // 3 lines in the fixture, but the third has no product_name and should be skipped
      expect(count).toBe(2)

      const { default: db } = await import('../../server/db/client')
      const foods = db.prepare("SELECT * FROM foods WHERE source = 'openfoodfacts' ORDER BY source_id").all() as any[]
      expect(foods.length).toBe(2)
      const cheerios = foods.find(f => f.source_id === '0016000275287')
      expect(cheerios).toMatchObject({ name: 'Cheerios' })
      expect(foods.find(f => f.source_id === '0000000000000')).toBeUndefined()

      const variants = db.prepare('SELECT * FROM food_variants WHERE food_id = ?').all(cheerios.id) as any[]
      expect(variants.length).toBe(1)
      expect(variants[0]).toMatchObject({ label: '100 g', is_default: 1, calories: 358.97 })
    })

    it('persists the mapped allergens column on the variant all the way through the upsert, not just in mapOffProductToRow\'s return value (#161)', async () => {
      const { importOffDumpFile } = await import('../../server/lib/nutrition/foodImportLoader')
      importOffDumpFile(path.join(FIXTURES, 'off-dump-sample.jsonl'))

      const { default: db } = await import('../../server/db/client')
      const food = db.prepare("SELECT * FROM foods WHERE source_id = '3017620422003'").get() as any
      const variant = db.prepare('SELECT allergens, traces FROM food_variants WHERE food_id = ?').get(food.id) as { allergens: string | null; traces: string | null }
      expect(JSON.parse(variant.allergens!)).toEqual(['milk', 'nuts', 'soybeans'])
      expect(variant.traces).toBeNull()
    })

    it('running the import twice does not duplicate foods or variants, and refreshes values', async () => {
      const { importOffDumpFile } = await import('../../server/lib/nutrition/foodImportLoader')
      importOffDumpFile(path.join(FIXTURES, 'off-dump-sample.jsonl'))
      importOffDumpFile(path.join(FIXTURES, 'off-dump-sample.jsonl'))

      const { default: db } = await import('../../server/db/client')
      const foods = db.prepare("SELECT * FROM foods WHERE source = 'openfoodfacts'").all() as any[]
      expect(foods.length).toBe(2)
      const cheerios = foods.find(f => f.source_id === '0016000275287')
      const variants = db.prepare('SELECT * FROM food_variants WHERE food_id = ?').all(cheerios.id) as any[]
      expect(variants.length).toBe(1) // not duplicated to 2
    })

    it('skips a null line instead of aborting the whole batch — a real OFF JSONL dump can contain a literal null line (#181)', async () => {
      const { importOffDumpFile } = await import('../../server/lib/nutrition/foodImportLoader')
      const count = importOffDumpFile(path.join(FIXTURES, 'off-dump-with-null-line.jsonl'))
      // 3 lines in the fixture: one valid product, one literal null, one valid product.
      expect(count).toBe(2)

      const { default: db } = await import('../../server/db/client')
      const rows = db.prepare("SELECT * FROM foods WHERE source_id IN ('1111111111111', '2222222222222')").all() as any[]
      expect(rows.length).toBe(2)
    })

    it('is atomic — a malformed line partway through aborts the whole import with no partial writes, since a real multi-million-line file should not be able to leave the table half-imported', async () => {
      const fs = await import('fs')
      const os = await import('os')
      const path2 = await import('path')
      const badFile = path2.join(os.tmpdir(), `off-bad-${process.pid}.jsonl`)
      fs.writeFileSync(badFile, [
        '{"code": "9999999999999", "product_name": "Should Not Persist", "nutriments": {"energy-kcal_100g": 100}}',
        'this is not valid json',
      ].join('\n'))

      const { importOffDumpFile } = await import('../../server/lib/nutrition/foodImportLoader')
      expect(() => importOffDumpFile(badFile)).toThrow()

      const { default: db } = await import('../../server/db/client')
      const row = db.prepare("SELECT * FROM foods WHERE source_id = '9999999999999'").get()
      expect(row).toBeUndefined()

      fs.unlinkSync(badFile)
    })
  })
})
