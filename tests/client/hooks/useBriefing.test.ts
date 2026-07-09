import { renderHook, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { useBriefing, prefetchBriefing } from '../../../client/src/hooks/useBriefing'
import { getCachedData, clearCachedData } from '../../../client/src/lib/sectionDataCache'
import type { BriefingResult } from '../../../client/src/lib/briefing'

const BRIEFING: BriefingResult = {
  tone: 'POSITIVE',
  headline: 'Headline',
  body: 'Body',
  summary: 'Summary',
  recommendation: 'Rec',
  flags: [],
  generated_at: '2026-07-08T00:00:00Z',
}

beforeEach(() => {
  clearCachedData()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('prefetchBriefing', () => {
  it('fetches and caches a section briefing without mounting a component', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ json: () => Promise.resolve(BRIEFING) }))

    await prefetchBriefing('recovery')

    expect(getCachedData<BriefingResult>('briefing:recovery')).toEqual(BRIEFING)
  })

  it('does not re-fetch a section that is already cached', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ json: () => Promise.resolve(BRIEFING) })
    vi.stubGlobal('fetch', fetchMock)

    await prefetchBriefing('recovery')
    await prefetchBriefing('recovery')

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('a subsequent useBriefing mount for that section reads the prefetched cache immediately', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ json: () => Promise.resolve(BRIEFING) }))

    await prefetchBriefing('recovery')

    const { result } = renderHook(() => useBriefing('recovery'))
    // Initial render must already reflect the prefetched data — no stub-first flash.
    expect(result.current.data).toEqual(BRIEFING)
    await waitFor(() => expect(result.current.data).toEqual(BRIEFING))
  })
})
