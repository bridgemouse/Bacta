import { tool } from 'ai'
import { z } from 'zod'
import dns from 'dns'
import net from 'net'
import { getSetting } from '../settings'
import { logEvent } from '../logger'

// Provider-agnostic research tool for MX-4.
//
// Scholarly backend (primary, KEYLESS): OpenAlex — peer-reviewed / primary
// science with real DOIs. Always available.
// Web backend (secondary, OPTIONAL): Tavily or Exa for current/non-academic
// context — only when research_provider + research_api_key are configured.
//
// Privacy: only the scientific question is sent outbound. Never include the
// user's biometric values or personal records in the query (enforced by the
// tool description + the system-prompt's untrusted-content policy).

const RESEARCH_DESCRIPTION = `Search for information across two backends — scholarly literature and the general web.

**Scholarly backend (always available, keyless):** OpenAlex — peer-reviewed papers with real DOIs. Best for exercise science, sleep, nutrition, physiology, HRV research, and similar academic topics. Will return nothing for consumer product specs or manufacturer documentation.

**Web backend (requires configuration):** Tavily or Exa — general web search, can find anything: device specs, product pages, manufacturer documentation, news, non-academic content. Only active when research_provider + research_api_key are set in settings. If web results are empty, the backend is not configured — not that nothing exists on the web.

Use this tool freely for any lookup — scientific or otherwise. If web results come back empty on a non-academic query, tell the user the web backend isn't configured and they can add a Tavily or Exa key in Settings to enable it.

Guidance:
- For scholarly results: cite title, year, and DOI/URL. NEVER invent a citation.
- For web results: summarise what was found and link the source.
- If nothing is found on either backend for a scientific topic, say so — do not fabricate.
- Never include personal biometric values in the query.`

// Node's fetch throws a generic TypeError('fetch failed') for network-level
// failures (DNS, connection refused, TLS) with the real reason nested in
// .cause — and non-Error rejections (e.g. JSON-RPC-shaped objects) would
// otherwise collapse to "[object Object]" via bare String(e).
function errorDetail(e: unknown): string {
  if (e instanceof Error) {
    const cause = (e as Error & { cause?: unknown }).cause
    if (cause) return `${e.message}: ${cause instanceof Error ? cause.message : String(cause)}`
    return e.message
  }
  if (e && typeof e === 'object' && 'message' in e) return String((e as { message: unknown }).message)
  return String(e)
}

function logResearchFailure(message: string): void {
  try {
    logEvent('mx4-research', 'error', message)
  } catch (logErr: unknown) {
    console.error('[mx4] failed to log research failure:', logErr)
  }
}

interface Source {
  title: string
  year: number | null
  authors: string
  venue: string | null
  doi: string | null
  url: string | null
  citations: number | null
  abstract: string | null
}

function reconstructAbstract(inverted: Record<string, number[]> | null | undefined): string | null {
  if (!inverted) return null
  const positions: Array<[number, string]> = []
  for (const [word, idxs] of Object.entries(inverted)) {
    for (const i of idxs) positions.push([i, word])
  }
  if (positions.length === 0) return null
  positions.sort((a, b) => a[0] - b[0])
  const text = positions.map(p => p[1]).join(' ')
  return text.length > 600 ? text.slice(0, 600) + '…' : text
}

async function searchOpenAlex(query: string, limit: number): Promise<Source[]> {
  const url = `https://api.openalex.org/works?search=${encodeURIComponent(query)}` +
    `&per_page=${limit}&sort=relevance_score:desc&mailto=bacta@local`
  const resp = await fetch(url, { signal: AbortSignal.timeout(12_000) })
  if (!resp.ok) throw new Error(`OpenAlex ${resp.status}`)
  const data = await resp.json() as { results?: any[] }
  return (data.results ?? []).map((w): Source => ({
    title: w.title ?? w.display_name ?? '(untitled)',
    year: w.publication_year ?? null,
    authors: (w.authorships ?? []).slice(0, 4).map((a: any) => a.author?.display_name).filter(Boolean).join(', ')
      + ((w.authorships?.length ?? 0) > 4 ? ', et al.' : ''),
    venue: w.primary_location?.source?.display_name ?? null,
    doi: w.doi ?? null,
    url: w.doi ?? w.primary_location?.landing_page_url ?? w.open_access?.oa_url ?? null,
    citations: w.cited_by_count ?? null,
    abstract: reconstructAbstract(w.abstract_inverted_index),
  }))
}

async function searchWeb(query: string, limit: number): Promise<Source[]> {
  const provider = getSetting('research_provider') ?? 'none'
  const key = getSetting('research_api_key') ?? ''
  if (provider === 'none' || !key) return []
  try {
    if (provider === 'tavily') {
      const resp = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: key, query, max_results: limit }),
        signal: AbortSignal.timeout(12_000),
      })
      if (!resp.ok) return []
      const data = await resp.json() as { results?: any[] }
      return (data.results ?? []).map((r): Source => ({
        title: r.title ?? '(untitled)', year: null, authors: '', venue: 'web',
        doi: null, url: r.url ?? null, citations: null,
        abstract: typeof r.content === 'string' ? r.content.slice(0, 600) : null,
      }))
    }
    if (provider === 'exa') {
      const resp = await fetch('https://api.exa.ai/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': key },
        body: JSON.stringify({ query, numResults: limit, contents: { text: { maxCharacters: 600 } } }),
        signal: AbortSignal.timeout(12_000),
      })
      if (!resp.ok) return []
      const data = await resp.json() as { results?: any[] }
      return (data.results ?? []).map((r): Source => ({
        title: r.title ?? '(untitled)', year: null, authors: '', venue: 'web',
        doi: null, url: r.url ?? null, citations: null,
        abstract: typeof r.text === 'string' ? r.text.slice(0, 600) : null,
      }))
    }
  } catch (e: unknown) {
    console.error(`[mx4] research: ${provider} web search failed:`, e)
    logResearchFailure(`${provider} web search failed for query "${query}": ${errorDetail(e)}`)
    return []  // web backend is best-effort; scholarly still returns
  }
  return []
}

const FETCH_PAGE_DESCRIPTION = `Fetch a specific URL (found via research or provided by the user) and return its parsed text content.

Use this when the answer lives inside a specific page or thread rather than a search snippet — e.g. a Reddit thread, a manufacturer spec page, an article. The 'research' tool can find a link; this tool reads what's actually on it.

Only works on text/HTML pages — not images, videos, PDFs, or pages requiring login.`

const MAX_PAGE_TEXT_LENGTH = 6000
const MAX_RESPONSE_BYTES = 5 * 1024 * 1024  // 5MB — a malicious/oversized page shouldn't buffer unbounded in memory

// SSRF guard: fetchPage's target URL is model-chosen and can be seeded by
// untrusted content (a research result, a page MX-4 already read). The home
// LAN is not a trust boundary (docs/SECURITY.md), so the server must refuse
// to fetch internal/loopback/link-local addresses on its own behalf, not
// rely on prompt instructions alone.
const BLOCKED_HOSTNAMES = new Set(['localhost', '0.0.0.0'])

function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split('.').map(Number)
  if (parts.length !== 4 || parts.some(p => Number.isNaN(p))) return false
  const [a, b] = parts
  if (a === 127) return true                        // loopback
  if (a === 10) return true                          // 10.0.0.0/8
  if (a === 172 && b >= 16 && b <= 31) return true    // 172.16.0.0/12
  if (a === 192 && b === 168) return true             // 192.168.0.0/16
  if (a === 169 && b === 254) return true             // link-local (incl. cloud metadata)
  if (a === 100 && b >= 64 && b <= 127) return true    // CGNAT
  if (a === 0) return true                            // "this" network
  return false
}

function isPrivateIPv6(ip: string): boolean {
  const lower = ip.toLowerCase()
  if (lower === '::1') return true
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true  // fc00::/7 (unique local)
  if (lower.startsWith('fe80')) return true                          // link-local
  if (lower.startsWith('::ffff:')) return isPrivateIPv4(lower.slice(7))
  return false
}

async function assertPublicUrl(rawUrl: string): Promise<void> {
  const parsed = new URL(rawUrl)
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`Blocked protocol: ${parsed.protocol}`)
  }
  const hostname = parsed.hostname.replace(/^\[|\]$/g, '')
  if (BLOCKED_HOSTNAMES.has(hostname.toLowerCase())) {
    throw new Error('Blocked local/internal hostname')
  }
  const ipVersion = net.isIP(hostname)
  if (ipVersion === 4 && isPrivateIPv4(hostname)) throw new Error('Blocked private IPv4 target')
  if (ipVersion === 6 && isPrivateIPv6(hostname)) throw new Error('Blocked private IPv6 target')
  if (ipVersion === 0) {
    const { address, family } = await dns.promises.lookup(hostname)
    if (family === 4 && isPrivateIPv4(address)) throw new Error('Blocked hostname resolving to a private IPv4')
    if (family === 6 && isPrivateIPv6(address)) throw new Error('Blocked hostname resolving to a private IPv6')
  }
}

function htmlToText(html: string): string {
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<\/(p|div|br|li|h[1-6]|tr)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n[ \t]*\n+/g, '\n\n')
    .trim()
  return text.length > MAX_PAGE_TEXT_LENGTH ? text.slice(0, MAX_PAGE_TEXT_LENGTH) + '…' : text
}

export const fetchPage = tool({
  description: FETCH_PAGE_DESCRIPTION,
  inputSchema: z.object({
    url: z.string().describe('The exact URL to fetch and read, usually found via a prior research call.'),
  }),
  execute: async ({ url }) => {
    try {
      await assertPublicUrl(url)
      const resp = await fetch(url, { signal: AbortSignal.timeout(12_000) })
      if (!resp.ok) return { url, error: `Fetch failed: HTTP ${resp.status}` }
      const contentLength = Number(resp.headers?.get?.('content-length'))
      if (contentLength > MAX_RESPONSE_BYTES) return { url, error: 'Page too large to fetch' }
      const html = await resp.text()
      const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
      return {
        url,
        title: titleMatch ? titleMatch[1].trim() : null,
        text: htmlToText(html),
      }
    } catch (e: unknown) {
      console.error(`[mx4] fetchPage failed for ${url}:`, e)
      logResearchFailure(`fetchPage failed for "${url}": ${errorDetail(e)}`)
      return { url, error: 'Could not fetch this page — it may be unreachable or block automated requests.' }
    }
  },
})

export const research = tool({
  description: RESEARCH_DESCRIPTION,
  inputSchema: z.object({
    query: z.string().describe('The scientific question to search for. No personal data.'),
    limit: z.number().int().min(1).max(8).optional().describe('Max results per backend (default 5).'),
  }),
  execute: async ({ query, limit }) => {
    const n = limit ?? 5
    const out: { scholarly: Source[]; web: Source[]; note?: string } = { scholarly: [], web: [] }
    try {
      out.scholarly = await searchOpenAlex(query, n)
    } catch (e: unknown) {
      console.error('[mx4] research: OpenAlex search failed:', e)
      logResearchFailure(`OpenAlex search failed for query "${query}": ${errorDetail(e)}`)
      out.note = 'Scholarly backend (OpenAlex) was unreachable; results may be incomplete.'
    }
    out.web = await searchWeb(query, n)
    if (out.scholarly.length === 0 && out.web.length === 0 && !out.note) {
      out.note = 'No sources found for this query. Do not fabricate citations.'
    }
    return out
  },
})
