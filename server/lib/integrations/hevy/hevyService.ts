const API_BASE = 'https://api.hevyapp.com/v1'

export interface HevySet {
  weight_kg:         number | null
  reps:              number | null
  duration_seconds:  number | null
}

export interface HevyExercise {
  title: string
  sets:  HevySet[]
}

export interface HevyWorkout {
  id:         string
  title:      string
  start_time: string   // ISO 8601 UTC
  end_time:   string   // ISO 8601 UTC
  exercises:  HevyExercise[]
}

export async function fetchWorkouts(
  apiKey: string, page = 1, pageSize = 10
): Promise<HevyWorkout[]> {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
  const res = await fetch(`${API_BASE}/workouts?${params}`, {
    headers: { 'api-key': apiKey },
  })
  if (!res.ok) throw new Error(`Hevy workouts fetch failed: ${res.status}`)
  const data = await res.json() as { workouts: HevyWorkout[] }
  return data.workouts ?? []
}

export async function fetchWorkoutsSince(apiKey: string, sinceDate: string): Promise<HevyWorkout[]> {
  const all: HevyWorkout[] = []
  let page = 1

  while (true) {
    const batch = await fetchWorkouts(apiKey, page, 10)
    if (batch.length === 0) break

    for (const w of batch) {
      if (w.start_time.slice(0, 10) >= sinceDate) all.push(w)
    }

    // Hevy returns newest-first — stop when oldest record in batch predates sinceDate
    const oldest = batch[batch.length - 1]?.start_time?.slice(0, 10) ?? ''
    if (oldest < sinceDate || batch.length < 10) break
    page++
  }

  return all
}
