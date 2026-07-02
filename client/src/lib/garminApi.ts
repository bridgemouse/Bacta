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
  recovery_time_h?: number
  body_battery_wake?: number
  body_battery_current?: number
  body_battery_charged?: number
  body_battery_drained?: number
  spo2_avg?: number
  spo2_min?: number
  sleep_s?: number
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
  training_status_n_date?: string
  intensity_mod_min?: number
  intensity_vig_min?: number
  vo2max?: number
  fitness_age?: number
  fitness_age_achievable?: number
  steps?: number
  distance_m?: number
  calories_total?: number
  calories_active?: number
  floors_up?: number
  hrzone_1_min?: number
  hrzone_2_min?: number
  hrzone_3_min?: number
  hrzone_4_min?: number
  hrzone_5_min?: number
  steps_goal?: number
  floors_goal?: number
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
  // Expand panel data — null means not yet fetched / not applicable
  aerobic_te: number | null
  anaerobic_te: number | null
  recovery_time_h: number | null
  zone1_s: number | null
  zone2_s: number | null
  zone3_s: number | null
  zone4_s: number | null
  zone5_s: number | null
  run_cadence: number | null
  run_stride_cm: number | null
  run_vert_osc_cm: number | null
  run_gct_ms: number | null
}

export async function fetchActivities(days = 7): Promise<GarminActivity[]> {
  const res = await fetch(`/api/garmin/activities?days=${days}`)
  if (!res.ok) return []
  const { activities } = await res.json() as { activities: GarminActivity[] }
  return activities
}

export interface ActivityLeg {
  leg_id: number
  activity_id: number
  leg_index: number
  type_key: string
  start_time: string
  duration_s: number | null
  distance_m: number | null
  calories: number | null
  avg_hr: number | null
  max_hr: number | null
  aerobic_te: number | null
  anaerobic_te: number | null
  training_load: number | null
  body_battery_diff: number | null
  zone1_s: number | null
  zone2_s: number | null
  zone3_s: number | null
  zone4_s: number | null
  zone5_s: number | null
  run_cadence: number | null
  run_stride_cm: number | null
  run_vert_osc_cm: number | null
  run_gct_ms: number | null
  run_power_w: number | null
  row_stroke_rate: number | null
  row_power_w: number | null
  row_strokes: number | null
}

export async function fetchActivityLegs(activityId: number): Promise<ActivityLeg[]> {
  const res = await fetch(`/api/garmin/activities/${activityId}/legs`)
  if (!res.ok) return []
  const { legs } = await res.json() as { legs: ActivityLeg[] }
  return legs
}

export const TRAINING_STATUS: Record<number, string> = {
  0: 'No Data', 1: 'No Data', 2: 'Detraining', 3: 'Recovery',
  4: 'Maintaining', 5: 'Productive', 6: 'Productive', 7: 'Productive',
  8: 'Peaking', 9: 'Overreaching', 10: 'Recovery',
}

export interface WeeklyVolume { week: string; hours: number }
export interface WeeklyAvgHr { week: string; avg_hr: number }

export async function fetchWeeklyVolume(weeks = 6): Promise<WeeklyVolume[]> {
  const res = await fetch(`/api/garmin/weekly-volume?weeks=${weeks}`)
  if (!res.ok) return []
  const { weeks: data } = await res.json() as { weeks: WeeklyVolume[] }
  return data
}

export async function fetchWeeklyAvgHr(weeks = 6): Promise<WeeklyAvgHr[]> {
  const res = await fetch(`/api/garmin/weekly-avg-hr?weeks=${weeks}`)
  if (!res.ok) return []
  const { weeks: data } = await res.json() as { weeks: WeeklyAvgHr[] }
  return data
}

export async function fetchWeeklyIntensity(): Promise<{ moderate: number; vigorous: number }> {
  const res = await fetch('/api/garmin/weekly-intensity')
  if (!res.ok) return { moderate: 0, vigorous: 0 }
  return res.json() as Promise<{ moderate: number; vigorous: number }>
}

/** Per-metric data source for the latest reading. Only present for metrics in health_snapshots. */
export async function fetchSources(): Promise<Record<string, string>> {
  const res = await fetch('/api/garmin/sources')
  if (!res.ok) return {}
  return res.json() as Promise<Record<string, string>>
}
