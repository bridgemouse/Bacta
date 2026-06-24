import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('stravaService', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('getAuthUrl returns correct Strava OAuth URL', async () => {
    const { getAuthUrl } = await import('../../server/lib/integrations/strava/stravaService')
    const url = getAuthUrl('client123', 'http://bacta.home/api/integrations/strava/callback', 'state-abc')
    expect(url).toContain('https://www.strava.com/oauth/authorize')
    expect(url).toContain('client_id=client123')
    expect(url).toContain('state=state-abc')
    expect(url).toContain('activity%3Aread_all')
  })

  it('exchangeCode POSTs to Strava token endpoint and returns tokens', async () => {
    const mockTokens = { access_token: 'acc', refresh_token: 'ref', expires_at: 9999999999 }
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockTokens,
    } as Response)

    const { exchangeCode } = await import('../../server/lib/integrations/strava/stravaService')
    const tokens = await exchangeCode('cid', 'csec', 'code123', 'http://redirect')

    expect(fetch).toHaveBeenCalledWith(
      'https://www.strava.com/oauth/token',
      expect.objectContaining({ method: 'POST' })
    )
    expect(tokens).toEqual(mockTokens)
  })

  it('refreshTokens skips refresh when token not expired', async () => {
    const { refreshTokens } = await import('../../server/lib/integrations/strava/stravaService')
    const tokens = { access_token: 'acc', refresh_token: 'ref', expires_at: Math.floor(Date.now() / 1000) + 3600 }
    const result = await refreshTokens('cid', 'csec', tokens)
    expect(fetch).not.toHaveBeenCalled()
    expect(result).toBe(tokens) // same reference — not refreshed
  })

  it('refreshTokens calls Strava when token is expired', async () => {
    const newTokens = { access_token: 'new-acc', refresh_token: 'new-ref', expires_at: 9999999999 }
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => newTokens,
    } as Response)

    const { refreshTokens } = await import('../../server/lib/integrations/strava/stravaService')
    const expired = { access_token: 'old', refresh_token: 'old-ref', expires_at: 100 }
    const result = await refreshTokens('cid', 'csec', expired)

    expect(fetch).toHaveBeenCalledWith(
      'https://www.strava.com/oauth/token',
      expect.objectContaining({ method: 'POST' })
    )
    expect(result.access_token).toBe('new-acc')
  })

  it('fetchActivities returns activities from Strava', async () => {
    const mockActivities = [
      { id: 1, name: 'Morning Run', sport_type: 'Run', start_date_local: '2026-06-20T07:00:00', distance: 5000, moving_time: 1800, total_elevation_gain: 50 },
    ]
    vi.mocked(fetch)
      .mockResolvedValueOnce({ ok: true, json: async () => mockActivities } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => [] } as Response) // empty page = done

    const { fetchActivities } = await import('../../server/lib/integrations/strava/stravaService')
    const result = await fetchActivities('token', 1700000000)

    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Morning Run')
  })

  it('fetchActivities throws when Strava returns non-ok', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: false, status: 401 } as Response)
    const { fetchActivities } = await import('../../server/lib/integrations/strava/stravaService')
    await expect(fetchActivities('bad-token', 0)).rejects.toThrow('401')
  })
})
