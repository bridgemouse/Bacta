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
})
