import { useState, useEffect } from 'react'
import { Rail } from '../../components/viz/Rail'
import { SECTION_ACCENTS, COLORS, FONT_MONO, FONT_UI } from '../../theme'
import { searchFoods, deleteFood, fetchRecipes, deleteRecipe, createFood, type Food, type Recipe } from '../../lib/nutritionApi'

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
  const [name, setName] = useState('')
  const [qty, setQty] = useState('')
  const [unit, setUnit] = useState('')
  const [macros, setMacros] = useState<Record<'calories' | 'protein_g' | 'carbs_g' | 'fat_g' | 'fiber_g', string>>({
    calories: '', protein_g: '', carbs_g: '', fat_g: '', fiber_g: '',
  })
  const [submitting, setSubmitting] = useState(false)

  async function handleSave() {
    if (!name || submitting) return
    setSubmitting(true)
    try {
      await createFood({
        name, default_qty: Number(qty), default_unit: unit,
        calories: macros.calories === '' ? undefined : Number(macros.calories),
        protein_g: macros.protein_g === '' ? undefined : Number(macros.protein_g),
        carbs_g: macros.carbs_g === '' ? undefined : Number(macros.carbs_g),
        fat_g: macros.fat_g === '' ? undefined : Number(macros.fat_g),
        fiber_g: macros.fiber_g === '' ? undefined : Number(macros.fiber_g),
      })
      onDone()
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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6, marginBottom: 14 }}>
        {(['calories', 'protein_g', 'carbs_g', 'fat_g', 'fiber_g'] as const).map(key => (
          <input key={key} placeholder="—" value={macros[key]} onChange={e => setMacros(m => ({ ...m, [key]: e.target.value }))}
            style={{ ...inputStyle, textAlign: 'center', padding: '7px 4px' }} />
        ))}
      </div>
      <button onClick={handleSave} disabled={submitting} style={{ ...accentButton, width: '100%' }}>SAVE FOOD — SEARCHABLE IMMEDIATELY</button>
    </>
  )
}

export function NutritionLibrary() {
  const [mode, setMode] = useState<'list' | 'new-food' | 'new-recipe'>('list')
  const [foods, setFoods] = useState<Food[]>([])
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [loading, setLoading] = useState(true)

  async function reload() {
    setLoading(true)
    const [foodList, recipeList] = await Promise.all([searchFoods(''), fetchRecipes()])
    setFoods(foodList)
    setRecipes(recipeList)
    setLoading(false)
  }

  useEffect(() => { reload() }, [])

  async function handleDeleteFood(id: number) {
    await deleteFood(id)
    reload()
  }
  async function handleDeleteRecipe(id: number) {
    await deleteRecipe(id)
    reload()
  }

  if (mode === 'new-food') {
    return <NewFoodForm onDone={() => { setMode('list'); reload() }} onBack={() => setMode('list')} />
  }
  // 'new-recipe' mode is implemented in Task 16

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
              <button aria-label={`Delete ${r.name}`} onClick={() => handleDeleteRecipe(r.id)} style={{ background: 'none', border: 'none', color: COLORS.red, cursor: 'pointer', fontSize: 14 }}>✕</button>
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
