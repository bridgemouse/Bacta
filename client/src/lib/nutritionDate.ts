export function todayLocal(): string {
  return new Date().toLocaleDateString('en-CA')
}

export function addDaysLocal(date: string, delta: number): string {
  const [y, m, d] = date.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() + delta)
  return dt.toLocaleDateString('en-CA')
}

function daysBetween(from: string, to: string): number {
  const [fy, fm, fd] = from.split('-').map(Number)
  const [ty, tm, td] = to.split('-').map(Number)
  const fromMs = Date.UTC(fy, fm - 1, fd)
  const toMs = Date.UTC(ty, tm - 1, td)
  return Math.round((fromMs - toMs) / 86400000)
}

export function relativeDayLabel(date: string): string {
  const diff = daysBetween(date, todayLocal())
  if (diff === 0) return 'TODAY'
  if (diff === -1) return 'YESTERDAY'
  if (diff === 1) return 'TOMORROW'
  return diff < 0 ? `${-diff} DAYS AGO` : `IN ${diff} DAYS`
}

export function absoluteDateLabel(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  const weekday = dt.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()
  const month = dt.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()
  return `${weekday} · ${month} ${d}`
}
