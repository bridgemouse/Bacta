# Pre-Release Tweaks — Design Spec

**Date:** 2026-06-15  
**Status:** Approved  
**Scope:** Six targeted improvements before Bacta v1.0 E2E QA pass.

---

## Overview

Six independent features grouped into four implementation areas. All touch existing files — no new components required.

---

## Group 1: Per-Section Orchestrator Trigger + Home Re-run Setting

### New API Endpoint

`POST /api/mx4/run/:section` in `server/api/mx4.ts`

- Validates `section` against `['recovery', 'sleep', 'training', 'home']`; 404 otherwise
- For `home` when setting `mx4_home_rerun_mode = 'all_sections'`: calls `runOrchestrator()` (full run)
- For `home` when setting `mx4_home_rerun_mode = 'home_only'` (default): calls `runSection()` for home only
- For other sections: calls `runSection()` for that section only
- Returns `{ ok: true }` with 202 immediately; executes via `setImmediate` (same pattern as existing `/run`)
- `runSection()` must be exported from `server/lib/ai/orchestrator.ts`

### New Setting

Key: `mx4_home_rerun_mode`  
Default: `'home_only'`  
Values: `'home_only'` | `'all_sections'`

Added to `initSettings()` defaults in `server/lib/settings.ts`.

New toggle row in `SettingsPage.tsx` MX-4 INTELLIGENCE rail:
- Label: "Home re-run includes all sections"
- Sub-label: "When off, re-running Home uses cached section briefings"
- Toggle: OFF = `home_only` (default), ON = `all_sections`
- Reads/writes via `GET /api/settings` + `PUT /api/settings/mx4_home_rerun_mode`

### UI — REFRESH Button on MX4Briefing

`MX4Briefing` in `client/src/components/MX4Card.tsx`:
- Add `section?: string` prop
- Add `onRefresh?: () => void` prop (called when new briefing data lands)
- When `section` is present: show `REFRESH ›` button in card footer alongside `FULL ANALYSIS ›`
- Click handler: POST `/api/mx4/run/:section` → set button to `RUNNING ›` (disabled) → poll `/api/insights/:section` every 10s watching for `generated_at` to change → when changed, call `onRefresh?.()` → restore button to `REFRESH ›`
- Timeout after 24 polls (4 minutes) → restore button regardless

`useBriefing` hook (`client/src/hooks/useBriefing.ts`):
- Add `refresh()` function (re-runs the fetch, updates state)
- Return `{ data, refresh }` instead of just `data`

Section pages (`RecoveryPage`, `SleepPage`, `TrainingPage`, `HomePage`):
- Pass `section="recovery"` etc. to `MX4Briefing`
- Pass `onRefresh={refresh}` (from `useBriefing`) to `MX4Briefing`
- Update `useBriefing` call site to destructure `{ data, refresh }` instead of just the return value

---

## Group 2: iOS Zoom Fix + Auto-Growing Textarea

Both changes are in `client/src/components/AskSheet.tsx` textarea element only.

### iOS Zoom Fix

Change `fontSize: 12.5` → `fontSize: 16` on the textarea.  
iOS Safari zooms the viewport on focus when any input's font-size < 16px. This is the standard fix; 16px is what iMessage uses.

### Auto-Growing Textarea

Remove `rows={1}` from the textarea.  
Add a `useEffect` in `AskSheet` that calls `autoResize` whenever `input` changes:

```ts
function autoResize(el: HTMLTextAreaElement) {
  el.style.height = 'auto'
  el.style.height = `${Math.min(el.scrollHeight, 120)}px`
}

useEffect(() => {
  if (textareaRef.current) autoResize(textareaRef.current)
}, [input])
```

- Max height: 120px (~5 lines at 16px / 1.5 line-height)
- Beyond 120px the textarea scrolls internally
- Min height: natural single-line height (no explicit `minHeight` needed — `rows` removal handles this)
- `resize: 'none'` stays to prevent manual resize handle

---

## Group 3: Per-Message Section Color-Coding

### DB Migration

Add `section TEXT` column to `mx4_chat_messages` via `ALTER TABLE` in `server/db/migrate.ts`.  
Existing rows get `NULL` — rendered with MX-4 cyan fallback. No data backfill needed.

Schema addition (for reference):
```sql
ALTER TABLE mx4_chat_messages ADD COLUMN section TEXT;
```

### Server Changes (`server/api/mx4.ts`)

**`POST /api/mx4/chat`:**
- Accept `section?: string` from request body
- Store `section` when inserting user message
- Store `section` when inserting completed assistant response

**`POST /api/mx4/chat/seed`:**
- Accept `section?: string` from request body
- Store `section` on the seeded assistant message

**`GET /api/mx4/chat/:sessionId`:**
- Add `section` to SELECT
- Return `section` per message (null for legacy messages)

**`compressSessionIfNeeded`:**
- Compressed summary message inserted with `section = NULL` (spans multiple contexts)

### Client Changes

**`ChatMessage` interface (`client/src/hooks/useChat.ts`):**
```ts
export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  section?: string
  created_at?: string  // added for Group 4 filter
}
```

**`useChat.submit()`:** accepts `section?: string` parameter, passes it in POST body.

**`AskSheet` props:** add `section: string` (the current section ID).

**`AppShell` (`client/src/components/AppShell.tsx`):** already has `section` prop — pass it to `<AskSheet section={section} />`.

**Message rendering in `AskSheet`:**  
Each bubble derives its accent from `msg.section`:
```ts
const msgAccent = msg.section 
  ? (SECTION_ACCENTS[msg.section as keyof typeof SECTION_ACCENTS] ?? MX4_COLOR)
  : MX4_COLOR
```
- User bubble: `background`, `border` use `msgAccent`
- Assistant bubble: `background`, `border`, `MX4Sigil color` use `msgAccent`
- Sheet-level `accent` prop remains for header, input bar, send button (reflects current section, not history)

---

## Group 4: Session-Persistent Visual History Clear

### `useChat` Changes

**`GET /api/mx4/chat/:sessionId`** (server): add `created_at` to SELECT and return it. (Covered in Group 3 — `created_at` added to `ChatMessage` interface there.)

**New state in `useChat`:**
```ts
const [hiddenBefore, setHiddenBefore] = useState<string | null>(null)
const hiddenBeforeRef = useRef<string | null>(null)
```

Use a `ref` alongside state so the `loadMessages` fetch callback always reads the current value (avoids stale closure):

**`clearVisualHistory()` function:**
```ts
function clearVisualHistory() {
  const now = new Date().toISOString()
  hiddenBeforeRef.current = now
  setHiddenBefore(now)
  setMessages(prev => prev.filter(m => (m.created_at ?? '') > now))
}
```

**`loadMessages()` updated — reads from ref, not state:**
```ts
function loadMessages() {
  fetch(`/api/mx4/chat/${sessionId}`)
    .then(r => r.json())
    .then((msgs: ChatMessage[]) => {
      const cutoff = hiddenBeforeRef.current
      setMessages(cutoff
        ? msgs.filter(m => (m.created_at ?? '') > cutoff)
        : msgs)
    })
    .catch(() => {})
}
```

`hiddenBefore` state + ref reset to `null` automatically when sessionId changes (new day), since both are scoped to the `useChat` hook instance.

**Return value:** add `clearVisualHistory` to the hook's return object.

### UI

In `AskSheet` header area: add a small `CLEAR VIEW ›` text button in the `SheetHeader` row, right-aligned beside the close `×` button.  
- Only rendered when `messages.length > 0`
- `fontFamily: FONT_MONO`, `fontSize: 9`, `letterSpacing: '0.12em'`, `color: COLORS.textMuted`
- No confirmation — action is non-destructive (DB untouched, page reload restores history)

---

## File Change Summary

| File | Change |
|---|---|
| `server/api/mx4.ts` | New `POST /run/:section`; add `section` to chat insert/select; add `created_at` to GET |
| `server/lib/ai/orchestrator.ts` | Export `runSection()` |
| `server/lib/settings.ts` | Add `mx4_home_rerun_mode` default |
| `server/db/migrate.ts` | `ALTER TABLE mx4_chat_messages ADD COLUMN section TEXT` |
| `client/src/components/MX4Card.tsx` | Add `section`, `onRefresh` props; REFRESH button with polling |
| `client/src/components/AskSheet.tsx` | `fontSize: 16`; auto-resize; `section` prop; per-message colors; CLEAR VIEW button |
| `client/src/components/AppShell.tsx` | Pass `section` to `AskSheet` |
| `client/src/hooks/useChat.ts` | `section` on ChatMessage; `submit(section?)`; `hiddenBefore`; `clearVisualHistory`; `created_at` |
| `client/src/hooks/useBriefing.ts` | Add `refresh()` function |
| `client/src/pages/RecoveryPage.tsx` | Pass `section` + `onRefresh` to `MX4Briefing` |
| `client/src/pages/SleepPage.tsx` | Pass `section` + `onRefresh` to `MX4Briefing` |
| `client/src/pages/TrainingPage.tsx` | Pass `section` + `onRefresh` to `MX4Briefing` |
| `client/src/pages/HomePage.tsx` | Pass `section` + `onRefresh` to `MX4Briefing` |
| `client/src/pages/SettingsPage.tsx` | New toggle row for `mx4_home_rerun_mode` |

---

## Out of Scope

- No new reusable components
- No changes to wiki, orchestrator prompts, or section definitions
- No changes to the existing `/api/mx4/run` (full-run) endpoint
- No message backfill for section color on legacy messages (null → cyan fallback)
