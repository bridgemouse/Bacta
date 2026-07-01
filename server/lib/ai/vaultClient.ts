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
      description: 'List all pages in the connected LLM-Wiki vault, optionally filtered by domain.',
      inputSchema: z.object({
        domain: z.string().optional(),
      }),
      execute: async ({ domain }) => {
        const result = await client.callTool({ name: 'list_wiki_pages', arguments: { domain } })
        return result
      },
    }),
    get_wiki_index: tool({
      description: 'Get the wiki index — the master catalog of all pages. Read this first to orient before reading individual pages.',
      inputSchema: z.object({}),
      execute: async () => {
        const result = await client.callTool({ name: 'get_wiki_index', arguments: {} })
        return result
      },
    }),
  }
}
