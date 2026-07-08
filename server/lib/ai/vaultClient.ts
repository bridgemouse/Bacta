import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js'
import { tool } from 'ai'
import { z } from 'zod'
import { getSetting } from '../settings'
import { logEvent } from '../logger'

// Error, not Error: unknown rejections can be plain error-shaped objects
// ({ code, message }, common from MCP/JSON-RPC transports) rather than Error
// instances — String(obj) would collapse those to "[object Object]".
function errorDetail(e: unknown): string {
  if (e instanceof Error) return e.message
  if (e && typeof e === 'object' && 'message' in e) return String((e as { message: unknown }).message)
  return String(e)
}

function logVaultToolFailure(toolName: string, e: unknown): void {
  console.error(`[mx4] vault tool ${toolName} failed:`, e)
  try {
    logEvent('mx4', 'error', `${toolName} failed: ${errorDetail(e)}`)
  } catch (logErr: unknown) {
    console.error('[mx4] failed to log vault tool failure:', logErr)
  }
}

let _client: Client | null = null

async function getClient(): Promise<Client | null> {
  if (!isVaultEnabled()) return null
  if (_client) return _client

  const url = getSetting('vault_url') ?? ''
  const client = new Client({ name: 'bacta-mx4', version: '1.0.0' }, { capabilities: {} })
  const transport = new SSEClientTransport(new URL(`${url}/sse`))
  try {
    await client.connect(transport)
  } catch (e) {
    _client = null
    throw e
  }
  _client = client
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
      description: 'Full-text search across the connected LLM-Wiki vault. Use this before read_wiki_page to find relevant pages.',
      inputSchema: z.object({
        query:  z.string(),
        domain: z.string().optional(),
      }),
      execute: async ({ query, domain }) => {
        try {
          return await client.callTool({ name: 'search_wiki', arguments: { query, domain } })
        } catch (e) {
          logVaultToolFailure('search_wiki', e)
          return { error: 'search_wiki unavailable — the vault connection dropped mid-session.' }
        }
      },
    }),
    read_wiki_page: tool({
      description: "Read a specific page from the connected LLM-Wiki vault by path, e.g. 'health-fitness/overview.md'",
      inputSchema: z.object({
        path: z.string(),
      }),
      execute: async ({ path }) => {
        try {
          return await client.callTool({ name: 'read_wiki_page', arguments: { path } })
        } catch (e) {
          logVaultToolFailure('read_wiki_page', e)
          return { error: 'read_wiki_page unavailable — the vault connection dropped mid-session.' }
        }
      },
    }),
    list_wiki_pages: tool({
      description: 'List all pages in the connected LLM-Wiki vault, optionally filtered by domain.',
      inputSchema: z.object({
        domain: z.string().optional(),
      }),
      execute: async ({ domain }) => {
        try {
          return await client.callTool({ name: 'list_wiki_pages', arguments: { domain } })
        } catch (e) {
          logVaultToolFailure('list_wiki_pages', e)
          return { error: 'list_wiki_pages unavailable — the vault connection dropped mid-session.' }
        }
      },
    }),
    get_wiki_index: tool({
      description: 'Get the wiki index — the master catalog of all pages. Read this first to orient before reading individual pages.',
      inputSchema: z.object({}),
      execute: async () => {
        try {
          return await client.callTool({ name: 'get_wiki_index', arguments: {} })
        } catch (e) {
          logVaultToolFailure('get_wiki_index', e)
          return { error: 'get_wiki_index unavailable — the vault connection dropped mid-session.' }
        }
      },
    }),
  }
}
