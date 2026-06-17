# MX-4 Tool Indicators & Chat Redesign — Design Spec

**Date:** 2026-06-17  
**Status:** Approved

---

## Overview

Two related changes to the Ask MX-4 chat UI:

1. **Tool activity indicators** — surface what MX-4 is doing during the silent tool-use phase (querying DB, sweeping archives, consulting matrices). Up to 3 stack, newest at bottom, each capped to one line. Clear when text starts flowing.

2. **Full-width MX-4 responses** — remove the chat bubble from assistant messages. MX-4 takes the full available width; user messages stay as right-aligned bubbles. Matches Claude Desktop's visual model.

---

## Part 1: Tool Activity Indicators

### Server changes (`server/api/mx4.ts`)

Switch the chat SSE loop from `result.textStream` to `result.fullStream` (Vercel AI SDK). On every `tool-call` event, emit a new SSE event type before any text:

```
data: {"tool":"PULLING TELEMETRY ON hrv"}
```

Text chunks continue as bare JSON strings (unchanged format). The `[DONE]` sentinel is unchanged.

Tool labels are computed server-side by a `toolLabel(toolName, args)` function. Labels are **action statements** in the droid comms register — uppercase, active verb, dynamic where args are available.

### Label map

| Tool | Dynamic? | Label |
|---|---|---|
| `queryDb` | Yes — extract metric from SQL `WHERE metric = '...'` | `PULLING TELEMETRY ON [metric]` / `PULLING TELEMETRY` |
| `research` | Yes — first 50 chars of `args.query` | `SWEEPING ARCHIVES FOR [query]` |
| `readAllWikiPages` | No | `CONSULTING LOADED MATRICES` |
| `writeWikiPage` | Yes — `args.name` | `ENCODING [name] TO MATRIX` |
| `archiveWikiPage` | Yes — `args.name` | `ARCHIVING [name] FROM MATRIX` |
| `listWikiPages` | No | `SURVEYING LOADED MATRICES` |
| `search_wiki` | Yes — first 50 chars of `args.query` | `SWEEPING EXTERNAL MATRIX FOR [query]` |
| `read_wiki_page` | Yes — `args.path` | `PULLING [path] FROM EXTERNAL MATRIX` |
| `get_wiki_index` | No | `ORIENTING ON EXTERNAL MATRIX` |
| `list_wiki_pages` | No | `SURVEYING EXTERNAL MATRIX` |
| fallback | Yes — toolName | `ACCESSING [TOOLNAME]` |

**External Matrix** = Ethan's Obsidian LLM-Wiki vault (read-only, another droid for all intents and purposes).  
**Loaded Matrices** = MX-4's own accumulated wiki (`mx4/wiki/`).

### Client hook changes (`client/src/hooks/useChat.ts`)

- New state: `toolCalls: string[]` — last 3 tool labels received
- New ref: `hasTextRef` — tracks whether first text chunk has arrived this turn
- On `{"tool": "..."}` SSE event: append to `toolCalls`, keep only last 3 (`slice(-2)` before pushing)
- On first text chunk: clear `toolCalls`, set `hasTextRef.current = true`
- On `submit()`: reset both `toolCalls` and `hasTextRef` before fetch
- Expose `toolCalls` from hook return

### UI rendering (`client/src/components/AskSheet.tsx`)

Tool indicators render inside the assistant message area (full-width, see Part 2), above content:

- Only render when `streaming && i === messages.length - 1 && toolCalls.length > 0`
- Each row: mono, 9px, uppercase, single line, `overflow: hidden`, `textOverflow: ellipsis`, `whiteSpace: nowrap`
- Inactive rows (not the last): `·` prefix, `COLORS.textMuted` color
- Active row (last): blinking filled dot prefix (5×5px circle, `mx4blink`), `hexA(color, 0.7)` color
- Bottom margin of 10px if `msg.content` is non-empty (space before text), else 0
- No margin between tool rows beyond 3px gap

---

## Part 2: Full-Width MX-4 Responses

### Layout change

**Before:** Both user and assistant messages render as bubbles with `maxWidth: 85%` / `maxWidth: 80%`, background, border, border-radius.

**After:**
- **User messages** — unchanged (right-aligned bubble, `maxWidth: 80%`, existing styles)
- **Assistant messages** — no bubble. Full width. Structure:
  ```
  [sigil 22px] [left accent line] [content full width]
  ```
  - `MX4Sigil` stays left at 22px, `marginTop: 4`
  - Content div: `flex: 1`, `borderLeft: 2px solid hexA(color, 0.25)`, `paddingLeft: 12`, `minWidth: 0`
  - No `maxWidth`, no `background`, no `border` (other than the left accent), no `borderRadius`
  - Tool indicators render inside content div, above ReactMarkdown output

### Why `minWidth: 0`

Flex children default to `min-width: auto` which can cause text overflow with long unbroken strings. `minWidth: 0` forces the flex child to respect the container.

### Blinking cursor

Stays as-is: `display: inline-block`, 6×14px, `background: color`, `mx4blink` animation. Appended after ReactMarkdown output when streaming on last message.

---

## Files Changed

| File | Change |
|---|---|
| `server/api/mx4.ts` | Add `toolLabel()`, switch `textStream` → `fullStream`, emit `{"tool":"..."}` events |
| `client/src/hooks/useChat.ts` | Add `toolCalls` state, `hasTextRef`, parse tool events, expose `toolCalls` |
| `client/src/components/AskSheet.tsx` | Full-width assistant layout, tool indicator rendering |

No new files. No new components. No schema changes.

---

## Error handling

- `toolLabel` is pure and cannot throw — args access is all via `String(args.x ?? '')`.
- `fullStream` iteration: existing try/catch in the chat endpoint covers errors. The error SSE event format (`{"error":"..."}`) is unchanged.
- If `toolCalls` is non-empty when streaming ends (MX-4 produced no text — already handled by the existing error path), the error message replaces the last assistant message, clearing visual state.
