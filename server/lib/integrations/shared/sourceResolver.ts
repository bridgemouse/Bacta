interface SourceRow {
  source: string
  value: number
}

export function resolveSource(rows: SourceRow[], priority: string[]): SourceRow {
  for (const src of priority) {
    const match = rows.find(r => r.source === src)
    if (match) return match
  }
  return rows[0]
}
