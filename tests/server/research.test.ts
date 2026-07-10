import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest'

process.env.DB_PATH = ':memory:'

describe('MX-4 research tool', () => {
  beforeAll(async () => {
    const { migrate } = await import('../../server/db/migrate')
    migrate()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('parses OpenAlex results and reconstructs the abstract; web off by default', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        results: [{
          title: 'HRV-guided training improves VO2max',
          publication_year: 2023,
          doi: 'https://doi.org/10.1234/abc',
          cited_by_count: 42,
          authorships: [{ author: { display_name: 'A. Researcher' } }],
          primary_location: { source: { display_name: 'J. Appl. Physiol.' } },
          abstract_inverted_index: { 'HRV': [0], 'guided': [1], 'training': [2], 'works': [3] },
        }],
      }),
    }))
    vi.stubGlobal('fetch', fetchMock)

    const { research } = await import('../../server/lib/ai/research')
    const result = await research.execute!({ query: 'HRV guided training endurance' }, {} as any) as any

    expect(fetchMock).toHaveBeenCalledOnce()
    expect(fetchMock.mock.calls[0][0]).toContain('api.openalex.org')
    expect(result.scholarly).toHaveLength(1)
    expect(result.scholarly[0].doi).toBe('https://doi.org/10.1234/abc')
    expect(result.scholarly[0].abstract).toBe('HRV guided training works')
    expect(result.scholarly[0].citations).toBe(42)
    expect(result.web).toEqual([])  // no research_provider/key configured
  })

  it('degrades gracefully when OpenAlex is unreachable (no fabrication)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('network down') }))
    const { research } = await import('../../server/lib/ai/research')
    const result = await research.execute!({ query: 'deep sleep recovery' }, {} as any) as any
    expect(result.scholarly).toEqual([])
    expect(result.note).toMatch(/unreachable|No sources/i)
  })

  it('returns an explicit no-sources note rather than empty silence', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ results: [] }) })))
    const { research } = await import('../../server/lib/ai/research')
    const result = await research.execute!({ query: 'xyzzy nonexistent topic' }, {} as any) as any
    expect(result.scholarly).toEqual([])
    expect(result.note).toMatch(/No sources/i)
  })

  it('logs a failure when the OpenAlex search throws, before degrading to the note', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('network down') }))
    const { research } = await import('../../server/lib/ai/research')
    await research.execute!({ query: 'deep sleep recovery' }, {} as any)

    const { default: db } = await import('../../server/db/client')
    const rows = db.prepare(
      "SELECT source, level, message FROM app_logs WHERE source = 'mx4-research' ORDER BY id DESC LIMIT 5"
    ).all() as { source: string; level: string; message: string }[]

    expect(rows.some(r => r.level === 'error' && r.message.includes('OpenAlex') && r.message.includes('network down'))).toBe(true)
  })

  it('logs a failure when the web (Tavily/Exa) search throws', async () => {
    const { setSetting } = await import('../../server/lib/settings')
    setSetting('research_provider', 'tavily')
    setSetting('research_api_key', 'test-key')

    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes('openalex')) return { ok: true, json: async () => ({ results: [] }) }
      throw new Error('tavily unreachable')
    })
    vi.stubGlobal('fetch', fetchMock)

    const { research } = await import('../../server/lib/ai/research')
    await research.execute!({ query: 'garmin run coach specs' }, {} as any)

    const { default: db } = await import('../../server/db/client')
    const rows = db.prepare(
      "SELECT source, level, message FROM app_logs WHERE source = 'mx4-research' ORDER BY id DESC LIMIT 5"
    ).all() as { source: string; level: string; message: string }[]

    expect(rows.some(r => r.level === 'error' && r.message.includes('tavily') && r.message.includes('tavily unreachable'))).toBe(true)

    setSetting('research_provider', 'none')
    setSetting('research_api_key', '')
  })

  it('logs the underlying network cause instead of the generic "fetch failed" message', async () => {
    const causeErr = new Error('fetch failed')
    ;(causeErr as Error & { cause?: unknown }).cause = new Error('getaddrinfo ENOTFOUND api.openalex.org')
    vi.stubGlobal('fetch', vi.fn(async () => { throw causeErr }))

    const { research } = await import('../../server/lib/ai/research')
    await research.execute!({ query: 'HRV baseline drift' }, {} as any)

    const { default: db } = await import('../../server/db/client')
    const rows = db.prepare(
      "SELECT message FROM app_logs WHERE source = 'mx4-research' ORDER BY id DESC LIMIT 5"
    ).all() as { message: string }[]

    expect(rows.some(r => r.message.includes('ENOTFOUND'))).toBe(true)
  })

  it('logs a real detail (not "[object Object]") when the search rejects with a plain error-shaped object', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw { code: -32000, message: 'rate limited' } }))

    const { research } = await import('../../server/lib/ai/research')
    await research.execute!({ query: 'sleep architecture review' }, {} as any)

    const { default: db } = await import('../../server/db/client')
    const rows = db.prepare(
      "SELECT message FROM app_logs WHERE source = 'mx4-research' ORDER BY id DESC LIMIT 5"
    ).all() as { message: string }[]

    expect(rows.some(r => r.message.includes('rate limited'))).toBe(true)
    expect(rows.some(r => r.message.includes('[object Object]'))).toBe(false)
  })
})

describe('MX-4 fetchPage tool', () => {
  beforeAll(async () => {
    const { migrate } = await import('../../server/db/migrate')
    migrate()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('fetches a specific URL and returns its parsed text content, not just a search snippet', async () => {
    const html = `<html><head><title>OTF Workout Thread</title></head><body>
      <script>trackPageView();</script>
      <style>.hidden { display: none; }</style>
      <p>Today's Orange Theory workout was a Power Day with rowing intervals.</p>
      <p>Base pace was 24-26 splits, push pace 21-23.</p>
    </body></html>`
    const fetchMock = vi.fn(async () => ({
      ok: true,
      headers: new Map([['content-type', 'text/html; charset=utf-8']]),
      text: async () => html,
    }))
    vi.stubGlobal('fetch', fetchMock)

    const { fetchPage } = await import('../../server/lib/ai/research')
    const result = await fetchPage.execute!({ url: 'https://reddit.com/r/orangetheory/thread' }, {} as any) as any

    expect(result.title).toBe('OTF Workout Thread')
    expect(result.text).toContain('Power Day with rowing intervals')
    expect(result.text).toContain('24-26 splits')
    // script/style content must not leak into the parsed text
    expect(result.text).not.toContain('trackPageView')
    expect(result.text).not.toContain('display: none')
  })

  it('returns an error note instead of throwing when the fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('network down') }))
    const { fetchPage } = await import('../../server/lib/ai/research')
    const result = await fetchPage.execute!({ url: 'https://example.com/unreachable' }, {} as any) as any
    expect(result.error).toBeDefined()
    expect(result.text).toBeUndefined()
  })
})
