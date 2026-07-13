# Nutrition Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Bacta Nutrition section frontend from `design_handoff_nutrition_v4/`, wiring it to the already-merged backend (`server/api/nutrition.ts`, PR #136), and add the two backend gaps the design requires that the merged PR didn't include (recipe storage, food deletion).

**Architecture:** A page shell (`NutritionPage.tsx`) toggles between an Overview screen (day ledger + meal log) and a Library screen (foods + recipes), both driven by a small `nutritionApi.ts` fetch layer and a `useNutritionLog` hook. Three bottom sheets (log entry, edit entry, targets) reuse the existing `Sheet`/`SheetShell`/`SheetHeader` primitives unchanged. A shared-component gap (tab labels hardcoded to Overview/Trends) is fixed first since Nutrition needs Overview/Library.

**Tech Stack:** React 19 + TypeScript (client), Express + better-sqlite3 (server), Vitest + Testing Library + supertest.

## Global Constraints

- Design source of truth for copy, spacing, and screen behavior: `design_handoff_nutrition_v4/README.md`. This plan defines file structure, data flow, and tests — for exact microcopy strings and pixel values, the referenced README section is authoritative; transcribe it verbatim, don't paraphrase.
- Inline styles only — no CSS files, Tailwind, or CSS modules.
- Dark UI always — no light mode.
- Colors always from `client/src/theme.ts` (`COLORS`, `SECTION_ACCENTS.nutrition = '#3ecf8e'`) — never hardcoded hex in components.
- RGBA always via `hexA(hex, alpha)` from `client/src/lib/hexA.ts`.
- Numbers/labels/readouts: `fontFamily: FONT_MONO`. Prose/narrative: `fontFamily: FONT_UI`.
- Card sizing via `CARD_SIZES` as `minHeight`, never `height`.
- Prefer editing existing files over creating new ones; new files only where noted below.
- `food_log_entries.date` / `recipes` / `foods` follow the existing local-date convention (`localDateString` in `server/api/nutrition.ts`) — never use UTC date math client-side either; use the same `toLocaleDateString('en-CA')` pattern for "today".
- Branch: `feature/nutrition`, isolated in a worktree (Task 1). Never commit directly to `main`.
- End state: PR opened (final task). Do not merge — `bacta-pr-review` handles that in a separate session.

---

## Phase A — Foundation

### Task 1: Branch + worktree setup

**Files:** none (environment setup only)

- [ ] **Step 1:** From the main checkout: `git checkout main && git pull origin main`
- [ ] **Step 2:** Confirm clean baseline: `npm test && npx tsc --noEmit && npx tsc -p tsconfig.server.json --noEmit` — all must pass before continuing.
- [ ] **Step 3:** Create the branch: `git checkout -b feature/nutrition`
- [ ] **Step 4:** Invoke `superpowers:using-git-worktrees` to create an isolated worktree at `worktrees/nutrition` for this branch. Confirm `worktrees/` is gitignored (it already is, per `bacta-headless` Phase 0c having added it).
- [ ] **Step 5:** Inside the worktree, confirm a clean baseline again: `npm test`. All tests must pass before Task 2 begins.

---

### Task 2: Tab system — widen `Tab` type, per-section labels on `BottomBar`

Nutrition needs an Overview/Library tab pair; every other built section (Home, Recovery, Sleep, Training) uses Overview/Trends today via a hardcoded pair. This task generalizes `BottomBar` without changing existing sections' behavior.

**Files:**
- Modify: `client/src/lib/TabContext.ts`
- Modify: `client/src/components/BottomBar.tsx`
- Modify: `client/src/components/AppShell.tsx`
- Test: `tests/client/components/BottomBar.test.tsx`

**Interfaces:**
- Produces: `Tab = 'overview' | 'trends' | 'library'` (widened from `'overview' | 'trends'`)
- Produces: `BottomBarProps.tabs?: [Tab, Tab]` — defaults to `['overview', 'trends']` when omitted (preserves existing behavior for every section that doesn't pass it)
- Produces: `AppShellProps.tabs?: [Tab, Tab]` — forwarded to `BottomBar`

- [ ] **Step 1: Write the failing test**

Add to `tests/client/components/BottomBar.test.tsx`:

```tsx
  it('renders a custom tab pair (Overview/Library) when tabs prop is provided', () => {
    render(
      <TabContext.Provider value={{ tab: 'overview', setTab: vi.fn() }}>
        <BottomBar accent="#3ecf8e" hasTabs tabs={['overview', 'library']} onAsk={vi.fn()} onNav={vi.fn()} />
      </TabContext.Provider>
    )
    expect(screen.getByText('Library')).toBeInTheDocument()
    expect(screen.queryByText('Trends')).not.toBeInTheDocument()
  })

  it('clicking Library calls setTab with library', async () => {
    const user = userEvent.setup()
    const setTab = vi.fn()
    render(
      <TabContext.Provider value={{ tab: 'overview', setTab }}>
        <BottomBar accent="#3ecf8e" hasTabs tabs={['overview', 'library']} onAsk={vi.fn()} onNav={vi.fn()} />
      </TabContext.Provider>
    )
    await user.click(screen.getByText('Library'))
    expect(setTab).toHaveBeenCalledWith('library')
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:client -- BottomBar.test.tsx`
Expected: FAIL — `tabs` prop doesn't exist on `BottomBarProps` (TypeScript) and `SectionTabs` ignores it at runtime, so "Library" text is never found.

- [ ] **Step 3: Widen the `Tab` type**

In `client/src/lib/TabContext.ts`, change:
```ts
export type Tab = 'overview' | 'trends'
```
to:
```ts
export type Tab = 'overview' | 'trends' | 'library'
```

- [ ] **Step 4: Make `SectionTabs` label- and pair-aware**

In `client/src/components/BottomBar.tsx`, replace the `SectionTabs` function and `BottomBarProps`:

```tsx
const TAB_LABELS: Record<Tab, string> = {
  overview: 'Overview',
  trends: 'Trends',
  library: 'Library',
}

function SectionTabs({ tab, onTab, tabs }: { tab: Tab; onTab: (t: Tab) => void; tabs: [Tab, Tab] }) {
  return (
    <div style={{ clipPath: oct(7), background: hexA(MX4_COLOR, 0.45), padding: 1.5, flexShrink: 0 }}>
      <div style={{ clipPath: oct(6), background: COLORS.base, display: 'flex', gap: 3, padding: 3 }}>
        {tabs.map(t => {
          const active = tab === t
          return (
            <button
              key={t}
              onClick={() => onTab(t)}
              style={{
                fontFamily: FONT_MONO,
                fontSize: 10.5,
                fontWeight: 700,
                letterSpacing: '0.1em',
                textTransform: 'uppercase' as const,
                padding: '7px 14px',
                border: 'none',
                cursor: 'pointer',
                clipPath: oct(4),
                background: active ? hexA(MX4_COLOR, 0.2) : 'transparent',
                color: active ? MX4_COLOR : COLORS.textMuted,
              }}
            >
              {TAB_LABELS[t]}
            </button>
          )
        })}
      </div>
    </div>
  )
}

interface BottomBarProps {
  accent: string
  hasTabs?: boolean
  tabs?: [Tab, Tab]
  onAsk: () => void
  onNav: () => void
}
```

And update the `BottomBar` function signature and its `SectionTabs` call site:

```tsx
export function BottomBar({ hasTabs = false, tabs = ['overview', 'trends'], onAsk, onNav }: BottomBarProps) {
```
```tsx
            <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
              <SectionTabs tab={tab} onTab={setTab} tabs={tabs} />
            </div>
```

- [ ] **Step 5: Forward `tabs` through `AppShell`**

In `client/src/components/AppShell.tsx`, add `tabs?: [Tab, Tab]` to `AppShellProps` (import `Tab` from `../lib/TabContext`), destructure it in the function signature, and pass it to `<BottomBar accent={accent} hasTabs={hasTabs} tabs={tabs} ... />`.

- [ ] **Step 6: Run test to verify it passes**

Run: `npm run test:client -- BottomBar.test.tsx`
Expected: PASS, all tests including the two new ones and the six pre-existing ones (default `['overview','trends']` behavior unchanged).

- [ ] **Step 7: Regression check — Recovery**

`npx tsc --noEmit` (client). Then `npm run build:client`, `/run`, Playwright `browser_navigate` to `/recovery`, confirm the Overview/Trends dock toggle still renders and switches tabs correctly, `browser_take_screenshot`, `browser_close`. This is a shared-component change touching all 4 built sections' docks — verify before building on top of it.

- [ ] **Step 8: Commit**

```bash
git add client/src/lib/TabContext.ts client/src/components/BottomBar.tsx client/src/components/AppShell.tsx tests/client/components/BottomBar.test.tsx
git commit -m "feat: generalize BottomBar tab pair to support Overview/Library"
```

---

### Task 3: Backend gaps — recipe storage + food deletion

The handoff's Library screen needs two things the merged backend (PR #136) doesn't have: persisted recipe composition, and a way to delete a food. `foreign_keys = ON` is set in `server/db/client.ts`, so both deletes must handle FK-constraint failures explicitly instead of raw 500s.

**Files:**
- Modify: `server/db/schema.sql`
- Modify: `server/api/nutrition.ts`
- Test: `tests/server/nutrition.test.ts`

**Interfaces:**
- Produces: `GET /api/nutrition/recipes` → `{ recipes: Recipe[] }`
- Produces: `POST /api/nutrition/recipes` → `201 { id, name, servings, food_id, created_at, food: Food }` or `400 { error }`
- Produces: `DELETE /api/nutrition/recipes/:id` → `200 { ok: true }` / `404` / `400 { error }` (FK-blocked)
- Produces: `DELETE /api/nutrition/foods/:id` → `200 { ok: true }` / `404` / `400 { error }` (FK-blocked)

- [ ] **Step 1: Add the schema**

Append to `server/db/schema.sql`, directly after the `nutrition_targets` table block:

```sql
-- Saved recipes. Ingredient composition is stored here so it can be inspected/re-derived
-- later; saving one also materializes a per-serving `foods` row (source='custom') so a
-- recipe logs exactly like any other saved food — no separate logging code path needed.
CREATE TABLE IF NOT EXISTS recipes (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  servings   REAL NOT NULL,
  food_id    INTEGER NOT NULL REFERENCES foods(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- One row per ingredient. Denormalized snapshot (mirrors food_log_entries) — a later edit
-- to a referenced food's macros must not silently change what a saved recipe says it used.
CREATE TABLE IF NOT EXISTS recipe_ingredients (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  recipe_id  INTEGER NOT NULL REFERENCES recipes(id),
  food_id    INTEGER REFERENCES foods(id),   -- NULL for an ad-hoc ingredient
  name       TEXT NOT NULL,
  quantity   REAL NOT NULL,
  unit       TEXT NOT NULL,
  calories   REAL,
  protein_g  REAL,
  carbs_g    REAL,
  fat_g      REAL,
  fiber_g    REAL
);
CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_recipe ON recipe_ingredients(recipe_id);
```

These are idempotent `CREATE TABLE IF NOT EXISTS` blocks in the same file `migrate()` already runs via `db.exec(schema)` on every boot — no separate migration script needed.

- [ ] **Step 2: Write the failing tests**

Add to `tests/server/nutrition.test.ts`, as a new top-level `describe` block after the existing `Targets + summary` block:

```ts
  describe('Recipes', () => {
    it('POST /api/nutrition/recipes creates a recipe, its per-serving food, and its ingredients', async () => {
      const { app } = await import('../../server/index')
      const res = await request(app).post('/api/nutrition/recipes').send({
        name: 'Protein Smoothie',
        servings: 2,
        ingredients: [
          { name: 'Protein powder', quantity: 1, unit: 'scoop', calories: 120, protein_g: 24, carbs_g: 3, fat_g: 1, fiber_g: 0 },
          { name: 'Banana', quantity: 1, unit: 'each', calories: 106, protein_g: 26, carbs_g: 27, fat_g: 0, fiber_g: 3 },
        ],
      })
      expect(res.status).toBe(201)
      expect(res.body).toMatchObject({ name: 'Protein Smoothie', servings: 2 })
      expect(res.body.food).toMatchObject({
        name: 'Protein Smoothie', default_qty: 1, default_unit: 'serving',
        calories: 113, protein_g: 25, carbs_g: 15, fat_g: 0.5, fiber_g: 1.5,
      })
    })

    it('POST /api/nutrition/recipes rejects zero servings', async () => {
      const { app } = await import('../../server/index')
      const res = await request(app).post('/api/nutrition/recipes').send({
        name: 'Bad Recipe', servings: 0, ingredients: [{ name: 'X', quantity: 1, unit: 'g', calories: 10 }],
      })
      expect(res.status).toBe(400)
    })

    it('POST /api/nutrition/recipes rejects an empty ingredient list', async () => {
      const { app } = await import('../../server/index')
      const res = await request(app).post('/api/nutrition/recipes').send({
        name: 'Empty Recipe', servings: 2, ingredients: [],
      })
      expect(res.status).toBe(400)
    })

    it('GET /api/nutrition/recipes lists saved recipes with their per-serving macros and ingredient count', async () => {
      const { app } = await import('../../server/index')
      const res = await request(app).get('/api/nutrition/recipes')
      expect(res.status).toBe(200)
      const smoothie = res.body.recipes.find((r: { name: string }) => r.name === 'Protein Smoothie')
      expect(smoothie).toBeDefined()
      expect(smoothie.ingredient_count).toBe(2)
    })

    it('DELETE /api/nutrition/recipes/:id removes the recipe, its ingredients, and its materialized food', async () => {
      const { app } = await import('../../server/index')
      const created = await request(app).post('/api/nutrition/recipes').send({
        name: 'Temp Recipe', servings: 1, ingredients: [{ name: 'X', quantity: 1, unit: 'g', calories: 50 }],
      })
      const foodId = created.body.food.id
      const del = await request(app).delete(`/api/nutrition/recipes/${created.body.id}`)
      expect(del.status).toBe(200)

      const { default: db } = await import('../../server/db/client')
      expect(db.prepare('SELECT * FROM foods WHERE id = ?').get(foodId)).toBeUndefined()
    })

    it('DELETE /api/nutrition/recipes/:id returns 404 for a nonexistent recipe', async () => {
      const { app } = await import('../../server/index')
      const res = await request(app).delete('/api/nutrition/recipes/999999')
      expect(res.status).toBe(404)
    })

    it('DELETE /api/nutrition/recipes/:id is blocked with 400 if its food has already been logged, and leaves everything intact', async () => {
      const { app } = await import('../../server/index')
      const created = await request(app).post('/api/nutrition/recipes').send({
        name: 'Logged Recipe', servings: 1, ingredients: [{ name: 'X', quantity: 1, unit: 'g', calories: 80 }],
      })
      const foodId = created.body.food.id
      await request(app).post('/api/nutrition/log').send({
        date: '2026-07-10', meal_type: 'lunch', food_id: foodId, quantity: 1, unit: 'serving',
      })

      const del = await request(app).delete(`/api/nutrition/recipes/${created.body.id}`)
      expect(del.status).toBe(400)

      const { default: db } = await import('../../server/db/client')
      expect(db.prepare('SELECT * FROM foods WHERE id = ?').get(foodId)).toBeDefined()
      expect(db.prepare('SELECT * FROM recipes WHERE id = ?').get(created.body.id)).toBeDefined()
    })
  })

  describe('Food deletion', () => {
    it('DELETE /api/nutrition/foods/:id removes an unused food', async () => {
      const { app } = await import('../../server/index')
      const created = await request(app).post('/api/nutrition/foods').send({
        name: 'Unused Food', default_qty: 100, default_unit: 'g', calories: 50,
      })
      const del = await request(app).delete(`/api/nutrition/foods/${created.body.id}`)
      expect(del.status).toBe(200)
    })

    it('DELETE /api/nutrition/foods/:id returns 404 for a nonexistent food', async () => {
      const { app } = await import('../../server/index')
      const res = await request(app).delete('/api/nutrition/foods/999999')
      expect(res.status).toBe(404)
    })

    it('DELETE /api/nutrition/foods/:id is blocked with 400 if the food has been logged', async () => {
      const { app } = await import('../../server/index')
      const created = await request(app).post('/api/nutrition/foods').send({
        name: 'Logged Food', default_qty: 100, default_unit: 'g', calories: 50,
      })
      await request(app).post('/api/nutrition/log').send({
        date: '2026-07-11', meal_type: 'snack', food_id: created.body.id, quantity: 100, unit: 'g',
      })
      const del = await request(app).delete(`/api/nutrition/foods/${created.body.id}`)
      expect(del.status).toBe(400)
    })
  })
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm run test:server -- nutrition.test.ts`
Expected: FAIL — `/recipes` and `DELETE /foods/:id` routes don't exist (404s / route-not-found).

- [ ] **Step 4: Implement the routes**

In `server/api/nutrition.ts`, add after the `GET /summary` handler (before the `localDateString`/`GET /trend` block, so route order doesn't matter here since paths don't collide):

```ts
interface RecipeIngredientInput {
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

function sumField(items: RecipeIngredientInput[], key: keyof RecipeIngredientInput): number {
  return items.reduce((s, i) => s + (Number(i[key]) || 0), 0)
}

// GET /api/nutrition/recipes — list saved recipes with their per-serving food's macros
nutritionRouter.get('/recipes', (req, res) => {
  const recipes = db.prepare(`
    SELECT r.id, r.name, r.servings, r.food_id, r.created_at,
      f.calories as per_serving_calories, f.protein_g as per_serving_protein_g,
      f.carbs_g as per_serving_carbs_g, f.fat_g as per_serving_fat_g, f.fiber_g as per_serving_fiber_g,
      (SELECT COUNT(*) FROM recipe_ingredients ri WHERE ri.recipe_id = r.id) as ingredient_count
    FROM recipes r JOIN foods f ON f.id = r.food_id
    ORDER BY r.name
  `).all()
  res.json({ recipes })
})

// POST /api/nutrition/recipes — save a recipe: computes per-serving macros from ingredients,
// creates the materialized food + the recipe + its ingredient rows in one transaction (a
// recipe without its food, or vice versa, must never exist).
nutritionRouter.post('/recipes', (req, res) => {
  const { name, servings, ingredients } = req.body as {
    name: string
    servings: number
    ingredients: RecipeIngredientInput[]
  }

  if (!servings || servings <= 0) {
    res.status(400).json({ error: 'servings must be greater than 0' })
    return
  }
  if (!ingredients || ingredients.length === 0) {
    res.status(400).json({ error: 'A recipe needs at least one ingredient' })
    return
  }

  try {
    const kcalPerServing = Math.round(sumField(ingredients, 'calories') / servings)
    const proteinPerServing = Math.round((sumField(ingredients, 'protein_g') / servings) * 100) / 100
    const carbsPerServing = Math.round((sumField(ingredients, 'carbs_g') / servings) * 100) / 100
    const fatPerServing = Math.round((sumField(ingredients, 'fat_g') / servings) * 100) / 100
    const fiberPerServing = Math.round((sumField(ingredients, 'fiber_g') / servings) * 100) / 100

    const createRecipe = db.transaction(() => {
      const foodInfo = db.prepare(`
        INSERT INTO foods (source, name, default_qty, default_unit, calories, protein_g, carbs_g, fat_g, fiber_g)
        VALUES ('custom', ?, 1, 'serving', ?, ?, ?, ?, ?)
      `).run(name, kcalPerServing, proteinPerServing, carbsPerServing, fatPerServing, fiberPerServing)
      const foodId = foodInfo.lastInsertRowid

      const recipeInfo = db.prepare(
        'INSERT INTO recipes (name, servings, food_id) VALUES (?, ?, ?)'
      ).run(name, servings, foodId)
      const recipeId = recipeInfo.lastInsertRowid

      const insertIngredient = db.prepare(`
        INSERT INTO recipe_ingredients (recipe_id, food_id, name, quantity, unit, calories, protein_g, carbs_g, fat_g, fiber_g)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      for (const ing of ingredients) {
        insertIngredient.run(
          recipeId, ing.food_id ?? null, ing.name, ing.quantity, ing.unit,
          ing.calories ?? null, ing.protein_g ?? null, ing.carbs_g ?? null, ing.fat_g ?? null, ing.fiber_g ?? null,
        )
      }
      return { recipeId, foodId }
    })

    const { recipeId, foodId } = createRecipe()
    const recipe = db.prepare('SELECT * FROM recipes WHERE id = ?').get(recipeId) as object
    const food = db.prepare('SELECT * FROM foods WHERE id = ?').get(foodId)
    res.status(201).json({ ...recipe, food })
  } catch (err: unknown) {
    console.error('[nutrition] recipe save failed:', err)
    res.status(400).json({ error: 'Could not save recipe' })
  }
})

function isForeignKeyError(err: unknown): boolean {
  return err instanceof Error && err.message.includes('FOREIGN KEY constraint failed')
}

// DELETE /api/nutrition/recipes/:id — deletes the recipe, its ingredients, and its
// materialized food as one unit. Blocked (400) if that food has already been logged
// elsewhere — food_log_entries keeps its own denormalized snapshot, but the food_id
// reference itself must stay valid, so the delete is refused rather than silently
// orphaning past log entries or leaving a half-deleted recipe.
nutritionRouter.delete('/recipes/:id', (req, res) => {
  const { id } = req.params
  const recipe = db.prepare('SELECT * FROM recipes WHERE id = ?').get(id) as { food_id: number } | undefined
  if (!recipe) {
    res.status(404).json({ error: 'Recipe not found' })
    return
  }
  try {
    const deleteRecipe = db.transaction(() => {
      db.prepare('DELETE FROM recipe_ingredients WHERE recipe_id = ?').run(id)
      db.prepare('DELETE FROM recipes WHERE id = ?').run(id)
      db.prepare('DELETE FROM foods WHERE id = ?').run(recipe.food_id)
    })
    deleteRecipe()
    res.json({ ok: true })
  } catch (err: unknown) {
    if (isForeignKeyError(err)) {
      res.status(400).json({ error: 'Cannot delete — this recipe has already been logged' })
      return
    }
    console.error('[nutrition] recipe delete failed:', err)
    res.status(400).json({ error: 'Could not delete recipe' })
  }
})

// DELETE /api/nutrition/foods/:id — remove a saved food. Blocked (400) if the food has
// ever been logged or used as a recipe ingredient, for the same reason as recipe deletion
// above: those rows must keep a valid food_id reference.
nutritionRouter.delete('/foods/:id', (req, res) => {
  const { id } = req.params
  try {
    const info = db.prepare('DELETE FROM foods WHERE id = ?').run(id)
    if (info.changes === 0) {
      res.status(404).json({ error: 'Food not found' })
      return
    }
    res.json({ ok: true })
  } catch (err: unknown) {
    if (isForeignKeyError(err)) {
      res.status(400).json({ error: 'Cannot delete — this food has been logged or used in a recipe' })
      return
    }
    console.error('[nutrition] food delete failed:', err)
    res.status(400).json({ error: 'Could not delete food' })
  }
})
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm run test:server -- nutrition.test.ts`
Expected: PASS, all tests including the 10 new ones.

Then the full suite and both typechecks: `npm test && npx tsc --noEmit && npx tsc -p tsconfig.server.json --noEmit` — all green.

- [ ] **Step 6: Commit**

```bash
git add server/db/schema.sql server/api/nutrition.ts tests/server/nutrition.test.ts
git commit -m "feat: add recipe storage and food deletion to the nutrition API"
```

---

---

## Phase B — Client data layer

### Task 4: `nutritionApi.ts` fetch layer

Mirrors the shape of `client/src/lib/garminApi.ts`: typed fetch wrappers, no state, no caching (caching lives in the hook, Task 5).

**Files:**
- Create: `client/src/lib/nutritionApi.ts`
- Test: `tests/client/lib/nutritionApi.test.ts`

**Interfaces:**
- Produces: `FoodLogEntry`, `MealGroup`, `DailyTotals`, `LogResponse`, `LogEntryInput`, `NutritionTarget`, `NutritionSummary`, `Food`, `RecipeIngredientInput`, `Recipe` types
- Produces: `fetchLog`, `createLogEntry`, `updateLogEntry`, `deleteLogEntry`, `fetchTargets`, `saveTargets`, `fetchSummary`, `searchFoods`, `createFood`, `deleteFood`, `fetchRecipes`, `createRecipe`, `deleteRecipe` functions

- [ ] **Step 1: Write the failing tests**

Create `tests/client/lib/nutritionApi.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fetchLog, createLogEntry, deleteLogEntry, fetchSummary, searchFoods, createRecipe } from '../../../client/src/lib/nutritionApi'

const mockFetch = vi.fn()

beforeEach(() => {
  global.fetch = mockFetch as unknown as typeof fetch
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('nutritionApi', () => {
  it('fetchLog calls GET /api/nutrition/log with the date and returns the parsed body', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ meals: {}, daily: { calories: 0 } }) })
    const result = await fetchLog('2026-07-13')
    expect(mockFetch).toHaveBeenCalledWith('/api/nutrition/log?date=2026-07-13')
    expect(result.daily.calories).toBe(0)
  })

  it('fetchLog throws on a non-ok response', async () => {
    mockFetch.mockResolvedValue({ ok: false })
    await expect(fetchLog('2026-07-13')).rejects.toThrow()
  })

  it('createLogEntry POSTs the entry and returns the created row', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ id: 1, name: 'Oats' }) })
    const result = await createLogEntry({ date: '2026-07-13', meal_type: 'breakfast', quantity: 1, unit: 'serving' })
    expect(mockFetch).toHaveBeenCalledWith('/api/nutrition/log', expect.objectContaining({ method: 'POST' }))
    expect(result.name).toBe('Oats')
  })

  it('createLogEntry surfaces the server error message on failure', async () => {
    mockFetch.mockResolvedValue({ ok: false, json: async () => ({ error: 'Unit mismatch' }) })
    await expect(createLogEntry({ date: '2026-07-13', meal_type: 'breakfast', quantity: 1, unit: 'oz' }))
      .rejects.toThrow('Unit mismatch')
  })

  it('deleteLogEntry calls DELETE on the entry id', async () => {
    mockFetch.mockResolvedValue({ ok: true })
    await deleteLogEntry(42)
    expect(mockFetch).toHaveBeenCalledWith('/api/nutrition/log/42', expect.objectContaining({ method: 'DELETE' }))
  })

  it('fetchSummary returns target/actual/remaining', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ target: null, actual: {}, remaining: {} }) })
    const result = await fetchSummary('2026-07-13')
    expect(result.target).toBeNull()
  })

  it('searchFoods returns an empty array on a non-ok response instead of throwing', async () => {
    mockFetch.mockResolvedValue({ ok: false })
    const result = await searchFoods('oat')
    expect(result).toEqual([])
  })

  it('createRecipe POSTs name/servings/ingredients and returns the created recipe+food', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ id: 1, food: { id: 2 } }) })
    const result = await createRecipe({ name: 'Smoothie', servings: 2, ingredients: [{ name: 'Banana', quantity: 1, unit: 'each' }] })
    expect(mockFetch).toHaveBeenCalledWith('/api/nutrition/recipes', expect.objectContaining({ method: 'POST' }))
    expect(result.food.id).toBe(2)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:client -- nutritionApi.test.ts`
Expected: FAIL — `client/src/lib/nutritionApi.ts` doesn't exist.

- [ ] **Step 3: Implement**

Create `client/src/lib/nutritionApi.ts`:

```ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:client -- nutritionApi.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add client/src/lib/nutritionApi.ts tests/client/lib/nutritionApi.test.ts
git commit -m "feat: add nutritionApi client fetch layer"
```

---

### Task 5: `useNutritionLog` hook

Date-scoped log + summary fetch, mirroring `useRecoveryData`'s cache-first / refresh-trigger shape but keyed by date (recovery has no date parameter, nutrition does — cache key must include it).

**Files:**
- Create: `client/src/hooks/useNutritionLog.ts`
- Test: `tests/client/hooks/useNutritionLog.test.ts`

**Interfaces:**
- Consumes: `fetchLog(date)`, `fetchSummary(date)` from `nutritionApi.ts` (Task 4)
- Produces: `useNutritionLog(date: string): { log: LogResponse | null; summary: NutritionSummary | null; loading: boolean; refresh: () => void }`

- [ ] **Step 1: Write the failing test**

Create `tests/client/hooks/useNutritionLog.test.ts`:

```ts
import { renderHook, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'

vi.mock('../../../client/src/lib/nutritionApi', () => ({
  fetchLog: vi.fn(),
  fetchSummary: vi.fn(),
}))

import { fetchLog, fetchSummary } from '../../../client/src/lib/nutritionApi'
import { useNutritionLog } from '../../../client/src/hooks/useNutritionLog'

const mockFetchLog = fetchLog as ReturnType<typeof vi.fn>
const mockFetchSummary = fetchSummary as ReturnType<typeof vi.fn>

beforeEach(() => {
  mockFetchLog.mockResolvedValue({ meals: {}, daily: { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0 } })
  mockFetchSummary.mockResolvedValue({ target: null, actual: { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0 }, remaining: { calories: null, protein_g: null, carbs_g: null, fat_g: null, fiber_g: null } })
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('useNutritionLog', () => {
  it('fetches log and summary for the given date on mount', async () => {
    const { result } = renderHook(() => useNutritionLog('2026-07-13'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(mockFetchLog).toHaveBeenCalledWith('2026-07-13')
    expect(mockFetchSummary).toHaveBeenCalledWith('2026-07-13')
    expect(result.current.log).not.toBeNull()
    expect(result.current.summary).not.toBeNull()
  })

  it('refetches when the date argument changes', async () => {
    const { result, rerender } = renderHook(({ date }) => useNutritionLog(date), { initialProps: { date: '2026-07-13' } })
    await waitFor(() => expect(result.current.loading).toBe(false))
    rerender({ date: '2026-07-14' })
    await waitFor(() => expect(mockFetchLog).toHaveBeenCalledWith('2026-07-14'))
  })

  it('refresh() re-fetches the current date', async () => {
    const { result } = renderHook(() => useNutritionLog('2026-07-13'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    mockFetchLog.mockClear()
    result.current.refresh()
    await waitFor(() => expect(mockFetchLog).toHaveBeenCalledWith('2026-07-13'))
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:client -- useNutritionLog.test.ts`
Expected: FAIL — `client/src/hooks/useNutritionLog.ts` doesn't exist.

- [ ] **Step 3: Implement**

Create `client/src/hooks/useNutritionLog.ts`:

```ts
import { useState, useEffect, useCallback } from 'react'
import { fetchLog, fetchSummary, type LogResponse, type NutritionSummary } from '../lib/nutritionApi'

export function useNutritionLog(date: string): {
  log: LogResponse | null
  summary: NutritionSummary | null
  loading: boolean
  refresh: () => void
} {
  const [log, setLog] = useState<LogResponse | null>(null)
  const [summary, setSummary] = useState<NutritionSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  const refresh = useCallback(() => setRefreshTrigger(n => n + 1), [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    async function load() {
      try {
        const [logData, summaryData] = await Promise.all([fetchLog(date), fetchSummary(date)])
        if (cancelled) return
        setLog(logData)
        setSummary(summaryData)
      } catch {
        // keep previous data on error
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [date, refreshTrigger])

  return { log, summary, loading, refresh }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:client -- useNutritionLog.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add client/src/hooks/useNutritionLog.ts tests/client/hooks/useNutritionLog.test.ts
git commit -m "feat: add useNutritionLog hook"
```

---

## Phase C — Page shell + Overview

### Task 6: Date helpers + page shell (minimal Overview/Library)

Creates the real page shell wired end-to-end (route → tabs → hook → empty states), so every later task edits existing, already-working files instead of filling in placeholders.

**Files:**
- Create: `client/src/lib/nutritionDate.ts`
- Test: `tests/client/lib/nutritionDate.test.ts`
- Create: `client/src/pages/nutrition/NutritionOverview.tsx`
- Create: `client/src/pages/nutrition/NutritionLibrary.tsx`
- Modify: `client/src/pages/NutritionPage.tsx`
- Modify: `client/src/theme.ts` (add `'nutrition'` to `BUILT_SECTIONS`)
- Modify: `client/src/lib/stubData.ts` (add `BRIEFS.nutrition`)
- Test: `tests/client/pages/NutritionPage.test.tsx`

**Interfaces:**
- Produces: `todayLocal()`, `addDaysLocal(date, delta)`, `relativeDayLabel(date)`, `absoluteDateLabel(date)` from `nutritionDate.ts`
- Consumes: `useNutritionLog` (Task 5), `AppShell` `tabs` prop (Task 2)

- [ ] **Step 1: Write the failing date-helper tests**

Create `tests/client/lib/nutritionDate.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { addDaysLocal, relativeDayLabel, absoluteDateLabel, todayLocal } from '../../../client/src/lib/nutritionDate'

describe('nutritionDate', () => {
  it('addDaysLocal adds and subtracts days correctly across a month boundary', () => {
    expect(addDaysLocal('2026-07-31', 1)).toBe('2026-08-01')
    expect(addDaysLocal('2026-08-01', -1)).toBe('2026-07-31')
  })

  it('relativeDayLabel returns TODAY/YESTERDAY/TOMORROW for the immediate cases', () => {
    const today = todayLocal()
    expect(relativeDayLabel(today)).toBe('TODAY')
    expect(relativeDayLabel(addDaysLocal(today, -1))).toBe('YESTERDAY')
    expect(relativeDayLabel(addDaysLocal(today, 1))).toBe('TOMORROW')
  })

  it('relativeDayLabel returns "N DAYS AGO" / "IN N DAYS" beyond the immediate cases', () => {
    const today = todayLocal()
    expect(relativeDayLabel(addDaysLocal(today, -3))).toBe('3 DAYS AGO')
    expect(relativeDayLabel(addDaysLocal(today, 3))).toBe('IN 3 DAYS')
  })

  it('absoluteDateLabel formats as WEEKDAY · MON D', () => {
    expect(absoluteDateLabel('2026-07-12')).toBe('SUN · JUL 12')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:client -- nutritionDate.test.ts`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement date helpers**

Create `client/src/lib/nutritionDate.ts`:

```ts
export function todayLocal(): string {
  return new Date().toLocaleDateString('en-CA')
}

export function addDaysLocal(date: string, delta: number): string {
  const [y, m, d] = date.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() + delta)
  return dt.toLocaleDateString('en-CA')
}

function daysBetween(from: string, to: string): number {
  const [fy, fm, fd] = from.split('-').map(Number)
  const [ty, tm, td] = to.split('-').map(Number)
  const fromMs = Date.UTC(fy, fm - 1, fd)
  const toMs = Date.UTC(ty, tm - 1, td)
  return Math.round((fromMs - toMs) / 86400000)
}

export function relativeDayLabel(date: string): string {
  const diff = daysBetween(date, todayLocal())
  if (diff === 0) return 'TODAY'
  if (diff === -1) return 'YESTERDAY'
  if (diff === 1) return 'TOMORROW'
  return diff < 0 ? `${-diff} DAYS AGO` : `IN ${diff} DAYS`
}

export function absoluteDateLabel(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  const weekday = dt.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()
  const month = dt.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()
  return `${weekday} · ${month} ${d}`
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:client -- nutritionDate.test.ts`
Expected: PASS.

- [ ] **Step 5: Add the BRIEFS.nutrition stub entry**

`MX4Briefing`'s `brief` prop is required (pre-load placeholder line before `useBriefing` resolves) — every other section has one in `client/src/lib/stubData.ts`. Add, inside `export const BRIEFS`:

```ts
  nutrition: {
    tone: 'positive', mood: 'transmit', meta: 'STANDING BY',
    line: 'Nutrition channel online. Logging summary and standing will surface here once the day has entries.',
    chips: [['KCAL', '—/—'], ['LOGGED', '0'], ['FLAGS', '0']],
  },
```

- [ ] **Step 6: Add `'nutrition'` to `BUILT_SECTIONS`**

In `client/src/theme.ts`, change:
```ts
export const BUILT_SECTIONS: SectionKey[] = ['home', 'recovery', 'sleep', 'training']
```
to:
```ts
export const BUILT_SECTIONS: SectionKey[] = ['home', 'recovery', 'sleep', 'training', 'nutrition']
```

- [ ] **Step 7: Create the minimal Overview**

Create `client/src/pages/nutrition/NutritionOverview.tsx`:

```tsx
import { useState } from 'react'
import { COLORS, FONT_MONO, SECTION_ACCENTS } from '../../theme'
import { hexA } from '../../lib/hexA'
import { useNutritionLog } from '../../hooks/useNutritionLog'
import { todayLocal, addDaysLocal, relativeDayLabel, absoluteDateLabel } from '../../lib/nutritionDate'

const A = SECTION_ACCENTS.nutrition

export function NutritionOverview() {
  const [date, setDate] = useState(todayLocal())
  const { log, loading } = useNutritionLog(date)
  const isToday = date === todayLocal()

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <button
          aria-label="Previous day"
          onClick={() => setDate(d => addDaysLocal(d, -1))}
          style={{
            width: 34, height: 34, borderRadius: 8, border: `1px solid ${COLORS.line}`,
            background: COLORS.surface, color: COLORS.textSecondary, cursor: 'pointer',
          }}
        >‹</button>
        <button
          onClick={() => setDate(todayLocal())}
          style={{
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
            padding: '8px 0', borderRadius: 8, cursor: 'pointer', background: COLORS.surface,
            border: `1px solid ${isToday ? hexA(A, 0.5) : COLORS.line}`,
          }}
        >
          <span style={{ fontFamily: FONT_MONO, fontSize: 10.5, fontWeight: 700, color: A }}>
            {relativeDayLabel(date)}
          </span>
          <span style={{ fontFamily: FONT_MONO, fontSize: 8, color: COLORS.textMuted }}>
            {absoluteDateLabel(date)}
          </span>
        </button>
        <button
          aria-label="Next day"
          onClick={() => setDate(d => addDaysLocal(d, 1))}
          style={{
            width: 34, height: 34, borderRadius: 8, border: `1px solid ${COLORS.line}`,
            background: COLORS.surface, color: COLORS.textSecondary, cursor: 'pointer',
          }}
        >›</button>
      </div>

      {!loading && log && Object.keys(log.meals).length === 0 && (
        <p style={{ fontFamily: FONT_MONO, fontSize: 10, color: COLORS.textMuted, textAlign: 'center', padding: '24px 0' }}>
          NO ENTRIES LOGGED {isToday ? 'YET TODAY' : 'THIS DAY'}
        </p>
      )}
    </>
  )
}
```

- [ ] **Step 8: Create the minimal Library**

Create `client/src/pages/nutrition/NutritionLibrary.tsx`:

```tsx
import { Rail } from '../../components/viz/Rail'
import { SECTION_ACCENTS, COLORS, FONT_MONO } from '../../theme'

const A = SECTION_ACCENTS.nutrition

export function NutritionLibrary() {
  return (
    <>
      <Rail label="FOOD LIBRARY" accent={A} right="0 FOODS · 0 RECIPES" />
      <p style={{ fontFamily: FONT_MONO, fontSize: 10, color: COLORS.textMuted, textAlign: 'center', padding: '24px 0' }}>
        NO SAVED FOODS YET
      </p>
    </>
  )
}
```

- [ ] **Step 9: Wire the page shell**

Replace the contents of `client/src/pages/NutritionPage.tsx`:

```tsx
import { AppShell } from '../components/AppShell'
import { useTab } from '../lib/TabContext'
import { NutritionOverview } from './nutrition/NutritionOverview'
import { NutritionLibrary } from './nutrition/NutritionLibrary'

function NutritionContent() {
  const tab = useTab()
  return tab === 'library' ? <NutritionLibrary /> : <NutritionOverview />
}

export function NutritionPage() {
  return (
    <AppShell section="nutrition" hasTabs tabs={['overview', 'library']}>
      <NutritionContent />
    </AppShell>
  )
}
```

- [ ] **Step 10: Write the page-level test**

Create `tests/client/pages/NutritionPage.test.tsx`:

```tsx
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { NutritionPage } from '../../../client/src/pages/NutritionPage'

vi.mock('../../../client/src/lib/nutritionApi', () => ({
  fetchLog: vi.fn().mockResolvedValue({ meals: {}, daily: { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0 } }),
  fetchSummary: vi.fn().mockResolvedValue({ target: null, actual: { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0 }, remaining: { calories: null, protein_g: null, carbs_g: null, fat_g: null, fiber_g: null } }),
}))

beforeEach(() => {
  // Well-formed, not `{}` — MX4Briefing (wired in Task 8) reads liveData.tone unconditionally
  // once liveData is non-null, so a shape-less mock would throw on liveData.tone.toLowerCase().
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ tone: 'POSITIVE', headline: '', body: '', recommendation: '', flags: [] }),
  }) as unknown as typeof fetch
})

describe('NutritionPage', () => {
  it('renders the day navigator on the Overview tab by default', async () => {
    render(<MemoryRouter initialEntries={['/nutrition']}><NutritionPage /></MemoryRouter>)
    expect(await screen.findByText('TODAY')).toBeInTheDocument()
  })

  it('shows the empty-log message once loading resolves with no entries', async () => {
    render(<MemoryRouter initialEntries={['/nutrition']}><NutritionPage /></MemoryRouter>)
    await waitFor(() => expect(screen.getByText('NO ENTRIES LOGGED YET TODAY')).toBeInTheDocument())
  })

  it('switches to Library when the Library tab is clicked', async () => {
    render(<MemoryRouter initialEntries={['/nutrition']}><NutritionPage /></MemoryRouter>)
    const user = (await import('@testing-library/user-event')).default.setup()
    await user.click(screen.getByText('Library'))
    expect(await screen.findByText('NO SAVED FOODS YET')).toBeInTheDocument()
  })
})
```

- [ ] **Step 11: Run tests to verify they pass**

Run: `npm run test:client -- NutritionPage.test.tsx nutritionDate.test.ts`
Expected: PASS.

Then `npx tsc --noEmit` — clean.

- [ ] **Step 12: Visual check**

`npm run build:client`, `/run`, Playwright to `/nutrition` — confirm the day navigator renders in section-accent green (`#3ecf8e`) and the Overview/Library dock toggle works. `browser_close`.

- [ ] **Step 13: Commit**

```bash
git add client/src/lib/nutritionDate.ts client/src/pages/nutrition/ client/src/pages/NutritionPage.tsx client/src/theme.ts client/src/lib/stubData.ts tests/client/lib/nutritionDate.test.ts tests/client/pages/NutritionPage.test.tsx
git commit -m "feat: wire Nutrition page shell with day navigator and empty states"
```

---

### Task 7: Ledger hero, rail, and sparse meal groups

Extends `NutritionOverview.tsx` (created in Task 6) with the real day-ledger content. Per README §"Overview": rail label, hero card (remaining/budget/ended-day states, 4 macro rows), meal groups rendered only from present keys, missing-meal affordances for the four standard types. Buttons that open a sheet (`+ ADD TO {MEAL}`, entry tap-to-edit) are rendered inert here — `onClick` wiring lands in Tasks 9–11 once the sheets exist.

**Files:**
- Modify: `client/src/pages/nutrition/NutritionOverview.tsx`
- Test: `tests/client/pages/nutrition/NutritionOverview.test.tsx`

**Interfaces:**
- Consumes: `useNutritionLog(date)` → `{ log, summary, loading, refresh }` (Task 5), `MealGroup`, `NutritionSummary` types (Task 4)

- [ ] **Step 1: Write the failing test**

Create `tests/client/pages/nutrition/NutritionOverview.test.tsx`:

```tsx
import { render, screen, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { NutritionOverview } from '../../../../client/src/pages/nutrition/NutritionOverview'

vi.mock('../../../../client/src/lib/nutritionApi', () => ({
  fetchLog: vi.fn(),
  fetchSummary: vi.fn(),
}))

import { fetchLog, fetchSummary } from '../../../../client/src/lib/nutritionApi'
const mockFetchLog = fetchLog as ReturnType<typeof vi.fn>
const mockFetchSummary = fetchSummary as ReturnType<typeof vi.fn>

beforeEach(() => {
  mockFetchLog.mockResolvedValue({
    meals: {
      breakfast: {
        entries: [{ id: 1, meal_type: 'breakfast', food_id: null, name: 'Oatmeal', quantity: 200, unit: 'g', calories: 778, protein_g: 33.8, carbs_g: 132.6, fat_g: 13.8, fiber_g: 21.2, logged_at: '' }],
        totals: { calories: 778, protein_g: 33.8, carbs_g: 132.6, fat_g: 13.8, fiber_g: 21.2 },
      },
    },
    daily: { calories: 778, protein_g: 33.8, carbs_g: 132.6, fat_g: 13.8, fiber_g: 21.2 },
  })
  mockFetchSummary.mockResolvedValue({
    target: { date: '2026-07-01', calories: 2200, protein_g: 138, carbs_g: 220, fat_g: 60, fiber_g: 30 },
    actual: { calories: 778, protein_g: 33.8, carbs_g: 132.6, fat_g: 13.8, fiber_g: 21.2 },
    remaining: { calories: 1422, protein_g: 104.2, carbs_g: 87.4, fat_g: 46.2, fiber_g: 8.8 },
  })
  // Task 8 adds MX4Briefing, which fetches /api/insights/nutrition via useBriefing. Mocked
  // here (not just in Task 8) so this file's fetch behavior is defined from the start rather
  // than relying on environment-dependent fetch availability. Must be well-formed, not `{}` —
  // MX4Briefing reads liveData.tone unconditionally once liveData is non-null.
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ tone: 'POSITIVE', headline: '', body: '', recommendation: '', flags: [] }),
  }) as unknown as typeof fetch
})

describe('NutritionOverview — ledger', () => {
  it('renders the hero remaining-kcal value from summary', async () => {
    render(<NutritionOverview />)
    await waitFor(() => expect(screen.getByText('1422')).toBeInTheDocument())
  })

  it('renders only meal groups present in the log response (sparse)', async () => {
    render(<NutritionOverview />)
    await waitFor(() => expect(screen.getByText('Oatmeal')).toBeInTheDocument())
    expect(screen.queryByText('DINNER')).not.toBeInTheDocument() // no header for a meal with no entries
  })

  it('renders a NOT LOGGED YET affordance for standard meals with no entries', async () => {
    render(<NutritionOverview />)
    await waitFor(() => expect(screen.getAllByText('NOT LOGGED YET').length).toBe(3)) // lunch, dinner, snack
  })

  it('renders "—" for a null macro on an entry instead of 0', async () => {
    mockFetchLog.mockResolvedValue({
      meals: {
        breakfast: {
          entries: [{ id: 2, meal_type: 'breakfast', food_id: null, name: 'Coffee', quantity: 1, unit: 'cup', calories: 45, protein_g: null, carbs_g: null, fat_g: null, fiber_g: null, logged_at: '' }],
          totals: { calories: 45, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0 },
        },
      },
      daily: { calories: 45, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0 },
    })
    render(<NutritionOverview />)
    await waitFor(() => expect(screen.getByText('P — · C — · F —')).toBeInTheDocument())
  })

  it('shows NO TARGET SET when summary.target is null, not a crash', async () => {
    mockFetchSummary.mockResolvedValue({
      target: null,
      actual: { calories: 778, protein_g: 33.8, carbs_g: 132.6, fat_g: 13.8, fiber_g: 21.2 },
      remaining: { calories: null, protein_g: null, carbs_g: null, fat_g: null, fiber_g: null },
    })
    render(<NutritionOverview />)
    await waitFor(() => expect(screen.getByText('NO TARGET SET · SET ›')).toBeInTheDocument())
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:client -- NutritionOverview.test.tsx`
Expected: FAIL — hero/meal-group markup doesn't exist yet (Task 6 only has the day nav + empty-state message).

- [ ] **Step 3: Implement**

Replace `client/src/pages/nutrition/NutritionOverview.tsx` with:

```tsx
import { useState } from 'react'
import { COLORS, FONT_MONO, FONT_UI, SECTION_ACCENTS } from '../../theme'
import { hexA } from '../../lib/hexA'
import { useNutritionLog } from '../../hooks/useNutritionLog'
import { todayLocal, addDaysLocal, relativeDayLabel, absoluteDateLabel } from '../../lib/nutritionDate'
import type { MealGroup, NutritionSummary } from '../../lib/nutritionApi'
import { Rail } from '../../components/viz/Rail'

const A = SECTION_ACCENTS.nutrition
const MEAL_ORDER = ['breakfast', 'lunch', 'dinner', 'snack'] as const

function orderedMealKeys(meals: Record<string, MealGroup>): string[] {
  const known = MEAL_ORDER.filter(m => m in meals)
  const custom = Object.keys(meals).filter(k => !(MEAL_ORDER as readonly string[]).includes(k))
  return [...known, ...custom]
}

function macroText(remaining: number | null): string {
  if (remaining == null) return '—'
  return remaining < 0 ? `${Math.abs(remaining)} g over` : `${remaining} g left`
}

function MacroRow({ label, remaining, target }: { label: string; remaining: number | null; target: number | null }) {
  const over = remaining != null && remaining < 0
  const pct = target != null && target > 0 && remaining != null
    ? Math.min(100, Math.max(0, ((target - remaining) / target) * 100))
    : 0
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
      <span style={{ fontFamily: FONT_MONO, fontSize: 9, color: COLORS.textSecondary, width: 52, flexShrink: 0 }}>{label}</span>
      <div style={{ flex: 1, height: 6, borderRadius: 3, background: hexA(COLORS.textMuted, 0.15), overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: over ? COLORS.amber : A }} />
      </div>
      <span style={{ fontFamily: FONT_MONO, fontSize: 9, color: COLORS.textMuted, width: 92, textAlign: 'right', flexShrink: 0 }}>
        {macroText(remaining)}
      </span>
    </div>
  )
}

function LedgerHero({ summary, date }: { summary: NutritionSummary | null; date: string }) {
  const today = todayLocal()
  const isPast = date < today
  const isFuture = date > today
  const label = isPast ? 'ENDED THE DAY' : isFuture ? 'BUDGET' : 'REMAINING TODAY'
  const remainingKcal = summary?.remaining.calories ?? null
  const targetKcal = summary?.target?.calories ?? null
  const actualKcal = summary?.actual.calories ?? 0
  const over = remainingKcal != null && remainingKcal < 0

  return (
    <div style={{
      position: 'relative', background: `linear-gradient(150deg, ${hexA(A, 0.1)}, ${COLORS.surface} 60%)`,
      border: `1px solid ${hexA(A, 0.32)}`, borderRadius: 13, padding: '15px 16px', marginBottom: 9,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div>
          <div style={{ fontFamily: FONT_MONO, fontSize: 9, color: COLORS.textSecondary, letterSpacing: '0.1em', marginBottom: 4 }}>{label}</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
            <span style={{ fontFamily: FONT_MONO, fontSize: 34, fontWeight: 700, color: COLORS.text }}>
              {remainingKcal == null ? '—' : `${over ? '−' : ''}${Math.abs(remainingKcal)}`}
            </span>
            <span style={{ fontFamily: FONT_MONO, fontSize: 11, color: COLORS.textMuted }}>kcal</span>
          </div>
          <div style={{ fontFamily: FONT_MONO, fontSize: 9, color: COLORS.textMuted, marginTop: 2 }}>
            {actualKcal} logged{targetKcal != null ? ` · target ${targetKcal}` : ''}
          </div>
        </div>
        {remainingKcal != null && (
          <span style={{
            fontFamily: FONT_MONO, fontSize: 9, fontWeight: 700, letterSpacing: '0.08em',
            padding: '4px 9px', borderRadius: 20, background: hexA(A, 0.15), color: A, border: `1px solid ${hexA(A, 0.4)}`,
          }}>
            {Math.abs(remainingKcal)} {over ? 'OVER' : 'UNDER'} TARGET
          </span>
        )}
      </div>
      <MacroRow label="PROTEIN" remaining={summary?.remaining.protein_g ?? null} target={summary?.target?.protein_g ?? null} />
      <MacroRow label="CARBS" remaining={summary?.remaining.carbs_g ?? null} target={summary?.target?.carbs_g ?? null} />
      <MacroRow label="FAT" remaining={summary?.remaining.fat_g ?? null} target={summary?.target?.fat_g ?? null} />
      <MacroRow label="FIBER" remaining={summary?.remaining.fiber_g ?? null} target={summary?.target?.fiber_g ?? null} />
    </div>
  )
}

function MealGroupCard({ mealKey, group }: { mealKey: string; group: MealGroup }) {
  return (
    <div style={{ marginBottom: 9 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{ fontFamily: FONT_MONO, fontSize: 10, fontWeight: 700, color: A, letterSpacing: '0.1em' }}>
          {mealKey.toUpperCase()}
        </span>
        <span style={{ flex: 1, height: 1, background: COLORS.line }} />
        <span style={{ fontFamily: FONT_MONO, fontSize: 9, color: COLORS.textMuted }}>{group.totals.calories} KCAL</span>
      </div>
      {group.entries.map(entry => (
        <div key={entry.id} style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          borderLeft: `2px solid ${A}`, background: COLORS.surface, borderRadius: 6,
          padding: '9px 11px', marginBottom: 6,
        }}>
          <div>
            <div style={{ fontFamily: FONT_UI, fontSize: 13.5, fontWeight: 600, color: COLORS.text }}>{entry.name}</div>
            <div style={{ fontFamily: FONT_MONO, fontSize: 9, color: COLORS.textMuted }}>
              {entry.quantity} {entry.unit} · {entry.food_id != null ? 'saved food' : 'ad-hoc'}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontFamily: FONT_MONO, fontSize: 15, fontWeight: 700, color: COLORS.text }}>
              {entry.calories == null ? '—' : entry.calories} <span style={{ fontSize: 10, fontWeight: 400, color: COLORS.textMuted }}>kcal</span>
            </div>
            <div style={{ fontFamily: FONT_MONO, fontSize: 8.5, color: COLORS.textMuted }}>
              P {entry.protein_g ?? '—'} · C {entry.carbs_g ?? '—'} · F {entry.fat_g ?? '—'}
            </div>
          </div>
        </div>
      ))}
      {/* onClick wired in Task 9 once LogEntrySheet exists */}
      <button style={{
        width: '100%', padding: '8px 0', borderRadius: 6, border: `1px dashed ${hexA(A, 0.4)}`,
        background: 'transparent', color: A, fontFamily: FONT_MONO, fontSize: 9.5, cursor: 'pointer',
      }}>
        + ADD TO {mealKey.toUpperCase()}
      </button>
    </div>
  )
}

export function NutritionOverview() {
  const [date, setDate] = useState(todayLocal())
  const { log, summary, loading } = useNutritionLog(date)
  const isToday = date === todayLocal()
  const mealKeys = log ? orderedMealKeys(log.meals) : []
  const missingMeals = MEAL_ORDER.filter(m => !mealKeys.includes(m))

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <button
          aria-label="Previous day"
          onClick={() => setDate(d => addDaysLocal(d, -1))}
          style={{ width: 34, height: 34, borderRadius: 8, border: `1px solid ${COLORS.line}`, background: COLORS.surface, color: COLORS.textSecondary, cursor: 'pointer' }}
        >‹</button>
        <button
          onClick={() => setDate(todayLocal())}
          style={{
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
            padding: '8px 0', borderRadius: 8, cursor: 'pointer', background: COLORS.surface,
            border: `1px solid ${isToday ? hexA(A, 0.5) : COLORS.line}`,
          }}
        >
          <span style={{ fontFamily: FONT_MONO, fontSize: 10.5, fontWeight: 700, color: A }}>{relativeDayLabel(date)}</span>
          <span style={{ fontFamily: FONT_MONO, fontSize: 8, color: COLORS.textMuted }}>{absoluteDateLabel(date)}</span>
        </button>
        <button
          aria-label="Next day"
          onClick={() => setDate(d => addDaysLocal(d, 1))}
          style={{ width: 34, height: 34, borderRadius: 8, border: `1px solid ${COLORS.line}`, background: COLORS.surface, color: COLORS.textSecondary, cursor: 'pointer' }}
        >›</button>
      </div>

      <Rail label={isToday ? 'TODAY · SO FAR' : date < todayLocal() ? `CLOSED DAY · ${relativeDayLabel(date)}` : `PLANNED · ${relativeDayLabel(date)}`} accent={A}
        right={summary?.target ? `TARGET SET ${summary.target.date} · EDIT ›` : 'NO TARGET SET · SET ›'} />

      <LedgerHero summary={summary} date={date} />

      {!loading && log && mealKeys.length === 0 && (
        <p style={{ fontFamily: FONT_MONO, fontSize: 10, color: COLORS.textMuted, textAlign: 'center', padding: '24px 0' }}>
          NO ENTRIES LOGGED {isToday ? 'YET TODAY' : 'THIS DAY'}
        </p>
      )}

      {log && mealKeys.map(mealKey => (
        <MealGroupCard key={mealKey} mealKey={mealKey} group={log.meals[mealKey]} />
      ))}

      {missingMeals.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {missingMeals.map(meal => (
            // onClick wired in Task 9
            <button key={meal} style={{
              flex: '1 1 45%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
              padding: '10px 0', borderRadius: 8, border: `1px dashed ${COLORS.line}`,
              background: 'transparent', color: COLORS.textMuted, cursor: 'pointer',
            }}>
              <span style={{ fontFamily: FONT_MONO, fontSize: 10, fontWeight: 700 }}>+ {meal.toUpperCase()}</span>
              <span style={{ fontFamily: FONT_MONO, fontSize: 8 }}>NOT LOGGED YET</span>
            </button>
          ))}
        </div>
      )}
    </>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:client -- NutritionOverview.test.tsx NutritionPage.test.tsx`
Expected: PASS. (Re-run `NutritionPage.test.tsx` too — its empty-state assertion now exercises the real hero/meal-group path via the same component.)

Then `npx tsc --noEmit` — clean.

- [ ] **Step 5: Visual check**

`npm run build:client`, `/run`, Playwright to `/nutrition`, screenshot, compare against `design_handoff_nutrition_v4/screenshots/01-overview-today.png` structurally (exact copy/spacing polish can follow; structure/data must match). `browser_close`.

- [ ] **Step 6: Commit**

```bash
git add client/src/pages/nutrition/NutritionOverview.tsx tests/client/pages/nutrition/NutritionOverview.test.tsx
git commit -m "feat: render ledger hero and sparse meal groups on Nutrition Overview"
```

---

### Task 8: MX-4 briefing card (today only)

`MX4Briefing` (Task 0 survey: `client/src/components/MX4Card.tsx`) already handles refresh polling, the DIRECTIVE box, and FULL ANALYSIS — reuse as-is, same as every other section. Per README, it renders **only on today**.

**Files:**
- Modify: `client/src/pages/nutrition/NutritionOverview.tsx`
- Test: `tests/client/pages/nutrition/NutritionOverview.test.tsx`

**Interfaces:**
- Consumes: `MX4Briefing` (`accent`, `brief`, `liveData`, `section`, `onRefresh` props — unchanged), `useBriefing('nutrition')` (existing hook, Task 0 survey), `BRIEFS.nutrition` (Task 6)

- [ ] **Step 1: Write the failing test**

Add to `tests/client/pages/nutrition/NutritionOverview.test.tsx`:

```tsx
  it('renders the MX-4 briefing card only when viewing today', async () => {
    render(<NutritionOverview />)
    await waitFor(() => expect(screen.getByText(/MX-4 \/\/ NUTRITION/)).toBeInTheDocument())
  })

  it('does not render the briefing card on a past day', async () => {
    render(<NutritionOverview />)
    const user = (await import('@testing-library/user-event')).default.setup()
    await waitFor(() => screen.getByLabelText('Previous day'))
    await user.click(screen.getByLabelText('Previous day'))
    await waitFor(() => expect(screen.queryByText(/MX-4 \/\/ NUTRITION/)).not.toBeInTheDocument())
  })
```

(These reuse the `beforeEach` mocks already in the file — Task 7's `beforeEach` already includes the well-formed `global.fetch` mock these two tests need for `useBriefing`'s `/api/insights/nutrition` call.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:client -- NutritionOverview.test.tsx`
Expected: FAIL — no briefing card rendered yet.

- [ ] **Step 3: Implement**

In `client/src/pages/nutrition/NutritionOverview.tsx`, add imports:

```tsx
import { MX4Briefing } from '../../components/MX4Card'
import { useBriefing } from '../../hooks/useBriefing'
import { BRIEFS } from '../../lib/stubData'
```

Inside `NutritionOverview()`, add the hook call alongside the existing ones:

```tsx
  const { data: liveBriefing, refresh: refreshBriefing } = useBriefing('nutrition')
```

And render it conditionally, directly above the `<Rail ... />` line:

```tsx
      {isToday && (
        <MX4Briefing accent={A} brief={BRIEFS.nutrition} liveData={liveBriefing ?? undefined} section="nutrition" onRefresh={refreshBriefing} />
      )}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:client -- NutritionOverview.test.tsx`
Expected: PASS.

Then `npx tsc --noEmit` — clean.

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/nutrition/NutritionOverview.tsx tests/client/pages/nutrition/NutritionOverview.test.tsx
git commit -m "feat: wire MX-4 briefing card on Nutrition Overview, today only"
```

---

## Phase D — Log Entry sheet

### Task 9: Log Entry sheet — Quick Track (ad-hoc) + wiring the open/close flow

Creates the sheet component and wires the inert Overview buttons from Task 7 to open it. Scope: Quick Track (ad-hoc) path only — search/recents/locked-unit land in Task 10.

**Files:**
- Create: `client/src/pages/nutrition/LogEntrySheet.tsx`
- Modify: `client/src/pages/nutrition/NutritionOverview.tsx`
- Test: `tests/client/pages/nutrition/LogEntrySheet.test.tsx`
- Test: `tests/client/pages/nutrition/NutritionOverview.test.tsx`

**Interfaces:**
- Consumes: `Sheet`, `SheetShell`, `SheetHeader` (`client/src/components/Sheet.tsx`, unchanged), `createLogEntry` (Task 4)
- Produces: `LogEntrySheetProps { open: boolean; date: string; meal: string; onClose: () => void; onLogged: () => void }`

- [ ] **Step 1: Write the failing test**

Create `tests/client/pages/nutrition/LogEntrySheet.test.tsx`:

```tsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { LogEntrySheet } from '../../../../client/src/pages/nutrition/LogEntrySheet'

vi.mock('../../../../client/src/lib/nutritionApi', async () => {
  const actual = await vi.importActual('../../../../client/src/lib/nutritionApi')
  return { ...actual, createLogEntry: vi.fn(), searchFoods: vi.fn().mockResolvedValue([]) }
})

import { createLogEntry } from '../../../../client/src/lib/nutritionApi'
const mockCreateLogEntry = createLogEntry as ReturnType<typeof vi.fn>

beforeEach(() => vi.clearAllMocks())

describe('LogEntrySheet — Quick Track', () => {
  it('submits an ad-hoc entry with the typed name, quantity, and unit', async () => {
    mockCreateLogEntry.mockResolvedValue({ id: 1 })
    const onLogged = vi.fn()
    const user = userEvent.setup()
    render(<LogEntrySheet open date="2026-07-13" meal="breakfast" onClose={vi.fn()} onLogged={onLogged} />)

    await user.type(screen.getByPlaceholderText(/what did you eat/i), 'Tacos from the truck')
    await user.type(screen.getByPlaceholderText('qty'), '2')
    await user.type(screen.getByPlaceholderText('unit (any)'), 'tacos')
    await user.click(screen.getByText('LOG ENTRY'))

    await waitFor(() => expect(mockCreateLogEntry).toHaveBeenCalledWith(expect.objectContaining({
      date: '2026-07-13', meal_type: 'breakfast', name: 'Tacos from the truck', quantity: 2, unit: 'tacos',
    })))
    expect(onLogged).toHaveBeenCalled()
  })

  it('leaves blank macro fields as null, not zero', async () => {
    mockCreateLogEntry.mockResolvedValue({ id: 1 })
    const user = userEvent.setup()
    render(<LogEntrySheet open date="2026-07-13" meal="breakfast" onClose={vi.fn()} onLogged={vi.fn()} />)

    await user.type(screen.getByPlaceholderText(/what did you eat/i), 'Mystery snack')
    await user.type(screen.getByPlaceholderText('qty'), '1')
    await user.type(screen.getByPlaceholderText('unit (any)'), 'serving')
    await user.click(screen.getByText('LOG ENTRY'))

    await waitFor(() => expect(mockCreateLogEntry).toHaveBeenCalledWith(expect.objectContaining({
      calories: null, protein_g: null, carbs_g: null, fat_g: null, fiber_g: null,
    })))
  })

  it('does not render when open is false', () => {
    render(<LogEntrySheet open={false} date="2026-07-13" meal="breakfast" onClose={vi.fn()} onLogged={vi.fn()} />)
    expect(screen.queryByText('LOG ENTRY')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:client -- LogEntrySheet.test.tsx`
Expected: FAIL — component doesn't exist.

- [ ] **Step 3: Implement**

Create `client/src/pages/nutrition/LogEntrySheet.tsx`:

```tsx
import { useState } from 'react'
import { Sheet, SheetShell, SheetHeader } from '../../components/Sheet'
import { COLORS, FONT_MONO, SECTION_ACCENTS } from '../../theme'
import { createLogEntry } from '../../lib/nutritionApi'

const A = SECTION_ACCENTS.nutrition
const MEALS = ['breakfast', 'lunch', 'dinner', 'snack'] as const

interface LogEntrySheetProps {
  open: boolean
  date: string
  meal: string
  onClose: () => void
  onLogged: () => void
}

const inputStyle = {
  width: '100%', boxSizing: 'border-box' as const, background: COLORS.base,
  border: `1px solid ${COLORS.line}`, borderRadius: 8, padding: '9px 11px',
  color: COLORS.text, fontFamily: FONT_MONO, fontSize: 12,
}

export function LogEntrySheet({ open, date, meal: initialMeal, onClose, onLogged }: LogEntrySheetProps) {
  const [meal, setMeal] = useState(initialMeal)
  const [name, setName] = useState('')
  const [qty, setQty] = useState('')
  const [unit, setUnit] = useState('')
  const [macros, setMacros] = useState<Record<'calories' | 'protein_g' | 'carbs_g' | 'fat_g' | 'fiber_g', string>>({
    calories: '', protein_g: '', carbs_g: '', fat_g: '', fiber_g: '',
  })
  const [submitting, setSubmitting] = useState(false)

  function reset() {
    setName(''); setQty(''); setUnit('')
    setMacros({ calories: '', protein_g: '', carbs_g: '', fat_g: '', fiber_g: '' })
  }

  async function handleSubmit() {
    if (!name || !qty || !unit || submitting) return
    setSubmitting(true)
    try {
      await createLogEntry({
        date, meal_type: meal, name, quantity: Number(qty), unit,
        calories: macros.calories === '' ? null : Number(macros.calories),
        protein_g: macros.protein_g === '' ? null : Number(macros.protein_g),
        carbs_g: macros.carbs_g === '' ? null : Number(macros.carbs_g),
        fat_g: macros.fat_g === '' ? null : Number(macros.fat_g),
        fiber_g: macros.fiber_g === '' ? null : Number(macros.fiber_g),
      })
      reset()
      onLogged()
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Sheet open={open} onClose={onClose}>
      <SheetShell accent={A} onClose={onClose}>
        <SheetHeader accent={A} sigil={null} title="LOG ENTRY" sub={`${meal.toUpperCase()} · ${date}`} onClose={onClose} />
        <div style={{ padding: '0 18px 18px', overflowY: 'auto' }}>
          <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
            {MEALS.map(m => (
              <button key={m} onClick={() => setMeal(m)} style={{
                flex: 1, padding: '7px 0', borderRadius: 6, cursor: 'pointer', fontFamily: FONT_MONO, fontSize: 9.5,
                border: `1px solid ${meal === m ? A : COLORS.line}`, background: meal === m ? `${A}22` : 'transparent',
                color: meal === m ? A : COLORS.textMuted,
              }}>{m.toUpperCase()}</button>
            ))}
          </div>

          <input placeholder="What did you eat? (e.g. tacos from the truck)" value={name}
            onChange={e => setName(e.target.value)} style={{ ...inputStyle, marginBottom: 8 }} />

          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <input placeholder="qty" value={qty} onChange={e => setQty(e.target.value)} style={inputStyle} />
            <input placeholder="unit (any)" value={unit} onChange={e => setUnit(e.target.value)} style={inputStyle} />
          </div>

          <div style={{ fontFamily: FONT_MONO, fontSize: 8.5, color: COLORS.textMuted, marginBottom: 6 }}>
            MACROS OPTIONAL — LOG WHAT YOU KNOW, LEAVE THE REST BLANK
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6, marginBottom: 14 }}>
            {(['calories', 'protein_g', 'carbs_g', 'fat_g', 'fiber_g'] as const).map(key => (
              <input key={key} placeholder="—" value={macros[key]}
                onChange={e => setMacros(m => ({ ...m, [key]: e.target.value }))}
                style={{ ...inputStyle, textAlign: 'center', padding: '7px 4px' }} />
            ))}
          </div>

          <button onClick={handleSubmit} disabled={submitting} style={{
            width: '100%', padding: '11px 0', borderRadius: 8, border: 'none', cursor: submitting ? 'default' : 'pointer',
            background: A, color: COLORS.base, fontFamily: FONT_MONO, fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
          }}>LOG ENTRY</button>
        </div>
      </SheetShell>
    </Sheet>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:client -- LogEntrySheet.test.tsx`
Expected: PASS.

- [ ] **Step 5: Wire the sheet into `NutritionOverview`**

In `client/src/pages/nutrition/NutritionOverview.tsx`:
- Import `LogEntrySheet`.
- Add `const [logSheetMeal, setLogSheetMeal] = useState<string | null>(null)` in `NutritionOverview()`.
- Pass `onOpenLog={() => setLogSheetMeal(mealKey)}` down to `MealGroupCard` (add that prop, and wire the existing `+ ADD TO {MEAL}` button's `onClick={onOpenLog}` — remove the "wired in Task 9" comment).
- Wire each missing-meal button's `onClick={() => setLogSheetMeal(meal)}` the same way — remove its "wired in Task 9" comment too.
- Render at the end of the returned JSX fragment:
```tsx
      <LogEntrySheet
        open={logSheetMeal !== null}
        date={date}
        meal={logSheetMeal ?? 'breakfast'}
        onClose={() => setLogSheetMeal(null)}
        onLogged={() => { /* useNutritionLog refetches on next render via refresh() */ }}
      />
```
Import `refresh` from `useNutritionLog(date)` (already destructured as unused `loading` sibling — add `refresh` to the destructure) and call it in `onLogged` instead of the empty comment above: `onLogged={refresh}`.

- [ ] **Step 6: Add an Overview integration test**

Add to `tests/client/pages/nutrition/NutritionOverview.test.tsx`:

```tsx
  it('opens the LogEntrySheet with the right meal when a missing-meal button is clicked', async () => {
    const user = (await import('@testing-library/user-event')).default.setup()
    render(<NutritionOverview />)
    await waitFor(() => screen.getAllByText('NOT LOGGED YET'))
    await user.click(screen.getAllByText(/\+ LUNCH/)[0])
    expect(await screen.findByText('LUNCH · 2026-07-13')).toBeInTheDocument()
  })
```

(Adjust the date string in the assertion to match `todayLocal()` at test-run time — use `import { todayLocal } from '.../nutritionDate'` and template it in rather than hardcoding, since the plan is dated but the test isn't.)

- [ ] **Step 7: Run tests to verify they pass**

Run: `npm run test:client -- NutritionOverview.test.tsx LogEntrySheet.test.tsx`
Expected: PASS.

Then `npx tsc --noEmit` — clean.

- [ ] **Step 8: Commit**

```bash
git add client/src/pages/nutrition/LogEntrySheet.tsx client/src/pages/nutrition/NutritionOverview.tsx tests/client/pages/nutrition/
git commit -m "feat: add Log Entry sheet (Quick Track) and wire it to Overview"
```

---

### Task 10: Recent-entries backend + search/recents in the Log Entry sheet

Another backend gap found translating the design: there's no endpoint for "recent log entries across days" (`GET /log` is single-date only), but the sheet's RECENT list needs exactly that. Small, purely additive, read-only — no schema change.

**Files:**
- Modify: `server/api/nutrition.ts`
- Test: `tests/server/nutrition.test.ts`
- Modify: `client/src/lib/nutritionApi.ts`
- Test: `tests/client/lib/nutritionApi.test.ts`
- Modify: `client/src/pages/nutrition/LogEntrySheet.tsx`
- Test: `tests/client/pages/nutrition/LogEntrySheet.test.tsx`

**Interfaces:**
- Produces: `GET /api/nutrition/log/recent?limit=N` → `{ entries: FoodLogEntry[] }`
- Produces: `fetchRecentEntries(limit?: number): Promise<FoodLogEntry[]>`

- [ ] **Step 1: Write the failing backend test**

Add to `tests/server/nutrition.test.ts`, inside a new `describe('Recent entries', ...)` block:

```ts
  describe('Recent entries', () => {
    it('GET /api/nutrition/log/recent returns entries newest-first, deduped by name+unit', async () => {
      const { app } = await import('../../server/index')
      await request(app).post('/api/nutrition/log').send({ date: '2026-07-08', meal_type: 'lunch', name: 'Salmon bowl', quantity: 1, unit: 'bowl', calories: 500 })
      await request(app).post('/api/nutrition/log').send({ date: '2026-07-09', meal_type: 'lunch', name: 'Salmon bowl', quantity: 1, unit: 'bowl', calories: 520 })
      await request(app).post('/api/nutrition/log').send({ date: '2026-07-09', meal_type: 'dinner', name: 'Turkey sandwich', quantity: 1, unit: 'sandwich', calories: 400 })

      const res = await request(app).get('/api/nutrition/log/recent').query({ limit: 4 })
      expect(res.status).toBe(200)
      const salmonEntries = res.body.entries.filter((e: { name: string }) => e.name === 'Salmon bowl')
      expect(salmonEntries.length).toBe(1) // deduped
      expect(salmonEntries[0].calories).toBe(520) // the more recent of the two
    })

    it('GET /api/nutrition/log/recent respects the limit param', async () => {
      const { app } = await import('../../server/index')
      const res = await request(app).get('/api/nutrition/log/recent').query({ limit: 1 })
      expect(res.body.entries.length).toBe(1)
    })
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:server -- nutrition.test.ts`
Expected: FAIL — route doesn't exist (404).

- [ ] **Step 3: Implement the route**

In `server/api/nutrition.ts`, add after the `GET /log` handler:

```ts
// GET /api/nutrition/log/recent?limit=N — most recent distinct (name+unit) log entries,
// newest first, for the Log Entry sheet's RECENT list. Dedup keeps only each name+unit
// combination's most recent row — a corrected quantity/macro re-log should surface its
// latest state, not a stale older log of the same food.
nutritionRouter.get('/log/recent', (req, res) => {
  const limit = Math.min(Math.max(1, Number(req.query.limit) || 4), 20)
  const rows = db.prepare(
    'SELECT * FROM food_log_entries ORDER BY logged_at DESC LIMIT 200'
  ).all() as Array<{ name: string; unit: string }>

  const seen = new Set<string>()
  const entries: typeof rows = []
  for (const row of rows) {
    const key = `${row.name}::${row.unit}`
    if (seen.has(key)) continue
    seen.add(key)
    entries.push(row)
    if (entries.length >= limit) break
  }
  res.json({ entries })
})
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:server -- nutrition.test.ts`
Expected: PASS. Then `npm test && npx tsc -p tsconfig.server.json --noEmit`.

- [ ] **Step 5: Commit the backend piece**

```bash
git add server/api/nutrition.ts tests/server/nutrition.test.ts
git commit -m "feat: add GET /api/nutrition/log/recent endpoint"
```

- [ ] **Step 6: Write the failing client-lib test**

Add to `tests/client/lib/nutritionApi.test.ts`:

```ts
  it('fetchRecentEntries calls GET /api/nutrition/log/recent with the limit and returns entries', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ entries: [{ id: 1, name: 'Oats' }] }) })
    const result = await fetchRecentEntries(4)
    expect(mockFetch).toHaveBeenCalledWith('/api/nutrition/log/recent?limit=4')
    expect(result[0].name).toBe('Oats')
  })
```

(Add `fetchRecentEntries` to the top-level import from `nutritionApi` in the test file.)

- [ ] **Step 7: Run test to verify it fails, then implement**

Run: `npm run test:client -- nutritionApi.test.ts` → FAIL (not exported).

Add to `client/src/lib/nutritionApi.ts`, after `fetchLog`:

```ts
export async function fetchRecentEntries(limit = 4): Promise<FoodLogEntry[]> {
  const res = await fetch(`/api/nutrition/log/recent?limit=${limit}`)
  if (!res.ok) return []
  const { entries } = await res.json() as { entries: FoodLogEntry[] }
  return entries
}
```

Run: `npm run test:client -- nutritionApi.test.ts` → PASS.

- [ ] **Step 8: Commit the client-lib piece**

```bash
git add client/src/lib/nutritionApi.ts tests/client/lib/nutritionApi.test.ts
git commit -m "feat: add fetchRecentEntries to nutritionApi"
```

- [ ] **Step 9: Write the failing sheet test**

Add to `tests/client/pages/nutrition/LogEntrySheet.test.tsx` (extend the existing mock at the top of the file to include `fetchRecentEntries: vi.fn().mockResolvedValue([])` alongside `searchFoods`):

```tsx
describe('LogEntrySheet — search and recents', () => {
  it('shows up to 4 recent entries when the search query is empty', async () => {
    const { fetchRecentEntries } = await import('../../../../client/src/lib/nutritionApi')
    ;(fetchRecentEntries as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 1, name: 'Salmon bowl', quantity: 1, unit: 'bowl', calories: 520, protein_g: 46, meal_type: 'lunch', food_id: null, carbs_g: null, fat_g: null, fiber_g: null, logged_at: '' },
    ])
    render(<LogEntrySheet open date="2026-07-13" meal="lunch" onClose={vi.fn()} onLogged={vi.fn()} />)
    expect(await screen.findByText('Salmon bowl')).toBeInTheDocument()
  })

  it('calls searchFoods as the user types a query', async () => {
    const { searchFoods } = await import('../../../../client/src/lib/nutritionApi')
    const user = userEvent.setup()
    render(<LogEntrySheet open date="2026-07-13" meal="lunch" onClose={vi.fn()} onLogged={vi.fn()} />)
    await user.type(screen.getByPlaceholderText('Search saved foods…'), 'oat')
    await waitFor(() => expect(searchFoods).toHaveBeenCalledWith('oat'))
  })

  it('shows a no-match hint when search returns nothing for a non-empty query', async () => {
    const { searchFoods } = await import('../../../../client/src/lib/nutritionApi')
    ;(searchFoods as ReturnType<typeof vi.fn>).mockResolvedValue([])
    const user = userEvent.setup()
    render(<LogEntrySheet open date="2026-07-13" meal="lunch" onClose={vi.fn()} onLogged={vi.fn()} />)
    await user.type(screen.getByPlaceholderText('Search saved foods…'), 'zzz')
    expect(await screen.findByText(/No match for "zzz"/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 10: Run test to verify it fails**

Run: `npm run test:client -- LogEntrySheet.test.tsx`
Expected: FAIL — no search input or recents list rendered yet.

- [ ] **Step 11: Implement search + recents**

In `client/src/pages/nutrition/LogEntrySheet.tsx`, add imports: `useEffect` from `'react'`, and `searchFoods`, `fetchRecentEntries`, `type Food`, `type FoodLogEntry` from `../../lib/nutritionApi`.

Add state and effects inside `LogEntrySheet()`, before the existing Quick Track state:

```tsx
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Food[]>([])
  const [recents, setRecents] = useState<FoodLogEntry[]>([])
  const [selectedFood, setSelectedFood] = useState<Food | null>(null)

  useEffect(() => {
    if (!open) return
    fetchRecentEntries(4).then(setRecents)
  }, [open])

  useEffect(() => {
    if (!query) { setResults([]); return }
    let cancelled = false
    searchFoods(query).then(r => { if (!cancelled) setResults(r) })
    return () => { cancelled = true }
  }, [query])
```

Add the search UI directly below the meal-chip row in the returned JSX, before the `{!selectedFood && (` Quick Track block gets wrapped (Step 12 in Task 11 will wrap Quick Track in that conditional — for now just insert this block above it):

```tsx
          <input placeholder="Search saved foods…" value={query} onChange={e => setQuery(e.target.value)}
            style={{ ...inputStyle, marginBottom: 10 }} />

          {!query && recents.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontFamily: FONT_MONO, fontSize: 8.5, color: COLORS.textMuted, marginBottom: 6 }}>
                RECENT · ONE TAP TO RE-LOG
              </div>
              {recents.map(r => (
                <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: `1px solid ${COLORS.line}` }}>
                  <span style={{ fontFamily: FONT_UI, fontSize: 12.5, color: COLORS.text }}>{r.name}</span>
                  <button onClick={async () => {
                    await createLogEntry({ date, meal_type: meal, food_id: r.food_id, name: r.food_id == null ? r.name : undefined, quantity: r.quantity, unit: r.unit, calories: r.calories, protein_g: r.protein_g, carbs_g: r.carbs_g, fat_g: r.fat_g, fiber_g: r.fiber_g })
                    onLogged(); onClose()
                  }} style={{ background: 'none', border: 'none', color: A, fontFamily: FONT_MONO, fontSize: 9, fontWeight: 700, cursor: 'pointer' }}>+ LOG</button>
                </div>
              ))}
            </div>
          )}

          {query && results.length === 0 && (
            <div style={{ border: `1px dashed ${COLORS.line}`, borderRadius: 8, padding: '12px', marginBottom: 12, fontFamily: FONT_UI, fontSize: 12, color: COLORS.textMuted }}>
              No match for &quot;{query}&quot; in saved foods — log it directly below, save it as a food to make it searchable next time.
            </div>
          )}

          {query && results.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              {results.map(f => (
                <button key={f.id} onClick={() => { setSelectedFood(f); setQuery('') }} style={{
                  display: 'block', width: '100%', textAlign: 'left', background: COLORS.surface,
                  border: `1px solid ${COLORS.line}`, borderRadius: 6, padding: '8px 10px', marginBottom: 6, cursor: 'pointer',
                }}>
                  <div style={{ fontFamily: FONT_UI, fontSize: 13, color: COLORS.text }}>{f.name}</div>
                  <div style={{ fontFamily: FONT_MONO, fontSize: 8.5, color: COLORS.textMuted }}>
                    per {f.default_qty} {f.default_unit} · {f.calories ?? '—'} kcal · unit locked to {f.default_unit}
                  </div>
                </button>
              ))}
            </div>
          )}
```

- [ ] **Step 12: Run tests to verify they pass**

Run: `npm run test:client -- LogEntrySheet.test.tsx`
Expected: PASS, including the Task 9 tests (Quick Track is unaffected — still renders below this new block).

Then `npx tsc --noEmit` — clean.

- [ ] **Step 13: Commit**

```bash
git add client/src/pages/nutrition/LogEntrySheet.tsx tests/client/pages/nutrition/LogEntrySheet.test.tsx
git commit -m "feat: add search and recents to the Log Entry sheet"
```

---

### Task 11: Selected-food card — locked unit + reverse macro math

Completes the Log Entry sheet: picking a search result shows a locked-unit qty card with an auto-rescale preview and "set qty from a macro goal" math, and Quick Track becomes the no-selection fallback. Submission branches on whether a food is selected (`food_id` + locked unit, no client-computed macros — server scales) vs. ad-hoc (caller-supplied macros as-is, per `server/api/nutrition.ts`'s existing contract).

**Files:**
- Modify: `client/src/pages/nutrition/LogEntrySheet.tsx`
- Test: `tests/client/pages/nutrition/LogEntrySheet.test.tsx`

- [ ] **Step 1: Write the failing tests**

Add to `tests/client/pages/nutrition/LogEntrySheet.test.tsx`:

```tsx
describe('LogEntrySheet — selected food', () => {
  const oats = { id: 5, source: 'custom', name: 'Test Oats', brand: null, default_qty: 100, default_unit: 'g', calories: 389, protein_g: 16.9, carbs_g: 66.3, fat_g: 6.9, fiber_g: 10.6 }

  it('shows a locked unit chip and auto-rescale preview after picking a search result', async () => {
    const { searchFoods } = await import('../../../../client/src/lib/nutritionApi')
    ;(searchFoods as ReturnType<typeof vi.fn>).mockResolvedValue([oats])
    const user = userEvent.setup()
    render(<LogEntrySheet open date="2026-07-13" meal="breakfast" onClose={vi.fn()} onLogged={vi.fn()} />)
    await user.type(screen.getByPlaceholderText('Search saved foods…'), 'oat')
    await user.click(await screen.findByText('Test Oats'))

    expect(screen.getByText(/LOCKED/)).toBeInTheDocument()
    expect(screen.getByText('g')).toBeInTheDocument()
  })

  it('submits with food_id + quantity + the food\'s locked unit, not raw macros', async () => {
    const { searchFoods } = await import('../../../../client/src/lib/nutritionApi')
    ;(searchFoods as ReturnType<typeof vi.fn>).mockResolvedValue([oats])
    mockCreateLogEntry.mockResolvedValue({ id: 9 })
    const user = userEvent.setup()
    render(<LogEntrySheet open date="2026-07-13" meal="breakfast" onClose={vi.fn()} onLogged={vi.fn()} />)
    await user.type(screen.getByPlaceholderText('Search saved foods…'), 'oat')
    await user.click(await screen.findByText('Test Oats'))
    await user.clear(screen.getByLabelText('Quantity'))
    await user.type(screen.getByLabelText('Quantity'), '200')
    await user.click(screen.getByText('LOG ENTRY'))

    await waitFor(() => expect(mockCreateLogEntry).toHaveBeenCalledWith(expect.objectContaining({
      food_id: 5, quantity: 200, unit: 'g',
    })))
    const call = mockCreateLogEntry.mock.calls[0][0]
    expect(call.calories).toBeUndefined() // server computes the scale, client sends none
  })

  it('recomputes quantity from a macro goal (protein) using reverse math', async () => {
    const { searchFoods } = await import('../../../../client/src/lib/nutritionApi')
    ;(searchFoods as ReturnType<typeof vi.fn>).mockResolvedValue([oats])
    const user = userEvent.setup()
    render(<LogEntrySheet open date="2026-07-13" meal="breakfast" onClose={vi.fn()} onLogged={vi.fn()} />)
    await user.type(screen.getByPlaceholderText('Search saved foods…'), 'oat')
    await user.click(await screen.findByText('Test Oats'))
    await user.click(screen.getByText('P'))
    await user.type(screen.getByPlaceholderText('goal'), '40')

    // 40g protein ÷ (16.9g protein / 100g) = 236.7g
    await waitFor(() => expect(screen.getByLabelText('Quantity')).toHaveValue('236.69'))
  })

  it('CLEAR returns to the search view', async () => {
    const { searchFoods } = await import('../../../../client/src/lib/nutritionApi')
    ;(searchFoods as ReturnType<typeof vi.fn>).mockResolvedValue([oats])
    const user = userEvent.setup()
    render(<LogEntrySheet open date="2026-07-13" meal="breakfast" onClose={vi.fn()} onLogged={vi.fn()} />)
    await user.type(screen.getByPlaceholderText('Search saved foods…'), 'oat')
    await user.click(await screen.findByText('Test Oats'))
    await user.click(screen.getByLabelText('Clear selected food'))
    expect(screen.getByPlaceholderText('Search saved foods…')).toBeInTheDocument()
    expect(screen.queryByText(/LOCKED/)).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:client -- LogEntrySheet.test.tsx`
Expected: FAIL — no selected-food card exists yet; Quick Track always renders regardless of selection.

- [ ] **Step 3: Implement**

In `client/src/pages/nutrition/LogEntrySheet.tsx`:

Add state for the macro-goal selector, alongside the Task 10 state:

```tsx
  const [goalMacro, setGoalMacro] = useState<'calories' | 'protein_g' | 'carbs_g' | 'fat_g' | null>(null)
  const [goalValue, setGoalValue] = useState('')
```

Add helper functions above the component:

```tsx
function scaledPreview(food: Food, qty: number) {
  const factor = qty / food.default_qty
  const round2 = (v: number | null) => v == null ? null : Math.round(v * factor * 100) / 100
  return {
    calories: food.calories == null ? null : Math.round(food.calories * factor),
    protein_g: round2(food.protein_g),
    carbs_g: round2(food.carbs_g),
    fat_g: round2(food.fat_g),
  }
}

function qtyForGoal(food: Food, macroKey: 'calories' | 'protein_g' | 'carbs_g' | 'fat_g', goal: number): number | null {
  const perDefaultQty = food[macroKey]
  if (perDefaultQty == null || perDefaultQty === 0) return null
  return Math.round((goal * food.default_qty / perDefaultQty) * 100) / 100
}
```

Wrap the qty state setter so a goal-driven recompute updates it — add an effect after the state declarations:

```tsx
  useEffect(() => {
    if (!selectedFood || !goalMacro || goalValue === '') return
    const computed = qtyForGoal(selectedFood, goalMacro, Number(goalValue))
    if (computed != null) setQty(String(computed))
  }, [selectedFood, goalMacro, goalValue])
```

Replace the qty/unit input pair and everything below the recents/results blocks (Task 10's output) with a branch on `selectedFood`. The full return JSX inside `<SheetShell>` becomes:

```tsx
        <div style={{ padding: '0 18px 18px', overflowY: 'auto' }}>
          {/* meal chips + search input + recents/results — unchanged from Tasks 9–10 */}

          {selectedFood ? (
            <div style={{ border: `1px solid ${COLORS.line}`, borderRadius: 8, padding: '12px', marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <span style={{ fontFamily: FONT_UI, fontSize: 14, fontWeight: 600, color: COLORS.text }}>{selectedFood.name}</span>
                <button aria-label="Clear selected food" onClick={() => { setSelectedFood(null); setGoalMacro(null); setGoalValue('') }}
                  style={{ background: 'none', border: 'none', color: COLORS.textMuted, cursor: 'pointer', fontSize: 16 }}>✕</button>
              </div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                <input aria-label="Quantity" value={qty} onChange={e => setQty(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
                <span style={{ ...inputStyle, flex: 1, display: 'flex', alignItems: 'center', gap: 6, color: A, borderColor: hexA(A, 0.4) }}>
                  🔒 {selectedFood.default_unit} <span style={{ fontSize: 8, color: COLORS.textMuted }}>LOCKED</span>
                </span>
              </div>
              {qty !== '' && (() => {
                const preview = scaledPreview(selectedFood, Number(qty))
                return (
                  <div style={{ fontFamily: FONT_MONO, fontSize: 9, color: COLORS.textMuted, marginBottom: 10 }}>
                    auto: {preview.calories ?? '—'} kcal · P {preview.protein_g ?? '—'} · C {preview.carbs_g ?? '—'} · F {preview.fat_g ?? '—'}
                  </div>
                )
              })()}
              <div style={{ fontFamily: FONT_MONO, fontSize: 8.5, color: COLORS.textMuted, marginBottom: 6 }}>
                NO MACRO MATH — SET QTY FROM A GOAL
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                {(['calories', 'protein_g', 'carbs_g', 'fat_g'] as const).map(key => (
                  <button key={key} onClick={() => setGoalMacro(key)} style={{
                    padding: '5px 10px', borderRadius: 6, cursor: 'pointer', fontFamily: FONT_MONO, fontSize: 9,
                    border: `1px solid ${goalMacro === key ? A : COLORS.line}`, background: goalMacro === key ? `${A}22` : 'transparent',
                    color: goalMacro === key ? A : COLORS.textMuted,
                  }}>{key === 'protein_g' ? 'P' : key === 'carbs_g' ? 'C' : key === 'fat_g' ? 'F' : 'KCAL'}</button>
                ))}
                <input placeholder="goal" value={goalValue} onChange={e => setGoalValue(e.target.value)} style={{ ...inputStyle, width: 70 }} />
              </div>
            </div>
          ) : (
            <>
              {/* Quick Track — unchanged from Task 9 */}
            </>
          )}

          <button onClick={handleSubmit} disabled={submitting} style={{ /* unchanged */ }}>LOG ENTRY</button>
        </div>
```

Update `handleSubmit` to branch on `selectedFood`:

```tsx
  async function handleSubmit() {
    if (submitting) return
    if (selectedFood) {
      if (!qty) return
      setSubmitting(true)
      try {
        await createLogEntry({ date, meal_type: meal, food_id: selectedFood.id, quantity: Number(qty), unit: selectedFood.default_unit })
        setSelectedFood(null); setGoalMacro(null); setGoalValue('')
        onLogged(); onClose()
      } finally {
        setSubmitting(false)
      }
      return
    }
    if (!name || !qty || !unit) return
    setSubmitting(true)
    try {
      await createLogEntry({
        date, meal_type: meal, name, quantity: Number(qty), unit,
        calories: macros.calories === '' ? null : Number(macros.calories),
        protein_g: macros.protein_g === '' ? null : Number(macros.protein_g),
        carbs_g: macros.carbs_g === '' ? null : Number(macros.carbs_g),
        fat_g: macros.fat_g === '' ? null : Number(macros.fat_g),
        fiber_g: macros.fiber_g === '' ? null : Number(macros.fiber_g),
      })
      reset()
      onLogged(); onClose()
    } finally {
      setSubmitting(false)
    }
  }
```

Note `qty` is reused for both paths (search-result selection sets no default — leave it to the user, matching README's qty-input-next-to-locked-unit-chip spec); Quick Track's own qty input is unaffected since it only renders in the `!selectedFood` branch.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:client -- LogEntrySheet.test.tsx`
Expected: PASS, all tests from Tasks 9, 10, and 11.

Then `npx tsc --noEmit` — clean.

- [ ] **Step 5: Visual check**

`npm run build:client`, `/run`, Playwright to `/nutrition`, open the Log Entry sheet, search "oat"-equivalent, select a result, compare against `design_handoff_nutrition_v4/screenshots/04-log-sheet-selected-food-locked-unit.png`. `browser_close`.

- [ ] **Step 6: Commit**

```bash
git add client/src/pages/nutrition/LogEntrySheet.tsx tests/client/pages/nutrition/LogEntrySheet.test.tsx
git commit -m "feat: add locked-unit selected food and reverse macro math to Log Entry sheet"
```

---

## Phase E — Edit Entry sheet

### Task 12: Edit Entry sheet — save (diff-only PUT), delete, copy-to-today

**Files:**
- Create: `client/src/pages/nutrition/EditEntrySheet.tsx`
- Modify: `client/src/pages/nutrition/NutritionOverview.tsx`
- Test: `tests/client/pages/nutrition/EditEntrySheet.test.tsx`
- Test: `tests/client/pages/nutrition/NutritionOverview.test.tsx`

**Interfaces:**
- Consumes: `updateLogEntry`, `deleteLogEntry`, `createLogEntry` (Task 4), `todayLocal` (Task 6)
- Produces: `EditEntrySheetProps { open: boolean; entry: FoodLogEntry | null; date: string; onClose: () => void; onSaved: () => void }`

- [ ] **Step 1: Write the failing tests**

Create `tests/client/pages/nutrition/EditEntrySheet.test.tsx`:

```tsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { EditEntrySheet } from '../../../../client/src/pages/nutrition/EditEntrySheet'

vi.mock('../../../../client/src/lib/nutritionApi', () => ({
  updateLogEntry: vi.fn(), deleteLogEntry: vi.fn(), createLogEntry: vi.fn(),
}))

import { updateLogEntry, deleteLogEntry, createLogEntry } from '../../../../client/src/lib/nutritionApi'
const mockUpdate = updateLogEntry as ReturnType<typeof vi.fn>
const mockDelete = deleteLogEntry as ReturnType<typeof vi.fn>
const mockCreate = createLogEntry as ReturnType<typeof vi.fn>

const linkedEntry = { id: 7, meal_type: 'breakfast', food_id: 3, name: 'Test Oats', quantity: 100, unit: 'g', calories: 389, protein_g: 16.9, carbs_g: 66.3, fat_g: 6.9, fiber_g: 10.6, logged_at: '' }
const adHocEntry = { id: 8, meal_type: 'snack', food_id: null, name: 'Nuts', quantity: 1, unit: 'handful', calories: 180, protein_g: null, carbs_g: null, fat_g: null, fiber_g: null, logged_at: '' }

beforeEach(() => vi.clearAllMocks())

describe('EditEntrySheet', () => {
  it('shows a locked unit chip for a food-linked entry, a free unit input for ad-hoc', () => {
    const { rerender } = render(<EditEntrySheet open entry={linkedEntry} date="2026-07-13" onClose={vi.fn()} onSaved={vi.fn()} />)
    expect(screen.getByText(/LOCKED/)).toBeInTheDocument()
    rerender(<EditEntrySheet open entry={adHocEntry} date="2026-07-13" onClose={vi.fn()} onSaved={vi.fn()} />)
    expect(screen.queryByText(/LOCKED/)).not.toBeInTheDocument()
    expect(screen.getByLabelText('Unit')).toBeInTheDocument()
  })

  it('renders blank macro inputs for null macros, not "0"', () => {
    render(<EditEntrySheet open entry={adHocEntry} date="2026-07-13" onClose={vi.fn()} onSaved={vi.fn()} />)
    expect(screen.getByLabelText('protein_g')).toHaveValue('')
  })

  it('SAVE CHANGES sends only the fields that were actually edited', async () => {
    const user = userEvent.setup()
    render(<EditEntrySheet open entry={linkedEntry} date="2026-07-13" onClose={vi.fn()} onSaved={vi.fn()} />)
    await user.clear(screen.getByLabelText('Quantity'))
    await user.type(screen.getByLabelText('Quantity'), '150')
    await user.click(screen.getByText('SAVE CHANGES'))
    await waitFor(() => expect(mockUpdate).toHaveBeenCalledWith(7, { quantity: 150 }))
  })

  it('DELETE calls deleteLogEntry with the entry id and closes', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<EditEntrySheet open entry={adHocEntry} date="2026-07-13" onClose={onClose} onSaved={vi.fn()} />)
    await user.click(screen.getByText('DELETE'))
    await waitFor(() => expect(mockDelete).toHaveBeenCalledWith(8))
    expect(onClose).toHaveBeenCalled()
  })

  it('shows COPY THIS ITEM TO TODAY only when viewing a past day, and it creates a new entry dated today', async () => {
    const user = userEvent.setup()
    render(<EditEntrySheet open entry={adHocEntry} date="2026-06-01" onClose={vi.fn()} onSaved={vi.fn()} />)
    const copyBtn = screen.getByText('COPY THIS ITEM TO TODAY')
    await user.click(copyBtn)
    await waitFor(() => expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ name: 'Nuts', quantity: 1, unit: 'handful' })))
    expect(mockCreate.mock.calls[0][0].date).not.toBe('2026-06-01')
  })

  it('does not show COPY THIS ITEM TO TODAY when viewing today', () => {
    render(<EditEntrySheet open entry={adHocEntry} date={new Date().toLocaleDateString('en-CA')} onClose={vi.fn()} onSaved={vi.fn()} />)
    expect(screen.queryByText('COPY THIS ITEM TO TODAY')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:client -- EditEntrySheet.test.tsx`
Expected: FAIL — component doesn't exist.

- [ ] **Step 3: Implement**

Create `client/src/pages/nutrition/EditEntrySheet.tsx`:

```tsx
import { useState, useEffect } from 'react'
import { Sheet, SheetShell, SheetHeader } from '../../components/Sheet'
import { COLORS, FONT_MONO, SECTION_ACCENTS } from '../../theme'
import { hexA } from '../../lib/hexA'
import { updateLogEntry, deleteLogEntry, createLogEntry, type FoodLogEntry, type LogEntryInput } from '../../lib/nutritionApi'
import { todayLocal } from '../../lib/nutritionDate'

const A = SECTION_ACCENTS.nutrition
const MACRO_KEYS = ['calories', 'protein_g', 'carbs_g', 'fat_g', 'fiber_g'] as const
type MacroKey = typeof MACRO_KEYS[number]

const inputStyle = {
  width: '100%', boxSizing: 'border-box' as const, background: COLORS.base,
  border: `1px solid ${COLORS.line}`, borderRadius: 8, padding: '9px 11px',
  color: COLORS.text, fontFamily: FONT_MONO, fontSize: 12,
}

interface EditEntrySheetProps {
  open: boolean
  entry: FoodLogEntry | null
  date: string
  onClose: () => void
  onSaved: () => void
}

export function EditEntrySheet({ open, entry, date, onClose, onSaved }: EditEntrySheetProps) {
  const [qty, setQty] = useState('')
  const [unit, setUnit] = useState('')
  const [macros, setMacros] = useState<Record<MacroKey, string>>({ calories: '', protein_g: '', carbs_g: '', fat_g: '', fiber_g: '' })
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!entry) return
    setQty(String(entry.quantity))
    setUnit(entry.unit)
    setMacros({
      calories: entry.calories == null ? '' : String(entry.calories),
      protein_g: entry.protein_g == null ? '' : String(entry.protein_g),
      carbs_g: entry.carbs_g == null ? '' : String(entry.carbs_g),
      fat_g: entry.fat_g == null ? '' : String(entry.fat_g),
      fiber_g: entry.fiber_g == null ? '' : String(entry.fiber_g),
    })
  }, [entry])

  if (!entry) return null
  const isLinked = entry.food_id != null
  const isToday = date === todayLocal()

  async function handleSave() {
    setSubmitting(true)
    try {
      const updates: Partial<LogEntryInput> = {}
      if (Number(qty) !== entry!.quantity) updates.quantity = Number(qty)
      if (!isLinked && unit !== entry!.unit) updates.unit = unit
      for (const key of MACRO_KEYS) {
        const newVal = macros[key] === '' ? null : Number(macros[key])
        if (newVal !== entry![key]) updates[key] = newVal
      }
      await updateLogEntry(entry!.id, updates)
      onSaved(); onClose()
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete() {
    setSubmitting(true)
    try {
      await deleteLogEntry(entry!.id)
      onSaved(); onClose()
    } finally {
      setSubmitting(false)
    }
  }

  async function handleCopyToToday() {
    await createLogEntry({
      date: todayLocal(), meal_type: entry!.meal_type, food_id: entry!.food_id ?? undefined,
      name: entry!.food_id == null ? entry!.name : undefined, quantity: entry!.quantity, unit: entry!.unit,
      calories: entry!.calories, protein_g: entry!.protein_g, carbs_g: entry!.carbs_g, fat_g: entry!.fat_g, fiber_g: entry!.fiber_g,
    })
    onSaved(); onClose()
  }

  return (
    <Sheet open={open} onClose={onClose}>
      <SheetShell accent={A} onClose={onClose}>
        <SheetHeader accent={A} sigil={null} title="EDIT ENTRY" sub={`${entry.name} · ${entry.meal_type.toUpperCase()}`} onClose={onClose} />
        <div style={{ padding: '0 18px 18px' }}>
          <div style={{ fontFamily: FONT_MONO, fontSize: 8.5, color: COLORS.textMuted, marginBottom: 10, lineHeight: 1.5 }}>
            {isLinked
              ? 'LINKED TO A SAVED FOOD — UNIT IS FIXED, NO CONVERSION · CHANGING QUANTITY RESCALES EACH MACRO UNLESS YOU OVERRIDE IT BELOW · TO CHANGE THE FOOD ITSELF, DELETE AND RE-LOG'
              : 'ALL FIELDS FREE · BLANK MACROS STAY UNKNOWN (SHOWN AS —)'}
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <input aria-label="Quantity" value={qty} onChange={e => setQty(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
            {isLinked ? (
              <span style={{ ...inputStyle, flex: 1, display: 'flex', alignItems: 'center', gap: 6, color: A, borderColor: hexA(A, 0.4) }}>
                🔒 {unit} <span style={{ fontSize: 8, color: COLORS.textMuted }}>LOCKED</span>
              </span>
            ) : (
              <input aria-label="Unit" value={unit} onChange={e => setUnit(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
            )}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6, marginBottom: 14 }}>
            {MACRO_KEYS.map(key => (
              <input key={key} aria-label={key} placeholder="—" value={macros[key]}
                onChange={e => setMacros(m => ({ ...m, [key]: e.target.value }))}
                style={{ ...inputStyle, textAlign: 'center', padding: '7px 4px' }} />
            ))}
          </div>
          {!isToday && (
            <button onClick={handleCopyToToday} style={{
              width: '100%', padding: '9px 0', marginBottom: 10, borderRadius: 8,
              border: `1px solid ${hexA(A, 0.4)}`, background: 'transparent', color: A,
              fontFamily: FONT_MONO, fontSize: 10, cursor: 'pointer',
            }}>COPY THIS ITEM TO TODAY</button>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleDelete} disabled={submitting} style={{
              flex: 1, padding: '11px 0', borderRadius: 8, border: `1px solid ${hexA(COLORS.red, 0.5)}`,
              background: 'transparent', color: COLORS.red, fontFamily: FONT_MONO, fontSize: 10.5, fontWeight: 700, cursor: 'pointer',
            }}>DELETE</button>
            <button onClick={handleSave} disabled={submitting} style={{
              flex: 2, padding: '11px 0', borderRadius: 8, border: 'none', background: A, color: COLORS.base,
              fontFamily: FONT_MONO, fontSize: 10.5, fontWeight: 700, cursor: 'pointer',
            }}>SAVE CHANGES</button>
          </div>
        </div>
      </SheetShell>
    </Sheet>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:client -- EditEntrySheet.test.tsx`
Expected: PASS.

- [ ] **Step 5: Wire into `NutritionOverview`**

In `client/src/pages/nutrition/NutritionOverview.tsx`:
- Import `EditEntrySheet` and `type FoodLogEntry` from `../../lib/nutritionApi`.
- Add `const [editEntry, setEditEntry] = useState<FoodLogEntry | null>(null)`.
- Give `MealGroupCard` an `onEntryClick: (entry: FoodLogEntry) => void` prop; add `onClick={() => onEntryClick(entry)}` to each entry row's `<div>`.
- Pass `onEntryClick={setEditEntry}` from `NutritionOverview`.
- Render at the end of the fragment: `<EditEntrySheet open={editEntry !== null} entry={editEntry} date={date} onClose={() => setEditEntry(null)} onSaved={refresh} />`.

- [ ] **Step 6: Add an Overview integration test**

Add to `tests/client/pages/nutrition/NutritionOverview.test.tsx`:

```tsx
  it('opens the EditEntrySheet with the clicked entry', async () => {
    const user = (await import('@testing-library/user-event')).default.setup()
    render(<NutritionOverview />)
    await waitFor(() => screen.getByText('Oatmeal'))
    await user.click(screen.getByText('Oatmeal'))
    expect(await screen.findByText('SAVE CHANGES')).toBeInTheDocument()
  })
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `npm run test:client -- NutritionOverview.test.tsx EditEntrySheet.test.tsx`
Expected: PASS.

Then `npx tsc --noEmit` — clean.

- [ ] **Step 8: Visual check**

`npm run build:client`, `/run`, Playwright, tap a logged entry, compare against `design_handoff_nutrition_v4/screenshots/05-edit-entry-sheet.png`. `browser_close`.

- [ ] **Step 9: Commit**

```bash
git add client/src/pages/nutrition/EditEntrySheet.tsx client/src/pages/nutrition/NutritionOverview.tsx tests/client/pages/nutrition/
git commit -m "feat: add Edit Entry sheet with diff-only save, delete, and copy-to-today"
```

---

## Phase F — Targets sheet

### Task 13: Targets sheet — macro↔kcal sync

**Files:**
- Create: `client/src/pages/nutrition/TargetsSheet.tsx`
- Modify: `client/src/pages/nutrition/NutritionOverview.tsx`
- Test: `tests/client/pages/nutrition/TargetsSheet.test.tsx`

**Interfaces:**
- Consumes: `saveTargets` (Task 4), `todayLocal` (Task 6)
- Produces: `TargetsSheetProps { open: boolean; initialTarget: NutritionTarget | null; onClose: () => void; onSaved: () => void }`

- [ ] **Step 1: Write the failing tests**

Create `tests/client/pages/nutrition/TargetsSheet.test.tsx`:

```tsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { TargetsSheet } from '../../../../client/src/pages/nutrition/TargetsSheet'

vi.mock('../../../../client/src/lib/nutritionApi', () => ({ saveTargets: vi.fn() }))
import { saveTargets } from '../../../../client/src/lib/nutritionApi'
const mockSave = saveTargets as ReturnType<typeof vi.fn>

const target = { date: '2026-06-01', calories: 2200, protein_g: 138, carbs_g: 220, fat_g: 60, fiber_g: 30 }

beforeEach(() => vi.clearAllMocks())

describe('TargetsSheet', () => {
  it('prefills fields from initialTarget', () => {
    render(<TargetsSheet open initialTarget={target} onClose={vi.fn()} onSaved={vi.fn()} />)
    expect(screen.getByLabelText('Protein goal')).toHaveValue('138')
    expect(screen.getByLabelText('Calorie goal')).toHaveValue('2200')
  })

  it('renders blank fields when initialTarget is null (no target set yet)', () => {
    render(<TargetsSheet open initialTarget={null} onClose={vi.fn()} onSaved={vi.fn()} />)
    expect(screen.getByLabelText('Protein goal')).toHaveValue('')
  })

  it('editing protein recomputes the calorie goal as P*4 + C*4 + F*9', async () => {
    const user = userEvent.setup()
    render(<TargetsSheet open initialTarget={target} onClose={vi.fn()} onSaved={vi.fn()} />)
    await user.clear(screen.getByLabelText('Protein goal'))
    await user.type(screen.getByLabelText('Protein goal'), '150')
    // 150*4 + 220*4 + 60*9 = 600 + 880 + 540 = 2020
    await waitFor(() => expect(screen.getByLabelText('Calorie goal')).toHaveValue('2020'))
  })

  it('overriding calories directly shows a mismatch indicator against the macro sum', async () => {
    const user = userEvent.setup()
    render(<TargetsSheet open initialTarget={target} onClose={vi.fn()} onSaved={vi.fn()} />)
    await user.clear(screen.getByLabelText('Calorie goal'))
    await user.type(screen.getByLabelText('Calorie goal'), '2500')
    expect(await screen.findByText(/MACROS SUM TO/)).toBeInTheDocument()
  })

  it('shows MATCHES MACROS when calories agree with the macro sum within tolerance', () => {
    render(<TargetsSheet open initialTarget={target} onClose={vi.fn()} onSaved={vi.fn()} />)
    expect(screen.getByText(/MATCHES MACROS/)).toBeInTheDocument()
  })

  it('SAVE TARGETS calls saveTargets with today\'s date and the current field values', async () => {
    const user = userEvent.setup()
    render(<TargetsSheet open initialTarget={target} onClose={vi.fn()} onSaved={vi.fn()} />)
    await user.click(screen.getByText('SAVE TARGETS'))
    await waitFor(() => expect(mockSave).toHaveBeenCalledWith(expect.objectContaining({
      calories: 2200, protein_g: 138, carbs_g: 220, fat_g: 60, fiber_g: 30,
    })))
    expect(mockSave.mock.calls[0][0].date).toBe(new Date().toLocaleDateString('en-CA'))
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:client -- TargetsSheet.test.tsx`
Expected: FAIL — component doesn't exist.

- [ ] **Step 3: Implement**

Create `client/src/pages/nutrition/TargetsSheet.tsx`:

```tsx
import { useState, useEffect } from 'react'
import { Sheet, SheetShell, SheetHeader } from '../../components/Sheet'
import { COLORS, FONT_MONO, SECTION_ACCENTS } from '../../theme'
import { saveTargets, type NutritionTarget } from '../../lib/nutritionApi'
import { todayLocal } from '../../lib/nutritionDate'

const A = SECTION_ACCENTS.nutrition

const inputStyle = {
  width: '100%', boxSizing: 'border-box' as const, background: COLORS.base,
  border: `1px solid ${COLORS.line}`, borderRadius: 8, padding: '9px 11px',
  color: COLORS.text, fontFamily: FONT_MONO, fontSize: 12,
}

function sumKcal(p: number, c: number, f: number): number {
  return Math.round(p * 4 + c * 4 + f * 9)
}

interface TargetsSheetProps {
  open: boolean
  initialTarget: NutritionTarget | null
  onClose: () => void
  onSaved: () => void
}

export function TargetsSheet({ open, initialTarget, onClose, onSaved }: TargetsSheetProps) {
  const [protein, setProtein] = useState('')
  const [carbs, setCarbs] = useState('')
  const [fat, setFat] = useState('')
  const [fiber, setFiber] = useState('')
  const [calories, setCalories] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return
    setProtein(initialTarget?.protein_g != null ? String(initialTarget.protein_g) : '')
    setCarbs(initialTarget?.carbs_g != null ? String(initialTarget.carbs_g) : '')
    setFat(initialTarget?.fat_g != null ? String(initialTarget.fat_g) : '')
    setFiber(initialTarget?.fiber_g != null ? String(initialTarget.fiber_g) : '')
    setCalories(initialTarget?.calories != null ? String(initialTarget.calories) : '')
  }, [open, initialTarget])

  function recomputeKcal(p: string, c: string, f: string) {
    setCalories(String(sumKcal(Number(p) || 0, Number(c) || 0, Number(f) || 0)))
  }

  const macroSum = sumKcal(Number(protein) || 0, Number(carbs) || 0, Number(fat) || 0)
  const matchesMacros = Math.abs((Number(calories) || 0) - macroSum) <= 2

  async function handleSave() {
    setSubmitting(true)
    try {
      await saveTargets({
        date: todayLocal(),
        calories: calories === '' ? undefined : Number(calories),
        protein_g: protein === '' ? undefined : Number(protein),
        carbs_g: carbs === '' ? undefined : Number(carbs),
        fat_g: fat === '' ? undefined : Number(fat),
        fiber_g: fiber === '' ? undefined : Number(fiber),
      })
      onSaved(); onClose()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Sheet open={open} onClose={onClose}>
      <SheetShell accent={A} onClose={onClose}>
        <SheetHeader accent={A} sigil={null} title="DAILY TARGETS"
          sub={`${initialTarget ? `TARGET SET ${initialTarget.date}` : 'NO TARGET SET'} · APPLIES FROM TODAY FORWARD`} onClose={onClose} />
        <div style={{ padding: '0 18px 18px' }}>
          <div style={{ fontFamily: FONT_MONO, fontSize: 8.5, color: COLORS.textMuted, marginBottom: 8 }}>MACRO GOALS (g)</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginBottom: 12 }}>
            <div>
              <label htmlFor="protein-goal" style={{ display: 'block', fontFamily: FONT_MONO, fontSize: 8, color: COLORS.textMuted, marginBottom: 3 }}>P</label>
              <input id="protein-goal" aria-label="Protein goal" value={protein}
                onChange={e => { setProtein(e.target.value); recomputeKcal(e.target.value, carbs, fat) }} style={inputStyle} />
            </div>
            <div>
              <label htmlFor="carbs-goal" style={{ display: 'block', fontFamily: FONT_MONO, fontSize: 8, color: COLORS.textMuted, marginBottom: 3 }}>C</label>
              <input id="carbs-goal" aria-label="Carbs goal" value={carbs}
                onChange={e => { setCarbs(e.target.value); recomputeKcal(protein, e.target.value, fat) }} style={inputStyle} />
            </div>
            <div>
              <label htmlFor="fat-goal" style={{ display: 'block', fontFamily: FONT_MONO, fontSize: 8, color: COLORS.textMuted, marginBottom: 3 }}>F</label>
              <input id="fat-goal" aria-label="Fat goal" value={fat}
                onChange={e => { setFat(e.target.value); recomputeKcal(protein, carbs, e.target.value) }} style={inputStyle} />
            </div>
            <div>
              <label htmlFor="fiber-goal" style={{ display: 'block', fontFamily: FONT_MONO, fontSize: 8, color: COLORS.textMuted, marginBottom: 3 }}>FIBER</label>
              <input id="fiber-goal" aria-label="Fiber goal" value={fiber} onChange={e => setFiber(e.target.value)} style={inputStyle} />
            </div>
          </div>

          <div style={{ fontFamily: FONT_MONO, fontSize: 8.5, color: COLORS.textMuted, marginBottom: 6 }}>CALORIE GOAL (fiber excluded from the P/C/F sum)</div>
          <input aria-label="Calorie goal" value={calories} onChange={e => setCalories(e.target.value)} style={{ ...inputStyle, marginBottom: 6 }} />
          <div style={{ fontFamily: FONT_MONO, fontSize: 9, color: matchesMacros ? COLORS.green : COLORS.amber, marginBottom: 14 }}>
            {matchesMacros ? 'MATCHES MACROS ✓' : `MACROS SUM TO ${macroSum}`}
          </div>

          <button onClick={handleSave} disabled={submitting} style={{
            width: '100%', padding: '11px 0', borderRadius: 8, border: 'none', cursor: submitting ? 'default' : 'pointer',
            background: A, color: COLORS.base, fontFamily: FONT_MONO, fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
          }}>SAVE TARGETS</button>
        </div>
      </SheetShell>
    </Sheet>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:client -- TargetsSheet.test.tsx`
Expected: PASS.

- [ ] **Step 5: Wire into `NutritionOverview`**

In `client/src/pages/nutrition/NutritionOverview.tsx`:
- Import `TargetsSheet`.
- Add `const [targetsOpen, setTargetsOpen] = useState(false)`.
- Change the `<Rail ... right="..." />` line: `right` becomes a clickable element instead of a plain string — replace the `Rail` usage with an inline row matching `Rail`'s visual style but with a `<button>` for the right side, `onClick={() => setTargetsOpen(true)}`. (`Rail`'s `right` prop only accepts a plain string — extending it to accept a click handler is out of scope here since no other section needs that; render the equivalent markup directly in `NutritionOverview` instead of modifying the shared `Rail` component.)
- Render at the end of the fragment: `<TargetsSheet open={targetsOpen} initialTarget={summary?.target ?? null} onClose={() => setTargetsOpen(false)} onSaved={refresh} />`.

- [ ] **Step 6: Add an Overview integration test**

Add to `tests/client/pages/nutrition/NutritionOverview.test.tsx`:

```tsx
  it('opens the TargetsSheet when the target rail button is clicked', async () => {
    const user = (await import('@testing-library/user-event')).default.setup()
    render(<NutritionOverview />)
    await waitFor(() => screen.getByText(/EDIT ›/))
    await user.click(screen.getByText(/EDIT ›/))
    expect(await screen.findByText('SAVE TARGETS')).toBeInTheDocument()
  })
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `npm run test:client -- NutritionOverview.test.tsx TargetsSheet.test.tsx`
Expected: PASS.

Then `npx tsc --noEmit` — clean.

- [ ] **Step 8: Visual check**

`npm run build:client`, `/run`, Playwright, open Targets sheet, compare against `design_handoff_nutrition_v4/screenshots/06-targets-sheet.png`. `browser_close`.

- [ ] **Step 9: Commit**

```bash
git add client/src/pages/nutrition/TargetsSheet.tsx client/src/pages/nutrition/NutritionOverview.tsx tests/client/pages/nutrition/
git commit -m "feat: add Targets sheet with macro-to-kcal sync"
```

---

### Task 14: Meal-level copy-to-today

Per README §"Copy flows": each meal group header gets a COPY TO TODAY chip when viewing a non-today day. Copies the whole meal (all its entries) to today via one `POST /log` per item, then navigates back to today.

**Files:**
- Modify: `client/src/pages/nutrition/NutritionOverview.tsx`
- Test: `tests/client/pages/nutrition/NutritionOverview.test.tsx`

**Interfaces:**
- Consumes: `createLogEntry` (Task 4)

- [ ] **Step 1: Write the failing test**

Add to `tests/client/pages/nutrition/NutritionOverview.test.tsx`:

```tsx
  it('shows a COPY TO TODAY chip on a meal group only when viewing a past day, and copies every entry in that meal', async () => {
    const { createLogEntry } = await import('../../../../client/src/lib/nutritionApi')
    ;(createLogEntry as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 99 })
    const user = (await import('@testing-library/user-event')).default.setup()
    render(<NutritionOverview />)
    await waitFor(() => screen.getByLabelText('Previous day'))
    expect(screen.queryByText('COPY TO TODAY')).not.toBeInTheDocument() // today has no chip

    await user.click(screen.getByLabelText('Previous day'))
    await waitFor(() => screen.getByText('COPY TO TODAY'))
    await user.click(screen.getByText('COPY TO TODAY'))

    await waitFor(() => expect(createLogEntry).toHaveBeenCalledWith(expect.objectContaining({ name: 'Oatmeal', meal_type: 'breakfast' })))
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:client -- NutritionOverview.test.tsx`
Expected: FAIL — no COPY TO TODAY chip rendered.

- [ ] **Step 3: Implement**

In `client/src/pages/nutrition/NutritionOverview.tsx`, import `createLogEntry` from `../../lib/nutritionApi` alongside the existing type-only imports.

Add a module-level helper above `MealGroupCard`:

```tsx
async function copyMealToToday(group: MealGroup, mealKey: string) {
  for (const entry of group.entries) {
    await createLogEntry({
      date: todayLocal(), meal_type: mealKey, food_id: entry.food_id ?? undefined,
      name: entry.food_id == null ? entry.name : undefined, quantity: entry.quantity, unit: entry.unit,
      calories: entry.calories, protein_g: entry.protein_g, carbs_g: entry.carbs_g, fat_g: entry.fat_g, fiber_g: entry.fiber_g,
    })
  }
}
```

Give `MealGroupCard` two new props: `isToday: boolean` and `onCopied: () => void`. Update its header row to include the chip:

```tsx
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{ fontFamily: FONT_MONO, fontSize: 10, fontWeight: 700, color: A, letterSpacing: '0.1em' }}>
          {mealKey.toUpperCase()}
        </span>
        <span style={{ flex: 1, height: 1, background: COLORS.line }} />
        {!isToday && (
          <button onClick={() => copyMealToToday(group, mealKey).then(onCopied)} style={{
            background: 'none', border: `1px solid ${hexA(A, 0.4)}`, borderRadius: 5, padding: '2px 7px',
            color: A, fontFamily: FONT_MONO, fontSize: 8, cursor: 'pointer',
          }}>COPY TO TODAY</button>
        )}
        <span style={{ fontFamily: FONT_MONO, fontSize: 9, color: COLORS.textMuted }}>{group.totals.calories} KCAL</span>
      </div>
```

In `NutritionOverview()`, pass the new props at the `<MealGroupCard>` call site:

```tsx
        <MealGroupCard key={mealKey} mealKey={mealKey} group={log.meals[mealKey]} isToday={isToday}
          onEntryClick={setEditEntry}
          onCopied={() => { setDate(todayLocal()); refresh() }} />
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:client -- NutritionOverview.test.tsx`
Expected: PASS.

Then `npx tsc --noEmit` — clean.

- [ ] **Step 5: Visual check**

`npm run build:client`, `/run`, Playwright, navigate to a past day, compare against `design_handoff_nutrition_v4/screenshots/09-overview-yesterday-copy-to-today.png`. `browser_close`.

- [ ] **Step 6: Commit**

```bash
git add client/src/pages/nutrition/NutritionOverview.tsx tests/client/pages/nutrition/NutritionOverview.test.tsx
git commit -m "feat: add meal-level copy-to-today on Nutrition Overview"
```

---

## Phase G — Library

### Task 15: Library list (foods + recipes, delete) + new food form

Replaces the Task 6 empty-state stub in `NutritionLibrary.tsx` with the real list, wired to `searchFoods('')` (an empty query matches every row via the existing `LIKE '%${q}%'` server clause — no new list-all endpoint needed) and `fetchRecipes()`, plus delete for both and a new-food creation form.

**Files:**
- Modify: `client/src/pages/nutrition/NutritionLibrary.tsx`
- Test: `tests/client/pages/nutrition/NutritionLibrary.test.tsx`

**Interfaces:**
- Consumes: `searchFoods`, `deleteFood`, `fetchRecipes`, `deleteRecipe`, `createFood` (Task 4)

- [ ] **Step 1: Write the failing tests**

Create `tests/client/pages/nutrition/NutritionLibrary.test.tsx`:

```tsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { NutritionLibrary } from '../../../../client/src/pages/nutrition/NutritionLibrary'

vi.mock('../../../../client/src/lib/nutritionApi', () => ({
  searchFoods: vi.fn(), deleteFood: vi.fn(), fetchRecipes: vi.fn(), deleteRecipe: vi.fn(), createFood: vi.fn(),
}))

import { searchFoods, deleteFood, fetchRecipes, deleteRecipe, createFood } from '../../../../client/src/lib/nutritionApi'
const mockSearchFoods = searchFoods as ReturnType<typeof vi.fn>
const mockDeleteFood = deleteFood as ReturnType<typeof vi.fn>
const mockFetchRecipes = fetchRecipes as ReturnType<typeof vi.fn>
const mockDeleteRecipe = deleteRecipe as ReturnType<typeof vi.fn>
const mockCreateFood = createFood as ReturnType<typeof vi.fn>

const oats = { id: 1, source: 'custom', name: 'Test Oats', brand: null, default_qty: 100, default_unit: 'g', calories: 389, protein_g: 16.9, carbs_g: 66.3, fat_g: 6.9, fiber_g: 10.6 }
const smoothie = { id: 2, name: 'Protein Smoothie', servings: 2, food_id: 9, ingredient_count: 2, per_serving_calories: 113, per_serving_protein_g: 25, per_serving_carbs_g: 15, per_serving_fat_g: 0.5, per_serving_fiber_g: 1.5 }

beforeEach(() => {
  vi.clearAllMocks()
  mockSearchFoods.mockResolvedValue([oats])
  mockFetchRecipes.mockResolvedValue([smoothie])
})

describe('NutritionLibrary — list', () => {
  it('lists foods and recipes with counts in the rail', async () => {
    render(<NutritionLibrary />)
    expect(await screen.findByText('Test Oats')).toBeInTheDocument()
    expect(screen.getByText('Protein Smoothie')).toBeInTheDocument()
    expect(screen.getByText('1 FOODS · 1 RECIPES')).toBeInTheDocument()
  })

  it('shows recipe ingredient count and per-serving kcal', async () => {
    render(<NutritionLibrary />)
    expect(await screen.findByText('2 ingredients · 2 servings · 113 kcal / serving')).toBeInTheDocument()
  })

  it('deleting a food calls deleteFood and reloads the list', async () => {
    const user = userEvent.setup()
    render(<NutritionLibrary />)
    await screen.findByText('Test Oats')
    mockSearchFoods.mockResolvedValue([])
    await user.click(screen.getByLabelText('Delete Test Oats'))
    await waitFor(() => expect(mockDeleteFood).toHaveBeenCalledWith(1))
    await waitFor(() => expect(screen.queryByText('Test Oats')).not.toBeInTheDocument())
  })

  it('deleting a recipe calls deleteRecipe and reloads the list', async () => {
    const user = userEvent.setup()
    render(<NutritionLibrary />)
    await screen.findByText('Protein Smoothie')
    mockFetchRecipes.mockResolvedValue([])
    await user.click(screen.getByLabelText('Delete Protein Smoothie'))
    await waitFor(() => expect(mockDeleteRecipe).toHaveBeenCalledWith(2))
  })

  it('shows the empty state when there are no foods or recipes', async () => {
    mockSearchFoods.mockResolvedValue([])
    mockFetchRecipes.mockResolvedValue([])
    render(<NutritionLibrary />)
    expect(await screen.findByText('NO SAVED FOODS YET')).toBeInTheDocument()
  })
})

describe('NutritionLibrary — new food', () => {
  it('+ NEW FOOD switches to the new-food form', async () => {
    const user = userEvent.setup()
    render(<NutritionLibrary />)
    await screen.findByText('Test Oats')
    await user.click(screen.getByText('+ NEW FOOD'))
    expect(screen.getByText('SAVE FOOD — SEARCHABLE IMMEDIATELY')).toBeInTheDocument()
  })

  it('saving a new food calls createFood and returns to the list', async () => {
    mockCreateFood.mockResolvedValue({ id: 5 })
    const user = userEvent.setup()
    render(<NutritionLibrary />)
    await screen.findByText('Test Oats')
    await user.click(screen.getByText('+ NEW FOOD'))
    await user.type(screen.getByLabelText('Food name'), 'Greek Yogurt')
    await user.type(screen.getByLabelText('Default quantity'), '170')
    await user.type(screen.getByLabelText('Default unit'), 'g')
    await user.click(screen.getByText('SAVE FOOD — SEARCHABLE IMMEDIATELY'))
    await waitFor(() => expect(mockCreateFood).toHaveBeenCalledWith(expect.objectContaining({ name: 'Greek Yogurt', default_qty: 170, default_unit: 'g' })))
    expect(await screen.findByText('+ NEW FOOD')).toBeInTheDocument() // back on the list screen
  })

  it('‹ BACK TO LIBRARY returns without saving', async () => {
    const user = userEvent.setup()
    render(<NutritionLibrary />)
    await screen.findByText('Test Oats')
    await user.click(screen.getByText('+ NEW FOOD'))
    await user.click(screen.getByText('‹ BACK TO LIBRARY'))
    expect(mockCreateFood).not.toHaveBeenCalled()
    expect(await screen.findByText('+ NEW FOOD')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:client -- NutritionLibrary.test.tsx`
Expected: FAIL — current `NutritionLibrary.tsx` (Task 6) only renders a static empty-state message.

- [ ] **Step 3: Implement**

Replace `client/src/pages/nutrition/NutritionLibrary.tsx`:

```tsx
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
  const [qty, setQty] = useState('100')
  const [unit, setUnit] = useState('g')
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:client -- NutritionLibrary.test.tsx`
Expected: PASS. (`+ NEW RECIPE` navigates to `mode === 'new-recipe'`, which currently renders nothing — that's fine, Task 16 implements it; no test in this task exercises that mode's content beyond switching away from list.)

Then `npx tsc --noEmit` — clean.

- [ ] **Step 5: Visual check**

`npm run build:client`, `/run`, Playwright to `/nutrition`, click Library tab, compare against `design_handoff_nutrition_v4/screenshots/07-library-list.png`. `browser_close`.

- [ ] **Step 6: Commit**

```bash
git add client/src/pages/nutrition/NutritionLibrary.tsx tests/client/pages/nutrition/NutritionLibrary.test.tsx
git commit -m "feat: add Library list (foods + recipes, delete) and new food form"
```

---

### Task 16: New recipe form — ingredient composition

Wires to the recipes backend from Task 3. Ingredients can come from an already-loaded saved food (client-side filter of the `foods` list already fetched for the list screen — no extra request) or be entered ad-hoc.

**Files:**
- Modify: `client/src/pages/nutrition/NutritionLibrary.tsx`
- Test: `tests/client/pages/nutrition/NutritionLibrary.test.tsx`

**Interfaces:**
- Consumes: `createRecipe` (Task 4)

- [ ] **Step 1: Write the failing tests**

Add to `tests/client/pages/nutrition/NutritionLibrary.test.tsx`:

```tsx
describe('NutritionLibrary — new recipe', () => {
  it('+ NEW RECIPE switches to the new-recipe form', async () => {
    const user = userEvent.setup()
    render(<NutritionLibrary />)
    await screen.findByText('Test Oats')
    await user.click(screen.getByText('+ NEW RECIPE'))
    expect(screen.getByLabelText('Recipe name')).toBeInTheDocument()
  })

  it('adding an ingredient from saved foods prefills quantity, unit, and calories', async () => {
    const user = userEvent.setup()
    render(<NutritionLibrary />)
    await screen.findByText('Test Oats')
    await user.click(screen.getByText('+ NEW RECIPE'))
    await user.type(screen.getByPlaceholderText('Add from saved foods…'), 'Oat')
    await user.click(await screen.findByText('Test Oats'))
    expect(screen.getByText('389 kcal')).toBeInTheDocument()
  })

  it('+ AD-HOC INGREDIENT adds a blank editable row', async () => {
    const user = userEvent.setup()
    render(<NutritionLibrary />)
    await screen.findByText('Test Oats')
    await user.click(screen.getByText('+ NEW RECIPE'))
    await user.click(screen.getByText('+ AD-HOC INGREDIENT'))
    expect(screen.getByLabelText('Ingredient 0 quantity')).toBeInTheDocument()
  })

  it('removing an ingredient removes its row', async () => {
    const user = userEvent.setup()
    render(<NutritionLibrary />)
    await screen.findByText('Test Oats')
    await user.click(screen.getByText('+ NEW RECIPE'))
    await user.click(screen.getByText('+ AD-HOC INGREDIENT'))
    await user.click(screen.getByLabelText('Remove ingredient 0'))
    expect(screen.queryByLabelText('Ingredient 0 quantity')).not.toBeInTheDocument()
  })

  it('shows a live RECIPE TOTAL / PER SERVING kcal summary', async () => {
    const user = userEvent.setup()
    render(<NutritionLibrary />)
    await screen.findByText('Test Oats')
    await user.click(screen.getByText('+ NEW RECIPE'))
    await user.type(screen.getByLabelText('Servings'), '2')
    await user.type(screen.getByPlaceholderText('Add from saved foods…'), 'Oat')
    await user.click(await screen.findByText('Test Oats'))
    expect(screen.getByText(/RECIPE TOTAL 389 kcal · PER SERVING 195 kcal/)).toBeInTheDocument()
  })

  it('SAVE RECIPE calls createRecipe with name, servings, and the current ingredient rows', async () => {
    mockCreateFood.mockResolvedValue({}) // unused here, just avoiding an unrelated unmocked call
    const { createRecipe } = await import('../../../../client/src/lib/nutritionApi')
    ;(createRecipe as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 1, food: { id: 2 } })
    const user = userEvent.setup()
    render(<NutritionLibrary />)
    await screen.findByText('Test Oats')
    await user.click(screen.getByText('+ NEW RECIPE'))
    await user.type(screen.getByLabelText('Recipe name'), 'Oat Bowl')
    await user.type(screen.getByPlaceholderText('Add from saved foods…'), 'Oat')
    await user.click(await screen.findByText('Test Oats'))
    await user.click(screen.getByText('SAVE RECIPE'))

    await waitFor(() => expect(createRecipe).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Oat Bowl',
      ingredients: [expect.objectContaining({ food_id: 1, name: 'Test Oats', quantity: 100, unit: 'g' })],
    })))
    expect(await screen.findByText('+ NEW FOOD')).toBeInTheDocument() // back on the list screen
  })
})
```

(Add `createRecipe` to the top-of-file `vi.mock` factory for `nutritionApi`, alongside the existing mocked exports.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:client -- NutritionLibrary.test.tsx`
Expected: FAIL — `mode === 'new-recipe'` currently renders nothing.

- [ ] **Step 3: Implement**

In `client/src/pages/nutrition/NutritionLibrary.tsx`, add `createRecipe` to the `nutritionApi` import, and add this component above `export function NutritionLibrary()`:

```tsx
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
}

function NewRecipeForm({ foods, onDone, onBack }: { foods: Food[]; onDone: () => void; onBack: () => void }) {
  const [name, setName] = useState('')
  const [servings, setServings] = useState('1')
  const [ingredients, setIngredients] = useState<IngredientRow[]>([])
  const [query, setQuery] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const matches = query ? foods.filter(f => f.name.toLowerCase().includes(query.toLowerCase())).slice(0, 5) : []

  function addFromFood(food: Food) {
    setIngredients(rows => [...rows, {
      food_id: food.id, name: food.name, quantity: food.default_qty, unit: food.default_unit,
      calories: food.calories, protein_g: food.protein_g, carbs_g: food.carbs_g, fat_g: food.fat_g, fiber_g: food.fiber_g,
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
    if (!name || ingredients.length === 0 || submitting) return
    setSubmitting(true)
    try {
      await createRecipe({
        name, servings: servingsNum,
        ingredients: ingredients.map(i => ({
          food_id: i.food_id, name: i.name, quantity: i.quantity, unit: i.unit,
          calories: i.calories ?? undefined, protein_g: i.protein_g ?? undefined,
          carbs_g: i.carbs_g ?? undefined, fat_g: i.fat_g ?? undefined, fiber_g: i.fiber_g ?? undefined,
        })),
      })
      onDone()
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

      {ingredients.map((ing, i) => (
        <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>
          <span style={{ flex: 1, fontFamily: FONT_UI, fontSize: 12, color: COLORS.text }}>{ing.name || '(unnamed)'}</span>
          <input aria-label={`Ingredient ${i} quantity`} value={String(ing.quantity)}
            onChange={e => updateIngredient(i, { quantity: Number(e.target.value) })} style={{ ...inputStyle, width: 60 }} />
          <span style={{ fontFamily: FONT_MONO, fontSize: 9, color: COLORS.textMuted, width: 30 }}>{ing.unit}</span>
          <span style={{ fontFamily: FONT_MONO, fontSize: 9, color: COLORS.textMuted, width: 60 }}>{ing.calories ?? '—'} kcal</span>
          <button aria-label={`Remove ingredient ${i}`} onClick={() => removeIngredient(i)} style={{ background: 'none', border: 'none', color: COLORS.red, cursor: 'pointer' }}>✕</button>
        </div>
      ))}

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

      <button onClick={handleSave} disabled={submitting} style={{ ...accentButton, width: '100%' }}>SAVE RECIPE</button>
    </>
  )
}
```

Add the `hexA` import (`import { hexA } from '../../lib/hexA'`) since `NewRecipeForm` uses it. Then replace the `// 'new-recipe' mode is implemented in Task 16` comment in `NutritionLibrary()` with:

```tsx
  if (mode === 'new-recipe') {
    return <NewRecipeForm foods={foods} onDone={() => { setMode('list'); reload() }} onBack={() => setMode('list')} />
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:client -- NutritionLibrary.test.tsx`
Expected: PASS, all tests from Task 15 and Task 16.

Then `npx tsc --noEmit` — clean.

- [ ] **Step 5: Visual check**

`npm run build:client`, `/run`, Playwright, click + NEW RECIPE, add an ingredient, compare against `design_handoff_nutrition_v4/screenshots/08-library-new-recipe.png`. `browser_close`.

- [ ] **Step 6: Commit**

```bash
git add client/src/pages/nutrition/NutritionLibrary.tsx tests/client/pages/nutrition/NutritionLibrary.test.tsx
git commit -m "feat: add new recipe form with ingredient composition"
```

---

## Phase H — Verification, review, and PR

### Task 17: Full-suite verification, code review, and PR

Per `bacta-feature` Phases 5–7. Does not merge — that's `bacta-pr-review`'s job in a separate session.

**Files:** none (verification and process only)

- [ ] **Step 1: Full test suite and typechecks**

```bash
npm test
npx tsc --noEmit
npx tsc -p tsconfig.server.json --noEmit
```
All must be clean. Fix anything red before continuing.

- [ ] **Step 2: Definition-of-done pass against the three states the prototype can't show**

Per `design_handoff_nutrition_v4/CLAUDE_CODE_PROMPT.md`'s definition of done, manually verify each of these against the real API (not just unit tests) using `/run` + Playwright or the `bacta-sqlite` MCP:
- **Empty foods DB (default / cold start):** clear or use a fresh test DB, load `/nutrition`, confirm the Log Entry sheet's search shows the "no saved foods yet" hint and Quick Track still works.
- **Null target:** ensure no `nutrition_targets` row exists for today, confirm the Overview rail shows "NO TARGET SET · SET ›" and the hero shows logged totals without a remaining/standing chip (per Task 7's `LedgerHero`).
- **A day with zero entries:** navigate to a day with no logged food, confirm the "NO ENTRIES LOGGED" message and all four missing-meal affordances render.

- [ ] **Step 3: Full visual walkthrough**

`npm run build:client`, `/run`, then Playwright through the whole flow in one pass: Overview (today) → tap + ADD TO BREAKFAST → Quick Track an entry → close → tap the entry → Edit sheet → change quantity → Save → tap EDIT on the target rail → Targets sheet → edit a macro → confirm kcal auto-syncs → Save → switch to Library → confirm the new food/entry's food (if saved) appears → + NEW RECIPE → add an ingredient → Save → navigate to yesterday → confirm COPY TO TODAY chip appears on any meal group → tap it → confirm entry appears on today. Screenshot at each major step, compare against the corresponding file in `design_handoff_nutrition_v4/screenshots/`. `browser_close`, then `rm -rf /tmp/pw-*`.

- [ ] **Step 4: Regression check on an adjacent section**

Navigate to `/recovery` (or any other built section) and confirm the Overview/Trends dock toggle still works — this is the second, later-stage check on the Task 2 tab-system change, now that the full Nutrition build is layered on top of it.

- [ ] **Step 5: Code review**

Run `/code-review` at high effort on the full diff (`git diff main...feature/nutrition`). Fix any confirmed findings directly on the branch, re-run Step 1's full suite after each fix.

- [ ] **Step 6: Push and open the PR**

```bash
git push origin feature/nutrition
gh pr create --repo bridgemouse/bacta \
  --title "Nutrition frontend: Overview, Log/Edit sheets, Targets, Library" \
  --body "$(cat <<'EOF'
## What changed
- Implements the Nutrition section frontend from `design_handoff_nutrition_v4/` against the already-merged backend (PR #136).
- Generalizes `BottomBar`'s tab system (Overview/Trends → also supports Overview/Library) — no behavior change for existing sections.
- Adds two backend gaps found while implementing the design: recipe storage (`recipes`/`recipe_ingredients` tables + endpoints) and food deletion (`DELETE /api/nutrition/foods/:id`), plus a `GET /api/nutrition/log/recent` endpoint for the Log Entry sheet's recents list.
- Screens: Overview (day nav, MX-4 briefing, ledger hero, sparse meal groups, copy-to-today), Log Entry sheet (Quick Track, search, locked-unit selected food, reverse macro math), Edit Entry sheet (diff-only save, delete, copy-to-today), Targets sheet (macro↔kcal sync), Library (foods + recipes list/delete, new food, new recipe).

## Why
Closes the "no frontend" gap noted in `docs/ROADMAP.md`'s Nutrition Section entry — backend has been merged and awaiting a Claude Design handoff since PR #136; this implements that handoff.

## Test evidence
- Server: recipes CRUD, food deletion, recent-entries endpoint — all TDD, FK-constraint edge cases covered (deleting a food/recipe that's already been logged is blocked with 400, not a raw 500).
- Client: every component built test-first (see individual task commits); full suite green, both typechecks clean.
- Visual: walked through the full flow against the live app via Playwright, compared against `design_handoff_nutrition_v4/screenshots/`.

## Known gaps
- Recipe editing (change ingredients after saving) is not in v1 — matches the prototype, which only shows create + delete.
- No micronutrient surfacing, barcode/photo scanning, or branded-food coverage — explicitly out of scope per the handoff README.

## Checklist
- [x] Inline styles only (no CSS files or class names)
- [x] Colors from theme.ts, SECTION_ACCENTS.nutrition only on the section frame
- [x] TypeScript clean (client + server)
- [x] Full test suite passing
- [x] Visual walkthrough against design_handoff_nutrition_v4/ screenshots
EOF
)"
```

- [ ] **Step 7: Stop**

Do not merge. Report the PR URL back to the user; merging happens via `bacta-pr-review` in a separate session, per `bacta-feature`'s Phase 7.

---

## Plan self-review notes

- **Spec coverage:** All screens/flows from `design_handoff_nutrition_v4/README.md` §"Screens / Views" are covered: Overview (Task 7–9, 14), Library (Task 15–16), Log Entry sheet (Task 9–11), Edit Entry sheet (Task 12), Targets sheet (Task 13), Copy flows (Task 12 item-level, Task 14 meal-level). The three cold-start/edge states called out in the handoff's "Definition of done" are explicitly re-verified in Task 17 Step 2, not just assumed from unit tests.
- **Backend gaps found during planning (not in PR #136), all now covered:** recipe storage (Task 3), food deletion (Task 3), recent-entries endpoint (Task 10) — each got its own TDD cycle and FK-constraint edge-case tests, consistent with the existing `nutrition.test.ts` rigor (e.g. `default_qty <= 0` rejection).
- **Shared-component change:** Task 2's `BottomBar`/`Tab` widening is regression-tested twice — once immediately after the change (Task 2 Step 7) and again at the end of the full build (Task 17 Step 4) — since it touches every built section's dock, not just Nutrition's.
- **Out of scope, confirmed against the handoff:** recipe editing after save, barcode/photo scanning, micronutrients, unit conversion, branded-food import (Open Food Facts) — none of these are implemented, matching the handoff's explicit "Out of scope" list.

