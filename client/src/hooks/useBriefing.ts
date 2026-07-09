import { useState, useEffect } from 'react'
import type { BriefingResult } from '../lib/briefing'
import { getCachedData, setCachedData } from '../lib/sectionDataCache'

// Warms the section cache before the user ever navigates there, so a first
// visit reads live data immediately instead of flashing the stub line while
// useBriefing's own fetch resolves. Best-effort — a failure here just means
// that section falls back to its normal on-mount fetch.
export function prefetchBriefing(section: string): Promise<void> {
  const cacheKey = `briefing:${section}`
  if (getCachedData<BriefingResult>(cacheKey)) return Promise.resolve()
  return fetch(`/api/insights/${section}`)
    .then(r => r.json())
    .then((d: BriefingResult) => { setCachedData(cacheKey, d) })
    .catch(err => console.error(`[prefetchBriefing:${section}]`, err))
}

export function useBriefing(section: string): { data: BriefingResult | null; refresh: () => void } {
  const cacheKey = `briefing:${section}`
  const [data, setData] = useState<BriefingResult | null>(() => getCachedData<BriefingResult>(cacheKey) ?? null)

  function refresh() {
    fetch(`/api/insights/${section}`)
      .then(r => r.json())
      .then((d: BriefingResult) => {
        setData(d)
        setCachedData(cacheKey, d)
      })
      .catch(err => console.error(`[useBriefing:${section}]`, err))
  }

  useEffect(() => {
    refresh()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section])

  return { data, refresh }
}
