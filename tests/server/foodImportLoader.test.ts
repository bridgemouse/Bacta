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
    it('populates foods from a wrapped USDA dump file', async () => {
      const { importUsdaDumpFile } = await import('../../server/lib/nutrition/foodImportLoader')
      const count = importUsdaDumpFile(path.join(FIXTURES, 'usda-dump-sample.json'))
      expect(count).toBe(2)

      const { default: db } = await import('../../server/db/client')
      const rows = db.prepare("SELECT * FROM foods WHERE source = 'usda' ORDER BY source_id").all() as any[]
      expect(rows.length).toBe(2)
      expect(rows.find(r => r.source_id === '2261421')).toMatchObject({ name: 'Flour, oat, whole grain', calories: 389.125 })
      expect(rows.find(r => r.source_id === '174988')).toMatchObject({ name: 'Croissants, apple', calories: 254 })
    })

    it('skips a malformed record (no foodNutrients) instead of aborting the whole batch', async () => {
      const { importUsdaDumpFile } = await import('../../server/lib/nutrition/foodImportLoader')
      const count = importUsdaDumpFile(path.join(FIXTURES, 'usda-dump-with-malformed.json'))
      // 2 records in the file, but only 1 is well-formed — the malformed one is skipped,
      // not thrown, and does not roll back the valid record's write.
      expect(count).toBe(1)

      const { default: db } = await import('../../server/db/client')
      const row = db.prepare("SELECT * FROM foods WHERE source_id = '5555555'").get()
      expect(row).toMatchObject({ name: 'Valid Record', calories: 200 })
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

    it('running the import twice does not duplicate rows (idempotent upsert)', async () => {
      const { importUsdaDumpFile } = await import('../../server/lib/nutrition/foodImportLoader')
      importUsdaDumpFile(path.join(FIXTURES, 'usda-dump-sample.json'))

      const { default: db } = await import('../../server/db/client')
      const rows = db.prepare("SELECT * FROM foods WHERE source = 'usda' AND source_id IN ('2261421', '174988')").all() as any[]
      expect(rows.length).toBe(2)
    })
  })

  describe('importOffDumpFile', () => {
    it('populates foods from a JSONL dump, skipping unmappable lines', async () => {
      const { importOffDumpFile } = await import('../../server/lib/nutrition/foodImportLoader')
      const count = importOffDumpFile(path.join(FIXTURES, 'off-dump-sample.jsonl'))
      // 3 lines in the fixture, but the third has no product_name and should be skipped
      expect(count).toBe(2)

      const { default: db } = await import('../../server/db/client')
      const rows = db.prepare("SELECT * FROM foods WHERE source = 'openfoodfacts' ORDER BY source_id").all() as any[]
      expect(rows.length).toBe(2)
      expect(rows.find(r => r.source_id === '0016000275287')).toMatchObject({ name: 'Cheerios', calories: 358.97 })
      expect(rows.find(r => r.source_id === '0000000000000')).toBeUndefined()
    })

    it('running the import twice does not duplicate rows, and refreshes values', async () => {
      const { importOffDumpFile } = await import('../../server/lib/nutrition/foodImportLoader')
      importOffDumpFile(path.join(FIXTURES, 'off-dump-sample.jsonl'))

      const { default: db } = await import('../../server/db/client')
      const rows = db.prepare("SELECT * FROM foods WHERE source = 'openfoodfacts'").all() as any[]
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
