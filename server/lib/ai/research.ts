import { tool } from 'ai'
import { z } from 'zod'
import { getSetting } from '../settings'

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

Use this tool freely for any lookup — scientific or otherwise. If web results come back empty on a non-academic query, tell Ethan the web backend isn't configured and he can add a Tavily or Exa key in Settings to enable it.

Guidance:
- For scholarly results: cite title, year, and DOI/URL. NEVER invent a citation.
- For web results: summarise what was found and link the source.
- If nothing is found on either backend for a scientific topic, say so — do not fabricate.
- Never include personal biometric values in the query.`

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
  } catch {
    return []  // web backend is best-effort; scholarly still returns
  }
  return []
}

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
    } catch {
      out.note = 'Scholarly backend (OpenAlex) was unreachable; results may be incomplete.'
    }
    out.web = await searchWeb(query, n)
    if (out.scholarly.length === 0 && out.web.length === 0 && !out.note) {
      out.note = 'No sources found for this query. Do not fabricate citations.'
    }
    return out
  },
})
