import { useState, useEffect } from 'react'
import { Rail } from '../../components/viz/Rail'
import { SECTION_ACCENTS, COLORS, FONT_MONO, FONT_UI } from '../../theme'
import { searchFoods, deleteFood, fetchRecipes, deleteRecipe, createFood, createRecipe, fetchRecipe, updateRecipe, type Food, type Recipe, type RecipeDetail } from '../../lib/nutritionApi'
import { hexA } from '../../lib/hexA'
import { useToast } from '../../lib/ToastContext'
import { MacroGridInputs, MACRO_KEYS } from './MacroGridInputs'
import { MoreNutrientsSection, emptyExtendedNutrients, extendedNutrientsToPayload, type ExtendedNutrients } from './MoreNutrientsSection'

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback
}

const A = SECTION_ACCENTS.nutrition

const inputStyle = {
  width: '100%', boxSizing: 'border-box' as const, background: COLORS.base,
  border: `1px solid ${COLORS.line}`, borderRadius: 8, padding: '9px 11px',
  color: COLORS.text, fontFamily: FONT_MONO, fontSize: 12,
}

const accentButton = {
  flex: 1, padding: '10px 0', borderRadius: 8, border: 'none', cursor: 'pointer',
  background: A, color: COLORS.base, fontFamily: FONT_MONO, fontSize: 10, fontWeight: 700,
}

function NewFoodForm({ onDone, onBack }: { onDone: () => void; onBack: () => void }) {
  const { showToast } = useToast()
  const [name, setName] = useState('')
  const [qty, setQty] = useState('')
  const [unit, setUnit] = useState('')
  const [macros, setMacros] = useState<Record<'calories' | 'protein_g' | 'carbs_g' | 'fat_g' | 'fiber_g', string>>({
    calories: '', protein_g: '', carbs_g: '', fat_g: '', fiber_g: '',
  })
  const [extended, setExtended] = useState<ExtendedNutrients>(emptyExtendedNutrients())
  const [submitting, setSubmitting] = useState(false)

  async function handleSave() {
    if (!name || submitting) return
    if (!(Number(qty) > 0)) { showToast('Default quantity must be greater than 0.', 'error'); return }
    setSubmitting(true)
    try {
      await createFood({
        name, default_qty: Number(qty), default_unit: unit,
        calories: macros.calories === '' ? undefined : Number(macros.calories),
        protein_g: macros.protein_g === '' ? undefined : Number(macros.protein_g),
        carbs_g: macros.carbs_g === '' ? undefined : Number(macros.carbs_g),
        fat_g: macros.fat_g === '' ? undefined : Number(macros.fat_g),
        fiber_g: macros.fiber_g === '' ? undefined : Number(macros.fiber_g),
        ...extendedNutrientsToPayload(extended),
      })
      onDone()
    } catch (err) {
      showToast(errorMessage(err, 'Could not save food.'), 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <button onClick={onBack} style={{ background: 'none', border: 'none', color: COLORS.textMuted, fontFamily: FONT_MONO, fontSize: 10, cursor: 'pointer', marginBottom: 12 }}>‹ BACK TO LIBRARY</button>
      <label htmlFor="new-food-name" style={{ display: 'block', fontFamily: FONT_MONO, fontSize: 8.5, color: COLORS.textMuted, marginBottom: 4 }}>NAME</label>
      <input id="new-food-name" aria-label="Food name" value={name} onChange={e => setName(e.target.value)} style={{ ...inputStyle, marginBottom: 10 }} />
      <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
        <div style={{ flex: 1 }}>
          <label htmlFor="new-food-qty" style={{ display: 'block', fontFamily: FONT_MONO, fontSize: 8.5, color: COLORS.textMuted, marginBottom: 4 }}>DEFAULT QTY</label>
          <input id="new-food-qty" aria-label="Default quantity" value={qty} onChange={e => setQty(e.target.value)} style={inputStyle} />
        </div>
        <div style={{ flex: 1 }}>
          <label htmlFor="new-food-unit" style={{ display: 'block', fontFamily: FONT_MONO, fontSize: 8.5, color: COLORS.textMuted, marginBottom: 4 }}>DEFAULT UNIT</label>
          <input id="new-food-unit" aria-label="Default unit" value={unit} onChange={e => setUnit(e.target.value)} style={inputStyle} />
        </div>
      </div>
      <div style={{ fontFamily: FONT_MONO, fontSize: 8, color: COLORS.textMuted, marginBottom: 8 }}>
        This becomes the LOCKED logging unit for this food.
      </div>
      <MacroGridInputs values={macros} onChange={(key, value) => setMacros(m => ({ ...m, [key]: value }))} />
      <MoreNutrientsSection accent={A} data={extended} onChange={setExtended} />
      <button onClick={handleSave} disabled={submitting} style={{ ...accentButton, width: '100%' }}>SAVE FOOD — SEARCHABLE IMMEDIATELY</button>
    </>
  )
}

interface IngredientRow {
  food_id?: number
  name: string
  quantity: number
  unit: string
  calories: number | null
  protein_g: number | null
  carbs_g: number | null
  fat_g: number | null
  fiber_g: number | null
  // Present only for food-linked rows — the food this row was added from, kept
  // around so a later quantity edit can rescale macros from its per-default_qty
  // values instead of leaving them frozen at whatever quantity the row started at.
  sourceFood?: Food
}

function scaleFromFood(food: Food, quantity: number) {
  const factor = quantity / food.default_qty
  const round2 = (v: number | null) => v == null ? null : Math.round(v * factor * 100) / 100
  return {
    calories: food.calories == null ? null : Math.round(food.calories * factor),
    protein_g: round2(food.protein_g),
    carbs_g: round2(food.carbs_g),
    fat_g: round2(food.fat_g),
    fiber_g: round2(food.fiber_g),
  }
}

function toIngredientRows(ingredients: RecipeDetail['ingredients'], foods: Food[]): IngredientRow[] {
  return ingredients.map(i => ({
    food_id: i.food_id, name: i.name, quantity: i.quantity, unit: i.unit,
    calories: i.calories ?? null, protein_g: i.protein_g ?? null, carbs_g: i.carbs_g ?? null,
    fat_g: i.fat_g ?? null, fiber_g: i.fiber_g ?? null,
    sourceFood: i.food_id != null ? foods.find(f => f.id === i.food_id) : undefined,
  }))
}

function NewRecipeForm({ foods, editing, onDone, onBack }: { foods: Food[]; editing?: RecipeDetail; onDone: () => void; onBack: () => void }) {
  const { showToast } = useToast()
  const [name, setName] = useState(editing?.name ?? '')
  const [servings, setServings] = useState(editing ? String(editing.servings) : '')
  const [ingredients, setIngredients] = useState<IngredientRow[]>(editing ? toIngredientRows(editing.ingredients, foods) : [])
  const [query, setQuery] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const matches = query
    ? foods.filter(f => f.id !== editing?.food_id && f.name.toLowerCase().includes(query.toLowerCase())).slice(0, 5)
    : []

  function addFromFood(food: Food) {
    setIngredients(rows => [...rows, {
      food_id: food.id, name: food.name, quantity: food.default_qty, unit: food.default_unit,
      calories: food.calories, protein_g: food.protein_g, carbs_g: food.carbs_g, fat_g: food.fat_g, fiber_g: food.fiber_g,
      sourceFood: food,
    }])
    setQuery('')
  }

  function addAdHoc() {
    setIngredients(rows => [...rows, { name: '', quantity: 1, unit: 'g', calories: null, protein_g: null, carbs_g: null, fat_g: null, fiber_g: null }])
  }

  function updateIngredient(index: number, patch: Partial<IngredientRow>) {
    setIngredients(rows => rows.map((r, i) => i === index ? { ...r, ...patch } : r))
  }

  function removeIngredient(index: number) {
    setIngredients(rows => rows.filter((_, i) => i !== index))
  }

  const totalCalories = ingredients.reduce((s, i) => s + (i.calories ?? 0), 0)
  const servingsNum = Number(servings) || 0
  const perServingCalories = servingsNum > 0 ? Math.round(totalCalories / servingsNum) : 0

  async function handleSave() {
    if (!name || ingredients.length === 0 || servingsNum <= 0 || submitting) return
    setSubmitting(true)
    try {
      const payload = {
        name, servings: servingsNum,
        ingredients: ingredients.map(i => ({
          food_id: i.food_id, name: i.name, quantity: i.quantity, unit: i.unit,
          calories: i.calories ?? undefined, protein_g: i.protein_g ?? undefined,
          carbs_g: i.carbs_g ?? undefined, fat_g: i.fat_g ?? undefined, fiber_g: i.fiber_g ?? undefined,
        })),
      }
      if (editing) {
        await updateRecipe(editing.id, payload)
      } else {
        await createRecipe(payload)
      }
      onDone()
    } catch (err) {
      showToast(errorMessage(err, editing ? 'Could not update recipe.' : 'Could not save recipe.'), 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <button onClick={onBack} style={{ background: 'none', border: 'none', color: COLORS.textMuted, fontFamily: FONT_MONO, fontSize: 10, cursor: 'pointer', marginBottom: 12 }}>‹ BACK TO LIBRARY</button>
      <input aria-label="Recipe name" placeholder="Recipe name" value={name} onChange={e => setName(e.target.value)} style={{ ...inputStyle, marginBottom: 8 }} />
      <label htmlFor="new-recipe-servings" style={{ display: 'block', fontFamily: FONT_MONO, fontSize: 8.5, color: COLORS.textMuted, marginBottom: 4 }}>SERVINGS</label>
      <input id="new-recipe-servings" aria-label="Servings" value={servings} onChange={e => setServings(e.target.value)} style={{ ...inputStyle, marginBottom: 12, width: 80 }} />

      {ingredients.map((ing, i) => {
        const isAdHoc = ing.food_id == null
        return (
          <div key={i} style={{ marginBottom: 8 }}>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: isAdHoc ? 4 : 0 }}>
              {isAdHoc ? (
                <input aria-label={`Ingredient ${i} name`} value={ing.name} onChange={e => updateIngredient(i, { name: e.target.value })}
                  placeholder="Name" style={{ ...inputStyle, flex: 1, fontSize: 12 }} />
              ) : (
                <span style={{ flex: 1, fontFamily: FONT_UI, fontSize: 12, color: COLORS.text }}>{ing.name}</span>
              )}
              <input aria-label={`Ingredient ${i} quantity`} value={String(ing.quantity)}
                onChange={e => {
                  const quantity = Number(e.target.value)
                  updateIngredient(i, ing.sourceFood ? { quantity, ...scaleFromFood(ing.sourceFood, quantity) } : { quantity })
                }} style={{ ...inputStyle, width: 60 }} />
              {isAdHoc ? (
                <input aria-label={`Ingredient ${i} unit`} value={ing.unit} onChange={e => updateIngredient(i, { unit: e.target.value })}
                  placeholder="g" style={{ ...inputStyle, width: 30, fontSize: 9, padding: '5px 4px' }} />
              ) : (
                <span style={{ fontFamily: FONT_MONO, fontSize: 9, color: COLORS.textMuted, width: 30 }}>{ing.unit}</span>
              )}
              {!isAdHoc && (
                <span style={{ fontFamily: FONT_MONO, fontSize: 9, color: COLORS.textMuted, width: 60 }}>{ing.calories ?? '—'} kcal</span>
              )}
              <button aria-label={`Remove ingredient ${i}`} onClick={() => removeIngredient(i)} style={{ background: 'none', border: 'none', color: COLORS.red, cursor: 'pointer' }}>✕</button>
            </div>
            {isAdHoc && (
              <MacroGridInputs
                values={Object.fromEntries(MACRO_KEYS.map(key => [key, ing[key] == null ? '' : String(ing[key])])) as Record<typeof MACRO_KEYS[number], string>}
                onChange={(key, value) => updateIngredient(i, { [key]: value === '' ? null : Number(value) })}
                ariaLabel={key => `Ingredient ${i} ${key}`}
                gap={4} marginBottom={0} inputPadding="5px 2px" inputFontSize={9}
              />
            )}
          </div>
        )
      })}

      <input placeholder="Add from saved foods…" value={query} onChange={e => setQuery(e.target.value)} style={{ ...inputStyle, marginBottom: 6 }} />
      {matches.map(f => (
        <button key={f.id} onClick={() => addFromFood(f)} style={{
          display: 'block', width: '100%', textAlign: 'left', background: 'transparent', border: 'none',
          color: A, fontFamily: FONT_UI, fontSize: 12, cursor: 'pointer', padding: '4px 0',
        }}>{f.name}</button>
      ))}
      <button onClick={addAdHoc} style={{
        width: '100%', padding: '8px 0', borderRadius: 6, border: `1px dashed ${hexA(A, 0.4)}`,
        background: 'transparent', color: A, fontFamily: FONT_MONO, fontSize: 9.5, cursor: 'pointer', marginBottom: 14,
      }}>+ AD-HOC INGREDIENT</button>

      <div style={{ fontFamily: FONT_MONO, fontSize: 9, color: COLORS.textMuted, marginBottom: 10 }}>
        RECIPE TOTAL {totalCalories} kcal · PER SERVING {perServingCalories} kcal
      </div>

      <button onClick={handleSave} disabled={submitting} style={{ ...accentButton, width: '100%' }}>{editing ? 'SAVE CHANGES' : 'SAVE RECIPE'}</button>
    </>
  )
}

export function NutritionLibrary() {
  const { showToast } = useToast()
  const [mode, setMode] = useState<'list' | 'new-food' | 'new-recipe' | 'edit-recipe'>('list')
  const [foods, setFoods] = useState<Food[]>([])
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [loading, setLoading] = useState(true)
  const [editingRecipe, setEditingRecipe] = useState<RecipeDetail | null>(null)

  async function reload() {
    setLoading(true)
    const [foodList, recipeList] = await Promise.all([searchFoods(''), fetchRecipes()])
    setFoods(foodList)
    setRecipes(recipeList)
    setLoading(false)
  }

  useEffect(() => { reload() }, [])

  async function handleDeleteFood(id: number) {
    try {
      await deleteFood(id)
      reload()
    } catch (err) {
      showToast(errorMessage(err, 'Could not delete food.'), 'error')
    }
  }
  async function handleDeleteRecipe(id: number) {
    try {
      await deleteRecipe(id)
      reload()
    } catch (err) {
      showToast(errorMessage(err, 'Could not delete recipe.'), 'error')
    }
  }
  async function handleEditRecipe(id: number) {
    try {
      const detail = await fetchRecipe(id)
      setEditingRecipe(detail)
      setMode('edit-recipe')
    } catch (err) {
      showToast(errorMessage(err, 'Could not load recipe.'), 'error')
    }
  }

  if (mode === 'new-food') {
    return <NewFoodForm onDone={() => { setMode('list'); reload() }} onBack={() => setMode('list')} />
  }

  if (mode === 'new-recipe') {
    return <NewRecipeForm foods={foods} onDone={() => { setMode('list'); reload() }} onBack={() => setMode('list')} />
  }

  if (mode === 'edit-recipe' && editingRecipe) {
    return <NewRecipeForm foods={foods} editing={editingRecipe} onDone={() => { setMode('list'); setEditingRecipe(null); reload() }} onBack={() => { setMode('list'); setEditingRecipe(null) }} />
  }

  return (
    <>
      <Rail label="FOOD LIBRARY" accent={A} right={`${foods.length} FOODS · ${recipes.length} RECIPES`} />
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <button onClick={() => setMode('new-food')} style={accentButton}>+ NEW FOOD</button>
        <button onClick={() => setMode('new-recipe')} style={accentButton}>+ NEW RECIPE</button>
      </div>

      {!loading && foods.length === 0 && recipes.length === 0 && (
        <p style={{ fontFamily: FONT_MONO, fontSize: 10, color: COLORS.textMuted, textAlign: 'center', padding: '24px 0' }}>NO SAVED FOODS YET</p>
      )}

      {foods.length > 0 && (
        <>
          <div style={{ fontFamily: FONT_MONO, fontSize: 9, color: COLORS.textSecondary, marginBottom: 6 }}>FOODS</div>
          {foods.map(f => (
            <div key={f.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: COLORS.surface, border: `1px solid ${COLORS.line}`, borderRadius: 6, padding: '8px 10px', marginBottom: 6 }}>
              <div>
                <div style={{ fontFamily: FONT_UI, fontSize: 13, color: COLORS.text }}>{f.name}</div>
                <div style={{ fontFamily: FONT_MONO, fontSize: 8.5, color: COLORS.textMuted }}>
                  per {f.default_qty} {f.default_unit} · {f.calories ?? '—'} kcal · P {f.protein_g ?? '—'} · C {f.carbs_g ?? '—'} · F {f.fat_g ?? '—'}
                </div>
              </div>
              <button aria-label={`Delete ${f.name}`} onClick={() => handleDeleteFood(f.id)} style={{ background: 'none', border: 'none', color: COLORS.red, cursor: 'pointer', fontSize: 14 }}>✕</button>
            </div>
          ))}
        </>
      )}

      {recipes.length > 0 && (
        <>
          <div style={{ fontFamily: FONT_MONO, fontSize: 9, color: COLORS.textSecondary, margin: '12px 0 6px' }}>RECIPES</div>
          {recipes.map(r => (
            <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: COLORS.surface, border: `1px solid ${COLORS.line}`, borderRadius: 6, padding: '8px 10px', marginBottom: 6 }}>
              <div>
                <div style={{ fontFamily: FONT_UI, fontSize: 13, color: COLORS.text }}>
                  {r.name}{' '}
                  <span style={{ fontFamily: FONT_MONO, fontSize: 7, color: A, border: `1px solid ${A}`, borderRadius: 3, padding: '1px 4px' }}>RECIPE</span>
                </div>
                <div style={{ fontFamily: FONT_MONO, fontSize: 8.5, color: COLORS.textMuted }}>
                  {r.ingredient_count} ingredients · {r.servings} servings · {r.per_serving_calories ?? '—'} kcal / serving
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <button aria-label={`Edit ${r.name}`} onClick={() => handleEditRecipe(r.id)} style={{ background: 'none', border: 'none', color: COLORS.textMuted, cursor: 'pointer', fontSize: 12 }}>✎</button>
                <button aria-label={`Delete ${r.name}`} onClick={() => handleDeleteRecipe(r.id)} style={{ background: 'none', border: 'none', color: COLORS.red, cursor: 'pointer', fontSize: 14 }}>✕</button>
              </div>
            </div>
          ))}
        </>
      )}

      <p style={{ fontFamily: FONT_MONO, fontSize: 8, color: COLORS.textMuted, marginTop: 14, textAlign: 'center' }}>
        Recipes save as custom foods (per serving); no separate recipe store beyond composition.
      </p>
    </>
  )
}
