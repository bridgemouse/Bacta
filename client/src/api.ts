// client/src/api.ts

const BASE = '/api'

export type GarminSummary = {
  steps?: number
  hrv?: number
  body_battery?: number
  resting_hr?: number
  sleep_duration?: number
  recovery_score?: number
  stress_score?: number
  vo2max?: number
}

export type MetricRow = {
  date: string
  metric: string
  value: number
  unit: string
}

export type ManualEntry = {
  date: string
  readiness: number | null
  caffeine_mg: number | null
  supplements: string | null  // JSON-serialised array e.g. '["creatine","vitamin_d"]'
}

export async function getGarminSummary(): Promise<GarminSummary> {
  const res = await fetch(`${BASE}/garmin/summary`)
  if (!res.ok) return {}
  return res.json()
}

export async function getInsight(section: string): Promise<string | null> {
  const res = await fetch(`${BASE}/insights/${section}`)
  if (!res.ok) return null
  return res.text()
}

export async function getMetricHistory(metric: string, days: number): Promise<MetricRow[]> {
  const to = new Date().toISOString().slice(0, 10)
  const from = new Date(Date.now() - (days - 1) * 86400000).toISOString().slice(0, 10)
  const res = await fetch(`${BASE}/garmin/${metric}?from=${from}&to=${to}`)
  if (!res.ok) return []
  const data = await res.json()
  return data.rows ?? []
}

export async function getManualToday(): Promise<ManualEntry | null> {
  const res = await fetch(`${BASE}/manual/today`)
  if (!res.ok) return null
  const data = await res.json()
  return data.entry
}

export async function postManual(payload: {
  readiness?: number
  caffeine_mg?: number
  supplements?: string[]
}): Promise<void> {
  await fetch(`${BASE}/manual`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

export async function triggerPoll(): Promise<void> {
  await fetch(`${BASE}/poll/force`, { method: 'POST' })
}
