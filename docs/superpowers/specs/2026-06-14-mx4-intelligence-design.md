# MX-4 Intelligence System — Design Spec
Date: 2026-06-14

## Overview

This spec defines the complete architecture for bringing MX-4's intelligence layer to life. The existing Python orchestrator (`mx4/orchestrator.py` and supporting files) is retired in full. The intelligence layer moves to TypeScript inside the Express server, using the Vercel AI SDK as a provider-agnostic abstraction. Gemini 2.5 Flash is the default model. All other Garmin infrastructure (poller, ingest, auth) is untouched.

This work is organized into three implementation phases, each with its own plan:
- **Phase 1:** Settings page + AI provider layer (foundational — unblocks everything)
- **Phase 2:** Orchestrator + Wiki + Briefing delivery
- **Phase 3:** Chat wiring (AskSheet → live MX-4 conversation)

---

## Architecture Overview

```
Express Server
├── lib/ai/
│   ├── provider.ts       — Vercel AI SDK wrapper; reads config at call time
│   ├── tools.ts          — MX-4 tool definitions (queryDb, readVault, wiki tools)
│   ├── sections.ts       — Section definitions (ported from Python, metric names fixed)
│   ├── orchestrator.ts   — Nightly briefing runner
│   ├── wiki.ts           — Wiki file I/O helpers
│   └── wrap.ts           — Post-session maintenance (lint, synthesize, log)
├── api/
│   ├── mx4.ts            — /run, /chat, /chat/end-session
│   ├── insights.ts       — /insights/:section (reads mx4_briefings table)
│   └── settings.ts       — GET /api/settings, PUT /api/settings/:key

SQLite — new tables:
  app_settings            — key/value store for all configuration
  mx4_briefings           — one live briefing per section
  mx4_chat_messages       — full chat history

mx4/wiki/                 — MX-4's persistent knowledge base
  SCHEMA.md               — page structure and maintenance rules
  ethan-profile.md        — goals, background, training context
  hrv-patterns.md         — autonomic trends and correlations
  sleep-patterns.md       — sleep architecture tendencies
  training-patterns.md    — load tolerance, VO2 trajectory
  weekly-observations.md  — rolling log, updated every session
  correlations.md         — cross-domain findings
  archive/                — pre-synthesis snapshots
```

**Python files retired:** `orchestrator.py`, `data_fetcher.py`, `db_query_server.py`, `vault_query_server.py`, `check_signal.py`, `mcp-config.json`. The signal-file trigger mechanism is replaced by `node-cron` inside Express.

**Python files kept:** `garmin_poller.py`, `garmin_ingest.py`, `garmin_auth.py` — Garmin data collection is unrelated and stays Python.

**npm dependencies added:**
**Server (`package.json`):**
- `ai` — Vercel AI SDK core
- `@ai-sdk/google` — Gemini provider
- `@ai-sdk/anthropic` — Anthropic provider (for future use)
- `@ai-sdk/openai` — OpenAI provider (for future use)
- `node-cron` — scheduled nightly run

**Client (`client/package.json`):**
- `ai` — Vercel AI SDK (includes `useChat` hook via `ai/react`)
- `react-markdown` — Markdown renderer for briefing body field

---

## Phase 1: Settings Page + AI Provider Layer

### 1.1 Database — `app_settings` table

```sql
CREATE TABLE IF NOT EXISTS app_settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
```

Default rows (inserted on first boot if not present):

| key | default value |
|---|---|
| `ai_provider` | `google` |
| `ai_api_key` | `""` |
| `mx4_briefing_model` | `gemini-2.5-flash` |
| `mx4_chat_model` | `gemini-2.5-flash` |
| `mx4_nightly_enabled` | `true` |
| `mx4_nightly_time` | `04:00` |
| `mx4_on_sync_enabled` | `true` |

### 1.2 Settings API

**`GET /api/settings`** — returns all settings as `{ key: value }` object. API key is masked: only last 4 chars visible (`****...abcd`).

**`PUT /api/settings/:key`** — updates a single key. On `mx4_nightly_time` or `mx4_nightly_enabled` change, reschedules the `node-cron` job live (no restart required).

### 1.3 Settings Page — UI

**Route:** `/settings` via React Router.
**TopBar:** back chevron + MX-4 cyan sigil + `CONFIGURATION` label.
**Section accent:** `#2bc4e8` (MX-4 cyan — this is a system page, not a health section).
**Access:** added to the NavSheet (All Systems slide-up) as a non-health system entry below the channel grid.

Layout — three Rail sections, each collapsible and expandable for future additions:

```
── AI PROVIDER ────────────────────────────────────────
  Provider        [Gemini]  [Claude]  [OpenAI]
  API Key         [••••••••••••••••••]  [Test]

── MX-4 INTELLIGENCE ──────────────────────────────────
  Briefing model  [gemini-2.5-flash ▾]
  Chat model      [gemini-2.5-flash ▾]
  Nightly sync    [toggle]  at  [04:00]
  Sync on Garmin  [toggle]
  Last run        Jun 14, 2026  03:47  (read-only, live from mx4_briefings)

── GARMIN ─────────────────────────────────────────────
  (placeholder rail — for future sync preferences)
```

- Provider selector is a segmented control (3 options). Switching provider resets the model dropdowns to valid models for that provider.
- API key field shows masked text. **Test** fires a minimal API call (single-token generation) and returns a ✓ or error inline.
- Model dropdowns show a hardcoded list per provider (updated as new models release via a `SUPPORTED_MODELS` constant in `provider.ts`).
- All fields save on change (no submit button) with a brief `SAVED ·` flash in monospace next to the changed field.
- Nightly time is a plain text input (`HH:MM` format) with validation — only valid when `mx4_nightly_enabled` is on.
- "Last run" reads `MAX(generated_at)` from `mx4_briefings`. Shows `—` if no briefing exists yet.

### 1.4 AI Provider Layer — `server/lib/ai/provider.ts`

The provider layer reads `app_settings` at **call time** (not at startup), so key/model changes take effect on the next call without a server restart.

```typescript
// The two functions everything downstream calls.
// Provider, model, and key are invisible to callers.

export async function generateBriefing(
  section: SectionDef,
  dataContext: string,
  wikiContext: string,
): Promise<BriefingResult>

export function streamChat(
  messages: Message[],
  wikiContext: string,
): StreamTextResult
```

`BriefingResult`:
```typescript
interface BriefingResult {
  tone: 'POSITIVE' | 'CAUTION' | 'FLAG'
  headline: string
  body: string           // Markdown — MX-4's voice lives here
  recommendation: string // one specific, concrete action
  flags: string[]        // additional observations worth surfacing
}
```

Provider switching is a single import swap:
```typescript
const model = provider === 'google'    ? google(modelId)
            : provider === 'anthropic' ? anthropic(modelId)
            : openai(modelId)
```

**Gemini-specific config:** `useSearchGrounding: true` is set on the Gemini provider instance. This enables native Google Search grounding at no extra cost. Providers that don't support it ignore the flag gracefully. An explicit search tool API is not built now but noted as a future fallback for non-Gemini providers.

---

## Phase 2: Orchestrator + Wiki + Briefing Delivery

### 2.1 MX-4 Tools — `server/lib/ai/tools.ts`

All tools are TypeScript functions defined for the Vercel AI SDK `tools` parameter. Same tool set used by both briefings and chat.

| Tool | Description |
|---|---|
| `queryDb(sql)` | Read-only SQLite query. Allowlist enforced: SELECT only, no schema-modifying statements. |
| `readVault(relativePath)` | Reads a file from `/mnt/vault/wiki/`. Returns file content or graceful error string if vault not mounted. |
| `readAllWikiPages()` | Reads every `mx4/wiki/*.md` file and returns concatenated content with page headers. Called once at session start. |
| `writeWikiPage(name, content)` | Writes `mx4/wiki/{name}.md`. Returns token count estimate. If count exceeds 1500, returns a warning that synthesis is required. |
| `listWikiPages()` | Returns array of `{ name, lineCount, tokenEstimate }` for all wiki pages. Used by wrap step. |
| `archiveWikiPage(name)` | Copies current page to `mx4/wiki/archive/YYYY-MM-DD-{name}.md` before MX-4 rewrites it with a synthesis. |

### 2.2 Sections — `server/lib/ai/sections.ts`

Ported from `mx4/sections.py` with corrected metric names. "Patient" language in prompt addenda is removed — MX-4 does not have patients.

Corrected metric name mapping (from stale Python names → actual DB names):

| Old (stale) | Correct |
|---|---|
| `hrv_5min_high` | `hrv_baseline_high` |
| `recovery_time_hours` | `recovery_time_h` |
| `stress_score` | `stress_avg` |
| `body_battery` | `body_battery_charged`, `body_battery_drained`, `body_battery_wake`, `body_battery_current` |

Section IDs aligned with the insights API and existing page routes: `recovery`, `sleep`, `training`. (Old IDs `sleep-quality`, `training-week`, `vo2-fitness` are retired.)

### 2.3 Orchestrator — `server/lib/ai/orchestrator.ts`

Replaces `mx4/orchestrator.py`. All scheduling is via `node-cron` inside Express (replaces `check_signal.py`).

**Run sequence:**

```
1. Read app_settings → check enabled flags, get models and API key
2. readAllWikiPages() → wiki context string
3. Read mx4/HEARTBEAT.md → append to system context
4. For each section in SECTIONS:
   a. Pre-fetch 30 days of section metrics via queryDb
   b. Build section prompt (section def + pre-fetched data + wiki context)

   — Step 1: Analysis —
   c. generateText({
        model: briefingModel,
        system: MX4_SYSTEM_PROMPT + HEARTBEAT,
        prompt: sectionPrompt,
        tools: { queryDb, readVault, readAllWikiPages },
        maxSteps: 8
      })
      → fullAnalysis: string (MX-4's reasoning + findings in his voice)

   — Step 2: Extraction —
   d. generateObject({
        model: briefingModel,
        schema: BriefingResultSchema,   // Zod schema, no tools
        prompt: `Extract structured briefing from this analysis:\n\n${fullAnalysis}`
      })
      → { tone, headline, body, recommendation, flags }

   e. Upsert mx4_briefings (section, content_json, generated_at, model)

5. Run wrap step (server/lib/ai/wrap.ts)
6. Discord notify on failure (if DISCORD_WEBHOOK_URL env var set)
```

**Triggers (via `node-cron`):**
- **Nightly:** cron reads `mx4_nightly_time` from settings. Checks `mx4_nightly_enabled` before firing. Rescheduled live when either setting changes.
- **Manual:** `POST /api/mx4/run` triggers immediately, always runs regardless of enable toggle.
- **Post-sync stale check:** After Garmin sync completes, checks `mx4_on_sync_enabled`. If enabled, compares `MAX(generated_at)` from `mx4_briefings` vs `MAX(date)` from `garmin_snapshots`. If briefings are stale (older than latest data date), queues a run.

**Error handling:** Per-section retry (up to 3 attempts, 30s delay). Usage-limit errors short-circuit immediately. Section failure is logged and recorded; other sections still run.

### 2.4 Briefing Delivery

**Database — `mx4_briefings` table:**

```sql
CREATE TABLE IF NOT EXISTS mx4_briefings (
  section      TEXT PRIMARY KEY,
  content_json TEXT NOT NULL,     -- JSON: { tone, headline, body, recommendation, flags }
  generated_at TEXT NOT NULL,
  model        TEXT NOT NULL
);
```

One row per section. Each run upserts — only the latest briefing lives in the table.

**API:** `GET /api/insights/:section` reads from `mx4_briefings`. Returns the `content_json` parsed to object, or a fallback stub object if no row exists. The `.html` file approach is retired. The `insights/` directory is kept (with `.gitkeep`) for potential future use.

**Frontend:** `TransmissionPanel` and `MX4Briefing` components fetch `GET /api/insights/:section` on mount. `body` is rendered via `react-markdown`. The `tone` field drives the existing verdict badge. `headline`, `recommendation`, and `flags` map to existing card layout slots.

### 2.5 Wiki System

**Structure:**

```
mx4/wiki/
  SCHEMA.md               — how MX-4 organizes, writes, and maintains pages
  HEARTBEAT.md            — standing orders; read at the start of every run
  ethan-profile.md        — role, goals, declared targets, training history
  hrv-patterns.md         — autonomic patterns, observed correlations
  sleep-patterns.md       — architecture tendencies, stage deficits
  training-patterns.md    — load tolerance, VO2 trajectory
  weekly-observations.md  — rolling ~14-day log of notable findings
  correlations.md         — cross-domain patterns (sleep ↔ HRV, load ↔ recovery)
  archive/
    YYYY-MM-DD-{name}.md  — pre-synthesis snapshots
```

**Context loading:** MX-4 does not search the wiki. At the start of every session (briefing run or chat), `readAllWikiPages()` loads all pages into context. At Gemini 2.5 Flash's 1M token context window, a fully grown wiki (~30 pages × 1500 tokens = 45K tokens) represents ~4.5% of capacity. No vector index, no ChromaDB, no re-indexing required.

**Page length discipline:**
- Soft limit: 1500 tokens (~1200 words). `writeWikiPage()` returns a warning if exceeded.
- Hard enforcement: the wrap step detects any page over 2000 tokens and requires MX-4 to synthesize it. Raw observations become distilled patterns; the old version is archived before rewriting.
- Result: pages stay dense and accurate rather than growing into observation logs.

**SCHEMA.md** defines:
- What each page covers and how it's organized
- That `weekly-observations.md` is a rolling window (oldest entries drop off at ~1500 tokens)
- That `ethan-profile.md` contains only stable facts (goals, background) — not observations
- Archive naming convention

**HEARTBEAT.md** (created here for the first time) defines:
```markdown
# MX-4 Standing Orders
Last updated: YYYY-MM-DD

## Current Focus
[What MX-4 should pay particular attention to this week]

## Suppressions
[Anything he should not repeat from last run]

## Context
[Anything from the Vault or external context MX-4 should know]
```

### 2.6 Wrap Step — `server/lib/ai/wrap.ts`

**Triggered by:**
- Orchestrator: synchronously after all sections complete
- Chat: asynchronously when AskSheet closes (`POST /api/mx4/chat/end-session`) — fire-and-forget, does not block the UI

**Sequence:**

```
1. listWikiPages() → check sizes
2. queryDb(recent data) → lint: do any page claims contradict current DB values?
   (e.g., "VO2 max baseline 51" but DB shows 54 for last 7 days)
3. For any page > 2000 tokens:
   a. archiveWikiPage(name)
   b. generateText → synthesize: compress observations into patterns
   c. writeWikiPage(name, synthesis)
4. For any stale facts detected in step 2:
   → generateText → correct in-place
5. writeWikiPage("weekly-observations", updated rolling log)
```

The wrap step uses the same provider/model as briefings. It is a light call — no tool loops, short output. On failure it logs and exits cleanly; it does not block the next briefing run.

---

## Phase 3: Chat

### 3.1 Chat API

**`POST /api/mx4/chat`** — streaming endpoint.

`sessionId` is a UUID generated client-side when AskSheet opens (`crypto.randomUUID()`). It persists for the lifetime of that sheet open/close cycle and is used to group messages in `mx4_chat_messages`.

```typescript
// Request body
{ messages: Message[], sessionId: string }

// Response
// SSE stream via result.pipeUIMessageStreamToResponse(res)
```

```typescript
const wikiContext = await readAllWikiPages()

const result = streamText({
  model: google(chatModel),
  system: MX4_SYSTEM_PROMPT + wikiContext,
  messages,
  tools: { queryDb, readVault, writeWikiPage, listWikiPages },
  maxSteps: 5,
})

result.pipeUIMessageStreamToResponse(res)
```

MX-4 uses tools during chat if Ethan asks about specific data ("what was my HRV last Tuesday?") — `queryDb` handles it. If Ethan shares important personal context ("I'm starting a new training block next week"), MX-4 can call `writeWikiPage` to note it. He never generates structured JSON during chat — plain Markdown text streamed in his voice.

**`GET /api/mx4/chat/messages`** — returns last 50 messages from `mx4_chat_messages` for the active session.

**`POST /api/mx4/chat/end-session`** — fires the wrap step asynchronously. Returns 202 immediately. AskSheet calls this `onClose`.

### 3.2 Chat Storage — `mx4_chat_messages` table

```sql
CREATE TABLE IF NOT EXISTS mx4_chat_messages (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id  TEXT NOT NULL,
  role        TEXT NOT NULL,   -- 'user' | 'assistant'
  content     TEXT NOT NULL,
  created_at  TEXT NOT NULL
);
CREATE INDEX idx_chat_session ON mx4_chat_messages(session_id, created_at);
```

Active context window for each chat call: last 20 messages from `mx4_chat_messages` (rolling). Full history is stored and retained but older messages are not fed into the model context — the wiki synthesizes what matters from past sessions.

### 3.3 AskSheet Wiring

The AskSheet UI is already built — the visual shell, greeting bubble, suggested prompts, input bar, and send button all exist. What needs to be wired:

- Input becomes a real `<textarea>` (currently a fake div)
- Send button posts to `POST /api/mx4/chat`
- Response streams into new message bubbles via `useChat` (Vercel AI SDK UI hook)
- `onClose` prop calls `POST /api/mx4/chat/end-session` before closing
- Suggested prompts become tappable (fill input and submit)
- MX-4 sigil switches to `mood="think"` while streaming, back to `mood="pleased"` on complete

No visual redesign of AskSheet — it is already correct.

---

## New Files

| File | Action |
|---|---|
| `server/lib/ai/provider.ts` | Create |
| `server/lib/ai/tools.ts` | Create |
| `server/lib/ai/sections.ts` | Create (port from `mx4/sections.py`) |
| `server/lib/ai/orchestrator.ts` | Create (replaces `mx4/orchestrator.py`) |
| `server/lib/ai/wiki.ts` | Create |
| `server/lib/ai/wrap.ts` | Create |
| `server/api/settings.ts` | Create |
| `mx4/wiki/SCHEMA.md` | Create |
| `mx4/HEARTBEAT.md` | Create — at `mx4/` root, not inside `wiki/`; read by orchestrator, not a knowledge page |
| `mx4/wiki/ethan-profile.md` | Create — seeded with Ethan's profile from `docs/MX4.md` and `CLAUDE.md` (name, role, goals, training targets, declared VO2 target, wedding timeline) |
| `mx4/wiki/weekly-observations.md` | Create (empty, MX-4 fills on first run) |
| `mx4/wiki/hrv-patterns.md` | Create (empty) |
| `mx4/wiki/sleep-patterns.md` | Create (empty) |
| `mx4/wiki/training-patterns.md` | Create (empty) |
| `mx4/wiki/correlations.md` | Create (empty) |
| `mx4/wiki/archive/.gitkeep` | Create |
| `client/src/pages/SettingsPage.tsx` | Create |

## Modified Files

| File | Change |
|---|---|
| `server/index.ts` | Mount settings route; init node-cron scheduler; add app_settings + mx4_briefings + mx4_chat_messages table creation |
| `server/api/mx4.ts` | Add `/chat`, `/chat/end-session` endpoints; update `/run` to use TypeScript orchestrator |
| `server/api/insights.ts` | Read from `mx4_briefings` table instead of `.html` files |
| `client/src/App.tsx` | Add `/settings` route |
| `client/src/components/BottomSheet.tsx` | Add Settings entry to nav sheet |
| `client/src/components/AskSheet.tsx` | Wire input, streaming, session-end hook |
| `client/src/components/MX4Card.tsx` | `MX4Briefing` fetches from insights API; renders `body` via react-markdown |

## Retired Files

`mx4/orchestrator.py`, `mx4/data_fetcher.py`, `mx4/db_query_server.py`, `mx4/vault_query_server.py`, `mx4/check_signal.py`, `mx4/mcp-config.json`

These files are deleted, not archived — their logic lives in the TypeScript replacements. `mx4/system-prompt.md`, `mx4/sections.py` (for reference), and `mx4/garmin-data-reference.md` are kept as documentation.

---

## Implementation Order

**Phase 1** (this plan): Settings page + AI provider layer
→ User can enter API key, test it, configure models and toggles. Provider layer reads from settings. No briefings or chat yet.

**Phase 2** (next plan): Orchestrator + Wiki + Briefing delivery
→ MX-4 runs for the first time. Real briefings replace stub text. Wiki is seeded. Sections display live analysis.

**Phase 3** (following plan): Chat wiring
→ AskSheet becomes a live conversation. Session wrap fires on close.

---

## Key Constraints

- Inline styles only in all React components — no CSS files, no Tailwind classes
- No light mode
- All numbers/labels in `JetBrains Mono`; prose in `Hanken Grotesk`
- Colors from `theme.ts` only — never hardcode hex in components
- Settings page uses MX-4 cyan (`#2bc4e8`) as accent
- `generateObject` (extraction step) runs without tools — avoids known Gemini tools + structured output conflict
- `readAllWikiPages()` is called once per session, not per tool call — wiki context is attached to system prompt
- Wrap step on chat is always async (fire-and-forget on AskSheet close) — never blocks user
- `queryDb` enforces SELECT-only — no write access to garmin data from MX-4 tools
