import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('whoopService', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('getAuthUrl returns correct Whoop OAuth URL', async () => {
    const { getAuthUrl } = await import('../../server/lib/integrations/whoop/whoopService')
    const url = getAuthUrl('client123', 'http://bacta.home/api/integrations/whoop/callback', 'state-abc')
    expect(url).toContain('https://api.prod.whoop.com/oauth/oauth2/auth')
    expect(url).toContain('client_id=client123')
    expect(url).toContain('state=state-abc')
    expect(url).toContain('read%3Arecovery')
  })

  it('exchangeCode POSTs form-urlencoded (not Basic auth) and converts expires_in to expires_at', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ access_token: 'acc', refresh_token: 'ref', expires_in: 3600 }),
    } as Response)

    const { exchangeCode } = await import('../../server/lib/integrations/whoop/whoopService')
    const before = Math.floor(Date.now() / 1000)
    const tokens = await exchangeCode('cid', 'csec', 'code123', 'http://redirect')
    const after  = Math.floor(Date.now() / 1000)

    const call    = vi.mocked(fetch).mock.calls[0]
    const headers = call[1]?.headers as Record<string, string>
    expect(headers['Authorization']).toBeUndefined()
    expect(headers['Content-Type']).toBe('application/x-www-form-urlencoded')
    expect(tokens.access_token).toBe('acc')
    expect(tokens.expires_at).toBeGreaterThanOrEqual(before + 3600)
    expect(tokens.expires_at).toBeLessThanOrEqual(after + 3600)
  })

  it('refreshTokens skips refresh when token not expired', async () => {
    const { refreshTokens } = await import('../../server/lib/integrations/whoop/whoopService')
    const tokens = { access_token: 'acc', refresh_token: 'ref', expires_at: Math.floor(Date.now() / 1000) + 3600 }
    const result = await refreshTokens('cid', 'csec', tokens)
    expect(fetch).not.toHaveBeenCalled()
    expect(result).toBe(tokens)
  })

  it('refreshTokens calls Whoop when token is expired', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ access_token: 'new-acc', refresh_token: 'new-ref', expires_in: 3600 }),
    } as Response)

    const { refreshTokens } = await import('../../server/lib/integrations/whoop/whoopService')
    const expired = { access_token: 'old', refresh_token: 'old-ref', expires_at: 100 }
    const result  = await refreshTokens('cid', 'csec', expired)
    expect(fetch).toHaveBeenCalled()
    expect(result.access_token).toBe('new-acc')
  })

  it('fetchWhoopData fetches recovery, sleep, and workouts', async () => {
    const recovery = { records: [{ created_at: '2026-06-20T10:00:00.000Z', score_state: 'SCORED', score: { recovery_score: 75, resting_heart_rate: 56, hrv_rmssd_milli: 42.5 } }], next_token: null }
    const sleep    = { records: [{ start: '2026-06-20T00:00:00.000Z', end: '2026-06-20T07:30:00.000Z', nap: false, score_state: 'SCORED', score: { stage_summary: { total_in_bed_time_milli: 28800000, total_awake_time_milli: 1800000, total_light_sleep_time_milli: 9000000, total_slow_wave_sleep_time_milli: 5400000, total_rem_sleep_time_milli: 10800000 }, respiratory_rate: 15.5, sleep_performance_percentage: 88 } }], next_token: null }
    const workouts = { records: [{ id: 'uuid-1', start: '2026-06-20T07:30:00.000Z', end: '2026-06-20T08:30:00.000Z', sport_id: 1, score_state: 'SCORED', score: { strain: 10, average_heart_rate: 148, max_heart_rate: 175, kilojoule: 1200, distance_meter: 8000 } }], next_token: null }

    vi.mocked(fetch)
      .mockResolvedValueOnce({ ok: true, json: async () => recovery } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => sleep    } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => workouts } as Response)

    const { fetchWhoopData } = await import('../../server/lib/integrations/whoop/whoopService')
    const result = await fetchWhoopData('token', '2026-05-25', '2026-06-24')

    expect(result.recovery).toHaveLength(1)
    expect(result.sleep).toHaveLength(1)
    expect(result.workouts).toHaveLength(1)
    expect(result.recovery[0].score?.recovery_score).toBe(75)
  })
})
