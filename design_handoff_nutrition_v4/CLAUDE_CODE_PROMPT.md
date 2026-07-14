# Claude Code Prompt — Implement the Bacta Nutrition Section

Copy-paste this (or point Claude Code at this file) to start the implementation session.

---

Implement the Nutrition section in this repo from the design handoff in `design_handoff_nutrition_v4/`.

**Read first, in this order:**
1. `design_handoff_nutrition_v4/README.md` — the full spec: screens, tokens, interactions, state, and the API mapping. It is self-sufficient; trust it over the prototype where they disagree on implementation guidance.
2. `design_handoff_nutrition_v4/Nutrition.dc.html` — the interactive hi-fi prototype. Open it in a browser and click through every flow before writing code: day nav (‹/›/pill), + ADD TO MEAL → log sheet (search "oat", pick a food, note the locked unit + macro-math row; clear it and use Quick Track), tap an entry → edit sheet, EDIT › on the ledger rail → targets sheet, Library tab → new food / new recipe, and go to yesterday → COPY TO TODAY.
3. `server/api/nutrition.ts` and `tests/server/nutrition.test.ts` — the merged backend this UI binds to. If the README and the code ever disagree, trust the code.
4. `client/src/theme.ts`, `client/src/pages/RecoveryPage.tsx`, and `client/src/components/` (SectionShell, TopBar, BottomBar, Sheet, MX4Card, Rail, primitives/) — the existing patterns to reuse.

**Ground rules:**
- The HTML prototype is a design reference, NOT code to port. Recreate it in the existing React client with the existing components. `ios-frame.jsx` and `support.js` are prototype scaffolding — ignore them.
- Accent is `SECTION_ACCENTS.nutrition` (`#3ecf8e`) and colors only the section frame. MX-4's sigil, the BottomBar, and the tab toggle stay bacta cyan — exactly like every other section.
- The `meals` object from `GET /log` is sparse and open-keyed. Never assume four meal slots; render groups from present keys and "+ MEAL / NOT LOGGED YET" affordances from absent ones.
- Nulls are meaningful: entry macros can be null (render "—"), `summary.target` can be null (no-target state — the prototype doesn't show this state; per README render the hero without remaining/standing and change the rail CTA to "NO TARGET SET · SET ›"), `remaining` is per-macro nullable.
- Unit lock is a hard API rule: food-linked entries send the food's stored unit verbatim on POST and PUT. The UI never offers a unit choice for them.
- On PUT, send only fields the user explicitly edited — the server rescales untouched macros per-field when quantity changes. Do not recompute macros client-side on edit.
- Cold start is real: the foods table is empty until the USDA import is run. The ad-hoc-first ordering and the honest empty-search copy in the log sheet are deliberate design decisions — keep them.
- Recipes have no backend store in v1: saving a recipe materializes a per-serving custom food via `POST /foods`. Keep composition client-side or propose a migration — but don't block the UI on one.
- MX-4 briefing uses the existing `useBriefing`/`MX4Card` pipeline; only render it on today. The prototype's briefing copy is placeholder.
- Match the prototype's copy verbatim elsewhere (microcopy strings, rail labels, button text) — it is written in the section's "ledger" voice on purpose: standing not verdicts, logging gaps stated plainly without praise or guilt.

**Suggested build order:** page shell + tabs → `GET /log` + sparse meal list → log sheet (Quick Track first, then search/recents/macro-math) → edit sheet → summary/ledger hero → targets sheet → library (foods, then recipes) → day nav + copy flows → briefing wiring.

Definition of done: every flow clickable in the prototype works against the real API, including the three states the prototype can't show — empty foods DB (default), null target, and a day with zero entries.
