import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('hevyService', () => {
  beforeEach(() => { vi.stubGlobal('fetch', vi.fn()) })
  afterEach(() => { vi.unstubAllGlobals() })

  it('fetchWorkouts calls Hevy API with api-key header', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ workouts: [] }),
    } as Response)

    const { fetchWorkouts } = await import('../../server/lib/integrations/hevy/hevyService')
    await fetchWorkouts('my-api-key')

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('api.hevyapp.com/v1/workouts'),
      expect.objectContaining({ headers: { 'api-key': 'my-api-key' } })
    )
  })

  it('fetchWorkouts uses pageSize=10 by default', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: true, json: async () => ({ workouts: [] }) } as Response)
    const { fetchWorkouts } = await import('../../server/lib/integrations/hevy/hevyService')
    await fetchWorkouts('key')
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('pageSize=10'),
      expect.anything()
    )
  })

  it('fetchWorkouts throws on non-ok response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: false, status: 403 } as Response)
    const { fetchWorkouts } = await import('../../server/lib/integrations/hevy/hevyService')
    await expect(fetchWorkouts('bad-key')).rejects.toThrow('403')
  })

  it('fetchWorkoutsSince stops pagination when batch contains records older than sinceDate', async () => {
    const page1 = [
      { id: 'w1', title: 'Workout A', start_time: '2026-06-22T10:00:00Z', end_time: '2026-06-22T11:00:00Z', exercises: [] },
      { id: 'w2', title: 'Workout B', start_time: '2026-05-01T10:00:00Z', end_time: '2026-05-01T11:00:00Z', exercises: [] },
    ]
    vi.mocked(fetch).mockResolvedValueOnce({ ok: true, json: async () => ({ workouts: page1 }) } as Response)

    const { fetchWorkoutsSince } = await import('../../server/lib/integrations/hevy/hevyService')
    const result = await fetchWorkoutsSince('key', '2026-06-01')

    // Only w1 is on or after sinceDate
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('w1')
    // Should not fetch page 2 since oldest record is before sinceDate
    expect(fetch).toHaveBeenCalledTimes(1)
  })
})
