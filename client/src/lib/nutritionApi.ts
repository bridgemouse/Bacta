export interface FoodLogEntry {
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

export interface LogEntryInput {
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

export interface NutritionTarget {
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

export async function saveTargets(input: {
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
  actual: DailyTotals
  remaining: {
    calories: number | null
    protein_g: number | null
    carbs_g: number | null
    fat_g: number | null
    fiber_g: number | null
  }
}

export async function fetchSummary(date: string): Promise<NutritionSummary> {
  const res = await fetch(`/api/nutrition/summary?date=${date}`)
  if (!res.ok) throw new Error('Summary fetch failed')
  return res.json()
}

export interface Food {
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

export async function createFood(input: {
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

export interface RecipeIngredientInput {
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

// Still-image camera capture (#141) — barcode lookup and meal-photo macro estimate.
export async function lookupFoodByBarcode(code: string): Promise<Food | null> {
  const res = await fetch(`/api/nutrition/foods/barcode/${code}`)
  if (!res.ok) return null
  return res.json()
}

export interface MealPhotoEstimate {
  name: string
  calories: number | null
  protein_g: number | null
  carbs_g: number | null
  fat_g: number | null
  fiber_g: number | null
}

export async function estimateMealFromPhoto(imageBase64: string, mediaType: string): Promise<MealPhotoEstimate> {
  const res = await fetch('/api/nutrition/scan/meal-photo', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: imageBase64, mediaType }),
  })
  if (!res.ok) throw new Error(await parseErrorMessage(res, 'Could not estimate meal from photo'))
  return res.json()
}
