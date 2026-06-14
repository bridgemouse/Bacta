# MX-4 Ask Chat — Design Spec

**Date:** 2026-06-14

---

## Goal

Wire the existing AskSheet UI into a live streaming chat with MX-4. The input bar becomes functional, messages persist within the current day, and MX-4 responds in real time with full tool access.

---

## Architecture

### Server

**New endpoint:** `POST /api/mx4/chat` added to `server/api/mx4.ts`

**New module:** `server/lib/ai/chat.ts` — session loading logic (load today's messages from DB, build CoreMessage array for the model)

**New endpoint:** `GET /api/mx4/chat/:sessionId` — returns today's stored messages so the client can restore history on sheet open

**Request body:** `{ message: string, sessionId: string }`

**Per-request flow:**
1. Save user message to `mx4_chat_messages` immediately
2. Load all of today's messages for this session from DB (full history — no rolling window; Gemini 2.5 Flash has 1M token context)
3. Build system prompt: `mx4/system-prompt.md` + wiki context (`readAllWikiPagesSync`) + heartbeat (`loadHeartbeat`) — same pattern as orchestrator
4. Call `streamText` with: system prompt + full history + new user message + all 6 tools + `maxSteps: 8`
5. Stream response as SSE (`text/event-stream`): each token as `data: <chunk>\n\n`, end with `data: [DONE]\n\n`
6. `onFinish`: save complete assistant response to `mx4_chat_messages`

**Tools available (all 6 — same as orchestrator):**
- `queryDb` — pull Garmin metrics from SQLite
- `readVault` — read Obsidian vault notes
- `readAllWikiPages` — load MX-4's persistent wiki knowledge
- `writeWikiPage` — update a wiki page mid-conversation
- `listWikiPages` — list wiki pages with token estimates
- `archiveWikiPage` — archive a wiki page

**No structured output.** Pure `streamText` — MX-4 responds in free-form voice. No `generateObject` or schema constraints.

**Session ID:** Today's date string (`YYYY-MM-DD`), generated client-side. Resets at midnight automatically — no server-side cleanup needed.

---

### Client

**File modified:** `client/src/components/AskSheet.tsx` — transformed from static shell to live chat component.

**New hook:** `client/src/hooks/useChat.ts` — encapsulates session ID, message state, streaming fetch logic, and history loading.

**State:**
- `messages: { role: 'user' | 'assistant', content: string }[]` — loaded from server on sheet open
- `input: string` — controlled textarea value
- `streaming: boolean` — true while SSE response is in flight

**Input bar:** Static placeholder div replaced with a real `<textarea>`. Auto-resizes. Submits on Send button tap or Enter key (Shift+Enter for newline).

**Suggested prompts:** Tapping one fills the input and submits immediately.

**Message bubbles:**
- User: right-aligned, MX-4 cyan tint background, no sigil
- MX-4: left-aligned, sigil (`mood="think"` while streaming, `mood="pleased"` on finish), bubble style matching the existing greeting

**Static greeting:** The "Standing by, Commander..." bubble is always rendered as static UI — never stored to DB, never sent to the model as context. It's chrome, not conversation.

**Streaming:** MX-4's bubble appears immediately with a blinking cursor; tokens accumulate in real time as SSE chunks arrive. Uses `fetch` + `response.body.getReader()` + `TextDecoder`.

**Auto-scroll:** Message container scrolls to bottom on each new token chunk.

**History restore:** On sheet open, `GET /api/mx4/chat/:sessionId` fetches today's messages and populates state before rendering.

---

## Data Flow

```
User types → submit → POST /api/mx4/chat
  → save user msg to DB
  → load today's full history
  → streamText(system + wiki + heartbeat + history + tools)
  → SSE chunks → client accumulates into bubble
  → onFinish → save assistant msg to DB

Sheet opens → GET /api/mx4/chat/:sessionId
  → load today's msgs → populate message state
```

---

## Schema (existing — no changes needed)

```sql
CREATE TABLE IF NOT EXISTS mx4_chat_messages (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id  TEXT NOT NULL,
  role        TEXT NOT NULL,
  content     TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_chat_session ON mx4_chat_messages(session_id, created_at);
```

---

## Files

| Action | Path | Responsibility |
|---|---|---|
| Modify | `server/api/mx4.ts` | Add `POST /chat` and `GET /chat/:sessionId` endpoints |
| Create | `server/lib/ai/chat.ts` | `loadChatHistory(sessionId)` — loads today's messages as CoreMessage array |
| Create | `client/src/hooks/useChat.ts` | Session ID, message state, streaming fetch, history load on mount |
| Modify | `client/src/components/AskSheet.tsx` | Wire up useChat, real textarea, message bubbles, streaming render |

---

## Edge Cases

- **No API key:** `streamText` throws — catch and push an error message bubble ("MX-4 is offline. Configure an AI provider in Settings.")
- **Stream abort:** User closes sheet mid-stream — partial message is discarded client-side, incomplete assistant turn not saved to DB
- **Empty session:** No messages today — sheet shows just the static greeting, suggested prompts visible
- **Tool call in progress:** Model is mid-tool-call — user sees blinking cursor with no text yet (normal; tool results arrive before final response text begins)
