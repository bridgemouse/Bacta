# Pre-Release Final — Design Spec
Date: 2026-06-15

## Scope

Five items before E2E testing for 1.0 release:

1. **Custom Skills** — user-defined prompt pills in AskSheet, managed in Settings
2. **Vault Integration** — MCP-based LLM-Wiki connection (spec in `docs/VAULT_INTEGRATION.md`)
3. **MX4Card stub removal** — delete deprecated `MX4Card` function + `MX4Insight` interface
4. **ARCHITECTURE.md stale notes** — update two stale paragraphs about orchestrator format
5. **sections.py cleanup** — the superseded Python orchestrator file, section IDs don't match TypeScript pipeline

Items 3–5 are trivial inline cleanups. Items 1–2 are the feature work.

---

## Feature 1: Custom Skills

### What It Is

User-defined action pills in AskSheet. Each skill has a short label and a full prompt behind it. Tapping the pill fires the prompt into chat. SYNC WIKI (currently hardcoded) becomes the seeded default skill — a template showing users the label + prompt pattern.

### Data Model

Key: `mx4_custom_skills` in `app_settings`  
Value: JSON string — `[{ "label": "SYNC WIKI", "prompt": "..." }, ...]`

Default seed (via `initSettings()`, `INSERT OR IGNORE`):
```json
[{
  "label": "SYNC WIKI",
  "prompt": "Review your wiki pages and update them based on our conversation so far. Write any new patterns or findings worth preserving."
}]
```

The `INSERT OR IGNORE` pattern means this only seeds on first run. If the user modifies the array, the seed does not re-apply.

### API

`GET /api/settings/custom-skills` → `{ skills: [{ label: string, prompt: string }] }`  
Parses `mx4_custom_skills` from `app_settings`, returns empty array if not set.

No new write endpoint — skills are written via the existing `PUT /api/settings/:key` with `key = mx4_custom_skills` and the full JSON array as value.

### Settings UI

New Rail: **CUSTOM SKILLS** · accent `MX4_COLOR`  
Placed between VAULT and DATA MANAGEMENT rails.

Card layout (plain scroll, no pagination):
- **Row 1 — SYNC WIKI:** label in `FONT_MONO` 12px, `color: COLORS.text`. No delete button. A lock/pin indicator is optional but not required — absence of delete button is sufficient.
- **Rows 2–N — user skills:** label left, `✕` delete button right. Delete button: `FONT_MONO` 11px, `color: COLORS.mx4Red`, no border, no background, `padding: '4px 6px'`.
- **Last row — ADD SKILL ›:** `FONT_MONO` 10px, `letterSpacing: '0.1em'`, `color: MX4_COLOR`, no border, no background, right-aligned. Uses `rowStyleLast`.

**Inline add form** (replaces card rows when ADD SKILL › is tapped):
- Label input: `FONT_MONO` 12px, short — user types naturally, displayed as-entered
- Prompt textarea: `FONT_UI` 13px, `rows={3}`, resizable within bounds
- SAVE › and CANCEL side by side below inputs
- On SAVE: serializes full array to JSON, calls `PUT /api/settings/mx4_custom_skills`, closes form, re-renders list
- On CANCEL: closes form, no change

### AskSheet UI

Remove:
- `WIKI_PROMPT` constant
- Hardcoded SYNC WIKI `<span>` pill
- The `<div style={{ display: 'flex', paddingBottom: 8 }}>` wrapper around it

Replace the entire pill zone (suggested prompts + SYNC WIKI) with:

**Suggested prompts row** — unchanged (4 hardcoded text bubbles, `FONT_UI`, only shown when `showSuggested`)

**Custom skills carousel** — shown when `showSuggested` and `skills.length > 0`:
- Horizontal scroll container: `overflowX: 'auto'`, `scrollSnapType: 'x mandatory'`, `scrollbarWidth: 'none'`, `WebkitOverflowScrolling: 'touch'`
- Each page: `flex: '0 0 100%'`, `scrollSnapAlign: 'start'`, `display: 'flex'`, `gap: 8`, holds 3 skill pills
- Skills chunked into groups of 3: `chunk(skills, 3)`
- **Page dots:** rendered below carousel when `totalPages > 1`. Small circles (6px), filled = active page (`MX4_COLOR`), unfilled = inactive (`COLORS.line`). Track active page via `onScroll` intersection or scroll event on the container.
- **Skill pill style:** matches current SYNC WIKI style — `FONT_MONO` 9px, `fontWeight: 700`, `letterSpacing: '0.12em'`, `color: accent`, `background: hexA(accent, 0.08)`, `border: 1px solid ${hexA(accent, 0.25)}`, `borderRadius: 18`, `padding: '6px 12px'`, `cursor: 'pointer'`

AskSheet fetches skills on open (alongside `loadMessages()`): `GET /api/settings/custom-skills`. Stored in local state `skills`. If fetch fails, carousel does not render (graceful degradation).

### Files Changed

| File | Change |
|---|---|
| `server/lib/settings.ts` | Add `mx4_custom_skills` to `SETTING_DEFAULTS` |
| `server/api/settings.ts` | Add `GET /custom-skills` route |
| `client/src/pages/SettingsPage.tsx` | Add CUSTOM SKILLS rail + card |
| `client/src/components/AskSheet.tsx` | Replace hardcoded SYNC WIKI with skills carousel |

---

## Feature 2: Vault Integration

Fully designed in `docs/VAULT_INTEGRATION.md`. Server live at `http://192.168.1.202:8765`.

Summary of changes (implementation follows the handoff doc exactly):

| File | Change |
|---|---|
| `package.json` | Add `@modelcontextprotocol/sdk` |
| `server/lib/settings.ts` | Add `vault_enabled: 'false'`, `vault_url: ''` to `SETTING_DEFAULTS` |
| `server/lib/ai/vaultClient.ts` | **New** — MCP client singleton, 4 vault tools, `testVaultConnection()`, `resetVaultClient()` |
| `server/lib/ai/tools.ts` | Remove `readVault` tool and `VAULT_ROOT` constant |
| `server/lib/ai/orchestrator.ts` | Import vault tools, merge conditionally, update tool hint in section prompts |
| `server/lib/ai/sections.ts` | Remove "Do not attempt readVault" guards from recovery + sleep prompts |
| `server/api/settings.ts` | Add `POST /test-vault-connection`, reset client on vault key changes |
| `client/src/pages/SettingsPage.tsx` | Add VAULT rail: toggle + URL input + test button with domain/page count display |

---

## Tech Debt Cleanups (inline, no plan needed)

### 3. MX4Card stub removal

In `client/src/components/MX4Card.tsx`, delete:
- The `MX4Insight` interface (lines 15–20)
- The `MX4Card` function (lines 22–25)
- The comment block wrapping them (lines 13–14, 26)

No other file imports `MX4Card` or `MX4Insight` — verified by grep.

### 4. ARCHITECTURE.md stale notes

In `docs/ARCHITECTURE.md`:
- Update the Express API route table: `/api/insights/:section` description should say "reads from `mx4_briefings` DB table, falls back to stub JSON" (not "reads `insights/{section}.json`")
- Update the "Format mismatch" note in the Data Flow section — it's resolved; the TypeScript pipeline writes to DB, not HTML files

### 5. sections.py cleanup

`mx4/sections.py` is superseded by `server/lib/ai/sections.ts`. The Python orchestrator (`mx4/orchestrator.py`) is also superseded by the TypeScript pipeline.

Action: Add a clear deprecation header to both `mx4/sections.py` and `mx4/orchestrator.py` noting they are superseded by the TypeScript pipeline. Do not delete — they may have reference value. The `mx4/` directory's other files (system-prompt.md, HEARTBEAT.md, mcp-config.json) remain active.

---

## Settings Page Rail Order (final)

1. AI PROVIDER
2. MX-4 INTELLIGENCE
3. VAULT *(new)*
4. CUSTOM SKILLS *(new)*
5. DATA MANAGEMENT
6. GARMIN

---

## Test Coverage

- `GET /api/settings/custom-skills` — empty default, seeded default, user array
- `PUT /api/settings/mx4_custom_skills` — round-trip JSON
- `POST /api/settings/test-vault-connection` — ok + error cases
- AskSheet: carousel renders when skills present, does not render when empty
- AskSheet: SYNC WIKI pill removed (hardcoded constant gone)
- Settings: SYNC WIKI row has no delete button; user skills have delete buttons
