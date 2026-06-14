import { useState, useEffect } from 'react'
import type { BriefingResult } from '../lib/briefing'

export function useBriefing(section: string): BriefingResult | null {
  const [data, setData] = useState<BriefingResult | null>(null)

  useEffect(() => {
    fetch(`/api/insights/${section}`)
      .then(r => r.json())
      .then((d: BriefingResult) => setData(d))
      .catch(err => console.error(`[useBriefing:${section}]`, err))
  }, [section])

  return data
}
