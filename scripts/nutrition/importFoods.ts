// Batch-imports USDA FoodData Central and/or Open Food Facts bulk dump files into the
// `foods` reference table. Thin CLI wrapper — all real logic (mapping, upsert,
// file-shape handling) lives in server/lib/nutrition/, which is typechecked and
// covered by tests/server/foodImport{Mapping,Loader}.test.ts; keep this file that way.
//
// Usage (mirrors garmin_ingest.py's --days flag-based CLI convention):
//   npx tsx scripts/nutrition/importFoods.ts --usda /path/to/foundationFoods.json
//   npx tsx scripts/nutrition/importFoods.ts --off /path/to/openfoodfacts-products.jsonl
//   npx tsx scripts/nutrition/importFoods.ts --usda <path> --off <path>
//
// Prerequisite (human, not automatable): download the USDA FDC Foundation Foods
// (+ optionally SR Legacy) JSON export from https://fdc.nal.usda.gov/download-datasets
// and/or an Open Food Facts JSONL export from https://world.openfoodfacts.org/data to
// a local path on the host. Neither file is included in this repo — multi-GB downloads
// are out of scope for automation (NUTRITION_PLAN.md §6).
import { importUsdaDumpFile, importOffDumpFile } from '../../server/lib/nutrition/foodImportLoader'

function argValue(flag: string): string | undefined {
  const index = process.argv.indexOf(flag)
  return index !== -1 ? process.argv[index + 1] : undefined
}

function main(): void {
  const usdaPath = argValue('--usda')
  const offPath = argValue('--off')

  if (!usdaPath && !offPath) {
    console.error('Usage: tsx scripts/nutrition/importFoods.ts [--usda <path>] [--off <path>]')
    process.exit(1)
  }

  if (usdaPath) {
    const count = importUsdaDumpFile(usdaPath)
    console.log(`[nutrition-import] USDA: processed ${count} record(s) from ${usdaPath}`)
  }

  if (offPath) {
    const count = importOffDumpFile(offPath)
    console.log(`[nutrition-import] Open Food Facts: wrote ${count} record(s) from ${offPath}`)
  }
}

main()
