// Widened nutrient set (#140). Numeric fields mirror the original 5 macros — null means
// untracked, never coerced to 0. Descriptive fields are read back as raw JSON-string text
// (the API's storage format) — parse before use; a component-level helper (see
// MoreNutrientsSection.tsx's payloadToExtendedNutrients) handles that for editable forms.
export interface WidenedNutrients {
  sodium_mg?: number | null
  sugar_g?: number | null
  saturated_fat_g?: number | null
  polyunsaturated_fat_g?: number | null
  monounsaturated_fat_g?: number | null
  trans_fat_g?: number | null
  cholesterol_mg?: number | null
  potassium_mg?: number | null
  vitamin_a_mcg?: number | null
  vitamin_c_mg?: number | null
  calcium_mg?: number | null
  iron_mg?: number | null
}

export interface DescriptiveNutrients {
  glycemic_index?: string | null
  custom_nutrients?: unknown
  allergens?: unknown
  traces?: unknown
}

const WIDENED_NUTRIENT_KEYS = [
  'sodium_mg', 'sugar_g', 'saturated_fat_g', 'polyunsaturated_fat_g', 'monounsaturated_fat_g',
  'trans_fat_g', 'cholesterol_mg', 'potassium_mg', 'vitamin_a_mcg', 'vitamin_c_mg',
  'calcium_mg', 'iron_mg',
] as const
const DESCRIPTIVE_NUTRIENT_KEYS = ['glycemic_index', 'custom_nutrients', 'allergens', 'traces'] as const

// Carries the widened nutrient set (#140) forward whenever a FoodLogEntry is used as the
// basis for a new one (copy-to-today, one-tap re-log) — without this, those flows silently
// reset sodium/sugar/allergens/etc. to null even though the source entry has them.
export function widenedNutrientFields(entry: WidenedNutrients & DescriptiveNutrients): WidenedNutrients & DescriptiveNutrients {
  const out: Record<string, unknown> = {}
  for (const key of WIDENED_NUTRIENT_KEYS) out[key] = entry[key] ?? null
  for (const key of DESCRIPTIVE_NUTRIENT_KEYS) out[key] = entry[key] ?? null
  return out as WidenedNutrients & DescriptiveNutrients
}

export interface FoodLogEntry extends WidenedNutrients, DescriptiveNutrients {
  id: number
  meal_type: string
  food_id: number | null
  name: string
  quantity: number
  unit: string
  calories: number | null
  protein_g: number | null
  carbs_g: number | null
  fat_g: number | null
  fiber_g: number | null
  logged_at: string
}

export interface DailyTotals {
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  fiber_g: number
}

export interface MealGroup {
  entries: FoodLogEntry[]
  totals: DailyTotals
}

export interface LogResponse {
  meals: Record<string, MealGroup>
  daily: DailyTotals
}

async function parseErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const body = await res.json() as { error?: string }
    return body.error ?? fallback
  } catch {
    return fallback
  }
}

export async function fetchLog(date: string): Promise<LogResponse> {
  const res = await fetch(`/api/nutrition/log?date=${date}`)
  if (!res.ok) throw new Error('Nutrition log fetch failed')
  return res.json()
}

export async function fetchRecentEntries(limit = 4): Promise<FoodLogEntry[]> {
  const res = await fetch(`/api/nutrition/log/recent?limit=${limit}`)
  if (!res.ok) return []
  const { entries } = await res.json() as { entries: FoodLogEntry[] }
  return entries
}

export interface LogEntryInput extends WidenedNutrients, DescriptiveNutrients {
  date: string
  meal_type: string
  food_id?: number | null
  name?: string
  quantity: number
  unit: string
  calories?: number | null
  protein_g?: number | null
  carbs_g?: number | null
  fat_g?: number | null
  fiber_g?: number | null
}

export async function createLogEntry(input: LogEntryInput): Promise<FoodLogEntry> {
  const res = await fetch('/api/nutrition/log', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) throw new Error(await parseErrorMessage(res, 'Could not save log entry'))
  return res.json()
}

export async function updateLogEntry(id: number, input: Partial<LogEntryInput>): Promise<FoodLogEntry> {
  const res = await fetch(`/api/nutrition/log/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) throw new Error(await parseErrorMessage(res, 'Could not update log entry'))
  return res.json()
}

export async function deleteLogEntry(id: number): Promise<void> {
  const res = await fetch(`/api/nutrition/log/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Could not delete log entry')
}

export interface NutritionTarget extends WidenedNutrients {
  date: string
  calories: number | null
  protein_g: number | null
  carbs_g: number | null
  fat_g: number | null
  fiber_g: number | null
}

export async function fetchTargets(date: string): Promise<NutritionTarget | null> {
  const res = await fetch(`/api/nutrition/targets?date=${date}`)
  if (!res.ok) throw new Error('Targets fetch failed')
  return res.json()
}

export async function saveTargets(input: WidenedNutrients & {
  date: string
  calories?: number
  protein_g?: number
  carbs_g?: number
  fat_g?: number
  fiber_g?: number
}): Promise<NutritionTarget> {
  const res = await fetch('/api/nutrition/targets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) throw new Error(await parseErrorMessage(res, 'Could not save targets'))
  return res.json()
}

export interface NutritionSummary {
  target: NutritionTarget | null
  actual: DailyTotals & WidenedNutrients
  remaining: {
    calories: number | null
    protein_g: number | null
    carbs_g: number | null
    fat_g: number | null
    fiber_g: number | null
  } & WidenedNutrients
}

export async function fetchSummary(date: string): Promise<NutritionSummary> {
  const res = await fetch(`/api/nutrition/summary?date=${date}`)
  if (!res.ok) throw new Error('Summary fetch failed')
  return res.json()
}

export interface Food extends WidenedNutrients, DescriptiveNutrients {
  id: number
  source: string
  name: string
  brand: string | null
  default_qty: number
  default_unit: string
  calories: number | null
  protein_g: number | null
  carbs_g: number | null
  fat_g: number | null
  fiber_g: number | null
}

export async function searchFoods(q: string): Promise<Food[]> {
  const res = await fetch(`/api/nutrition/foods?q=${encodeURIComponent(q)}`)
  if (!res.ok) return []
  const { foods } = await res.json() as { foods: Food[] }
  return foods
}

export async function createFood(input: WidenedNutrients & DescriptiveNutrients & {
  name: string
  default_qty: number
  default_unit: string
  calories?: number
  protein_g?: number
  carbs_g?: number
  fat_g?: number
  fiber_g?: number
}): Promise<Food> {
  const res = await fetch('/api/nutrition/foods', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) throw new Error(await parseErrorMessage(res, 'Could not save food'))
  return res.json()
}

export async function deleteFood(id: number): Promise<void> {
  const res = await fetch(`/api/nutrition/foods/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(await parseErrorMessage(res, 'Could not delete food'))
}

export interface RecipeIngredientInput extends WidenedNutrients, DescriptiveNutrients {
  food_id?: number
  name: string
  quantity: number
  unit: string
  calories?: number
  protein_g?: number
  carbs_g?: number
  fat_g?: number
  fiber_g?: number
}

export interface Recipe {
  id: number
  name: string
  servings: number
  food_id: number
  ingredient_count: number
  per_serving_calories: number | null
  per_serving_protein_g: number | null
  per_serving_carbs_g: number | null
  per_serving_fat_g: number | null
  per_serving_fiber_g: number | null
}

export async function fetchRecipes(): Promise<Recipe[]> {
  const res = await fetch('/api/nutrition/recipes')
  if (!res.ok) return []
  const { recipes } = await res.json() as { recipes: Recipe[] }
  return recipes
}

export async function createRecipe(input: {
  name: string
  servings: number
  ingredients: RecipeIngredientInput[]
}): Promise<{ id: number; name: string; servings: number; food: Food }> {
  const res = await fetch('/api/nutrition/recipes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) throw new Error(await parseErrorMessage(res, 'Could not save recipe'))
  return res.json()
}

export async function deleteRecipe(id: number): Promise<void> {
  const res = await fetch(`/api/nutrition/recipes/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(await parseErrorMessage(res, 'Could not delete recipe'))
}
