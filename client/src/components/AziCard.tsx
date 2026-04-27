// client/src/components/AziCard.tsx
import { useState, useEffect } from 'react'
import { getInsight } from '../api'

type Props = {
  section: string
}

export function AziCard({ section }: Props) {
  const [html, setHtml] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getInsight(section).then((result) => {
      if (!cancelled) {
        setHtml(result)
        setLoading(false)
      }
    })
    return () => { cancelled = true }
  }, [section])

  if (loading) {
    return (
      <div data-testid="azi-skeleton" className="rounded-xl bg-blue-950 border border-blue-800 p-4">
        <div className="h-3 bg-blue-900 rounded animate-pulse w-1/3 mb-3" />
        <div className="h-2 bg-blue-900 rounded animate-pulse mb-2" />
        <div className="h-2 bg-blue-900 rounded animate-pulse w-4/5" />
      </div>
    )
  }

  return (
    <div
      data-azi-card
      dangerouslySetInnerHTML={{ __html: html ?? '' }}
    />
  )
}
