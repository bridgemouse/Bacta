export interface GarminSummary {
  hrv?: number
  hrv_week_avg?: number
  hrv_baseline_low?: number
  hrv_baseline_high?: number
  resting_hr?: number
  stress_avg?: number
  stress_max?: number
  resp_avg?: number
  resp_max?: number
  recovery_score?: number
  body_battery_wake?: number
  body_battery_current?: number
  body_battery_min?: number
  spo2_avg?: number
  spo2_min?: number
  sleep_score?: number
  sleep_deep_s?: number
  sleep_light_s?: number
  sleep_rem_s?: number
  sleep_awake_s?: number
  sleep_resp?: number
  sleep_hr?: number
  sleep_stress?: number
  sleep_spo2?: number
  training_load?: number
  training_load_min?: number
  training_load_max?: number
  training_status_n?: number
  intensity_mod_min?: number
  intensity_vig_min?: number
  vo2max?: number
  fitness_age?: number
  steps?: number
  distance_m?: number
  calories_total?: number
  calories_active?: number
  floors_up?: number
}

/** Latest values for every metric — one DB call. */
export async function fetchSummary(): Promise<GarminSummary> {
  const res = await fetch('/api/garmin/summary')
  if (!res.ok) throw new Error('Garmin summary fetch failed')
  return res.json()
}

/** Ordered oldest→today number array for sparklines/bars. */
export async function fetchTrend(metric: string, days = 7): Promise<number[]> {
  const to = new Date().toISOString().slice(0, 10)
  const from = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10)
  const res = await fetch(`/api/garmin/${metric}?from=${from}&to=${to}`)
  if (!res.ok) return []
  const { rows } = await res.json() as { rows: { value: number }[] }
  return rows.map(r => r.value)
}

export interface GarminActivity {
  activity_id: number
  date: string
  start_time: string
  name: string
  type_key: string
  distance_m: number | null
  duration_s: number | null
  calories: number | null
  avg_hr: number | null
  elevation_m: number | null
}

export async function fetchActivities(days = 7): Promise<GarminActivity[]> {
  const res = await fetch(`/api/garmin/activities?days=${days}`)
  if (!res.ok) return []
  const { activities } = await res.json() as { activities: GarminActivity[] }
  return activities
}

export const TRAINING_STATUS: Record<number, string> = {
  0: 'No Data', 1: 'No Data', 2: 'Detraining', 3: 'Recovery',
  4: 'Maintaining', 5: 'Productive', 6: 'Productive', 7: 'Productive',
  8: 'Peaking', 9: 'Overreaching', 10: 'Recovery',
}
