# LLM-Wiki Vault Integration — Bacta Implementation Spec

## What was built

`llm-wiki-mcp` is a standalone MCP server (Python) that serves any directory of `.md` files as four MCP tools over HTTP/SSE. It lives at `github.com/bridgemouse/llm-wiki-mcp` and is running on LXC 106 (`192.168.1.202:8765`) pointed at the ObsidianVault wiki.

**Health check:** `GET http://192.168.1.202:8765/health` → `{ ok, wiki_root, domains, page_count }`

**SSE endpoint:** `http://192.168.1.202:8765/sse`

**Tools exposed (via MCP protocol):**

| Tool | Input | Description |
|---|---|---|
| `list_wiki_pages` | `domain?: string` | List all pages, optionally filtered by domain subdirectory |
| `read_wiki_page` | `path: string` | Read a page by path relative to wiki root, e.g. `"health-fitness/overview.md"` |
| `search_wiki` | `query: string, domain?: string` | Full-text search, returns ranked excerpts |
| `get_wiki_index` | _(none)_ | Read `index.md` — the master page catalog |

---

## What Bacta needs to implement

### 1. npm dependency

```
npm install @modelcontextprotocol/sdk
```

### 2. New settings rows

In `server/lib/settings.ts`, add to `SETTING_DEFAULTS`:

```typescript
vault_enabled: 'false',
vault_url:     '',
```

### 3. New file: `server/lib/ai/vaultClient.ts`

Manages the MCP client lifecycle and returns vault tools as Vercel AI SDK `tool()` objects. The vault tools have known schemas so define them statically — avoids JSON Schema → Zod runtime conversion.

```typescript
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js'
import { tool } from 'ai'
import { z } from 'zod'
import { getSetting } from '../settings'

let _client: Client | null = null

async function getClient(): Promise<Client | null> {
  if (!isVaultEnabled()) return null
  if (_client) return _client

  const url = getSetting('vault_url') ?? ''
  _client = new Client({ name: 'bacta-mx4', version: '1.0.0' }, { capabilities: {} })
  const transport = new SSEClientTransport(new URL(`${url}/sse`))
  await _client.connect(transport)
  return _client
}

export function isVaultEnabled(): boolean {
  return getSetting('vault_enabled') === 'true' && !!getSetting('vault_url')
}

export function resetVaultClient(): void {
  _client = null
}

export async function testVaultConnection(): Promise<{ ok: boolean; error?: string; details?: object }> {
  try {
    const url = getSetting('vault_url') ?? ''
    const res = await fetch(`${url}/health`)
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` }
    const data = await res.json()
    return { ok: true, details: data }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

export async function getVaultTools() {
  const client = await getClient()
  if (!client) return {}

  return {
    search_wiki: tool({
      description: "Full-text search across the connected LLM-Wiki vault. Use this before read_wiki_page to find relevant pages.",
      inputSchema: z.object({
        query:  z.string(),
        domain: z.string().optional(),
      }),
      execute: async ({ query, domain }) => {
        const result = await client.callTool({ name: 'search_wiki', arguments: { query, domain } })
        return result
      },
    }),
    read_wiki_page: tool({
      description: "Read a specific page from the connected LLM-Wiki vault by path, e.g. 'health-fitness/overview.md'",
      inputSchema: z.object({
        path: z.string(),
      }),
      execute: async ({ path }) => {
        const result = await client.callTool({ name: 'read_wiki_page', arguments: { path } })
        return result
      },
    }),
    list_wiki_pages: tool({
      description: "List all pages in the connected LLM-Wiki vault, optionally filtered by domain.",
      inputSchema: z.object({
        domain: z.string().optional(),
      }),
      execute: async ({ domain }) => {
        const result = await client.callTool({ name: 'list_wiki_pages', arguments: { domain } })
        return result
      },
    }),
    get_wiki_index: tool({
      description: "Get the wiki index — the master catalog of all pages. Read this first to orient before reading individual pages.",
      inputSchema: z.object({}),
      execute: async () => {
        const result = await client.callTool({ name: 'get_wiki_index', arguments: {} })
        return result
      },
    }),
  }
}
```

**Client lifecycle note:** The singleton `_client` persists across orchestrator runs within the same server process. Call `resetVaultClient()` if `vault_url` or `vault_enabled` changes (wire this into the settings `PUT` handler for those two keys alongside `scheduleNightly()`).

### 4. Orchestrator changes (`server/lib/ai/orchestrator.ts`)

Import and merge vault tools into each section run:

```typescript
import { getVaultTools, isVaultEnabled } from './vaultClient'
```

In `runSection()`, replace the static tools object:

```typescript
// Before:
tools: { queryDb, readVault, readAllWikiPages },

// After:
tools: {
  queryDb,
  readAllWikiPages,
  ...(isVaultEnabled() ? await getVaultTools() : {}),
},
```

Remove the old `readVault` tool from the tools object — `read_wiki_page` from vaultClient replaces it.

Update the section prompt's tool hint line to mention vault tools when enabled:

```typescript
`Use queryDb to pull the last 30 days of relevant metrics. ${
  isVaultEnabled()
    ? 'Use get_wiki_index then read_wiki_page or search_wiki to pull personal context from the connected vault.'
    : ''
} Use readAllWikiPages if you need to review accumulated MX-4 knowledge.`
```

### 5. `tools.ts` cleanup

Remove the `readVault` tool export entirely — it's replaced by `vaultClient.ts`. The `VAULT_ROOT` constant and its filesystem read can go with it.

### 6. Settings API addition (`server/api/settings.ts`)

Add a test-vault-connection route (mirrors the existing `test-connection` route):

```typescript
import { testVaultConnection, resetVaultClient } from '../lib/ai/vaultClient'

settingsRouter.post('/test-vault-connection', async (_req, res) => {
  const result = await testVaultConnection()
  res.json(result)
})
```

In the `PUT /:key` handler, reset the vault client when its settings change:

```typescript
if (key === 'vault_enabled' || key === 'vault_url') {
  resetVaultClient()
}
```

### 7. Settings page UI (`client/src/pages/SettingsPage.tsx`)

Add a new Rail section between "MX-4 INTELLIGENCE" and "DATA MANAGEMENT":

```
Rail label="VAULT" accent={MX4_COLOR}
```

Card with two rows:

**Row 1:** Toggle "Connect LLM-Wiki" → saves `vault_enabled`

**Row 2 (visible only when `vault_enabled === 'true'`):**
- Label: "Vault URL"
- Input: text field, placeholder `http://192.168.1.x:8765`
- Saves to `vault_url` on blur or Enter
- `savedBadge('vault_url')` inline

**Row 3 (visible only when `vault_enabled === 'true'`):**
- Test connection button → `POST /api/settings/test-vault-connection`
- Same `TestStatus` pattern as the existing API key test
- On success, show `{ domains, page_count }` from response details inline as a FONT_MONO dim line (e.g. `4 DOMAINS · 34 PAGES`)

Use the existing `Toggle` component, `rowStyle` / `rowStyleLast`, `cardStyle`, `labelStyle`, `selectStyle` constants — do not introduce new style patterns.

---

## Files changed summary

| File | Change |
|---|---|
| `package.json` | Add `@modelcontextprotocol/sdk` |
| `server/lib/settings.ts` | Add `vault_enabled`, `vault_url` to `SETTING_DEFAULTS` |
| `server/lib/ai/vaultClient.ts` | **New** — MCP client, vault tools, test connection |
| `server/lib/ai/tools.ts` | Remove `readVault` tool and `VAULT_ROOT` |
| `server/lib/ai/orchestrator.ts` | Import vault tools, merge into `generateText` tools object, update prompt hint |
| `server/api/settings.ts` | Add `POST /test-vault-connection`, reset client on vault key changes |
| `client/src/pages/SettingsPage.tsx` | Add VAULT section with toggle, URL input, test button |

---

## For your vault

LXC 106 (`192.168.1.202`) runs `llm-wiki-mcp` as a systemd service on port 8765, pointed at `/home/wheat/ObsidianVault/wiki`. Once the service is up, set `vault_url = http://192.168.1.202:8765` in settings and toggle vault on. MX-4 will call `get_wiki_index` on the next briefing run to orient, then use `search_wiki` and `read_wiki_page` to pull relevant context per section.
