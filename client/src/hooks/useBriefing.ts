import { useState, useEffect } from 'react'
import type { BriefingResult } from '../lib/briefing'

export function useBriefing(section: string): { data: BriefingResult | null; refresh: () => void } {
  const [data, setData] = useState<BriefingResult | null>(null)

  function refresh() {
    fetch(`/api/insights/${section}`)
      .then(r => r.json())
      .then((d: BriefingResult) => setData(d))
      .catch(err => console.error(`[useBriefing:${section}]`, err))
  }

  useEffect(() => {
    refresh()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section])

  return { data, refresh }
}
