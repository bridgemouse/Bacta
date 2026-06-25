import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('polarService', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('getAuthUrl returns correct Polar OAuth URL', async () => {
    const { getAuthUrl } = await import('../../server/lib/integrations/polar/polarService')
    const url = getAuthUrl('client123', 'http://bacta.home/api/integrations/polar/callback', 'state-abc')
    expect(url).toContain('https://flow.polar.com/oauth2/authorization')
    expect(url).toContain('client_id=client123')
    expect(url).toContain('state=state-abc')
  })

  it('exchangeCode uses Basic auth, registers user, and returns tokens with far-future expires_at', async () => {
    // First call: token exchange
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ access_token: 'acc', token_type: 'Bearer', x_user_id: 42 }),
    } as Response)
    // Second call: user registration → 200 OK
    vi.mocked(fetch).mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({}) } as Response)

    const { exchangeCode } = await import('../../server/lib/integrations/polar/polarService')
    const tokens = await exchangeCode('cid', 'csec', 'code123', 'http://redirect')

    // Verify Basic auth on token exchange call
    const headers = vi.mocked(fetch).mock.calls[0][1]?.headers as Record<string, string>
    expect(headers['Authorization']).toMatch(/^Basic /)
    const decoded = Buffer.from(headers['Authorization'].replace('Basic ', ''), 'base64').toString()
    expect(decoded).toBe('cid:csec')

    // Verify registration call was made
    expect(vi.mocked(fetch).mock.calls.length).toBe(2)
    const regUrl = vi.mocked(fetch).mock.calls[1][0] as string
    expect(regUrl).toContain('/v3/users')

    // Verify tokens
    expect(tokens.access_token).toBe('acc')
    const tenYears = 10 * 365 * 24 * 3600
    expect(tokens.expires_at).toBeGreaterThan(Math.floor(Date.now() / 1000) + tenYears - 60)
  })

  it('exchangeCode treats 409 registration response as success', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ access_token: 'acc', token_type: 'Bearer', x_user_id: 42 }),
    } as Response)
    vi.mocked(fetch).mockResolvedValueOnce({ ok: false, status: 409, json: async () => ({}) } as Response)

    const { exchangeCode } = await import('../../server/lib/integrations/polar/polarService')
    // Should not throw on 409
    const tokens = await exchangeCode('cid', 'csec', 'code123', 'http://redirect')
    expect(tokens.access_token).toBe('acc')
  })

  it('refreshTokens returns same tokens without calling fetch (long-lived)', async () => {
    const { refreshTokens } = await import('../../server/lib/integrations/polar/polarService')
    const tenYears = 10 * 365 * 24 * 3600
    const tokens = { access_token: 'acc', refresh_token: '', expires_at: Math.floor(Date.now() / 1000) + tenYears }
    const result = await refreshTokens('cid', 'csec', tokens)
    expect(fetch).not.toHaveBeenCalled()
    expect(result).toBe(tokens)
  })

  it('fetchPolarData fetches exercises, sleep, and nightly-recharge in parallel', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true, json: async () => ({ exercises: [
          { id: 'ex1', start_time: '2024-01-10T07:00:00.000Z', duration: 'PT1H0M0S',
            sport: 'RUNNING', distance: 10000.0,
            heart_rate: { average: 145 }, calories: 500 }
        ]})
      } as Response)
      .mockResolvedValueOnce({
        ok: true, json: async () => ({ nights: [
          { date: '2024-01-10', sleep_summary: {
            total_sleep_time: 25200, deep_sleep_time: 7200,
            light_sleep_time: 14400, rem_time: 3600,
            sleep_score: 82, breathing_rate_avg: 14.2,
            heart_rate: { average: 52 }
          }}
        ]})
      } as Response)
      .mockResolvedValueOnce({
        ok: true, json: async () => ({ recharges: [
          { date: '2024-01-10', heart_rate_avg: 52, heart_rate_variability_sdnn: 44.5 }
        ]})
      } as Response)

    const { fetchPolarData } = await import('../../server/lib/integrations/polar/polarService')
    const data = await fetchPolarData('tok', '2024-01-01', '2024-01-10')
    expect(data.exercises).toHaveLength(1)
    expect(data.nights).toHaveLength(1)
    expect(data.recharges).toHaveLength(1)
    expect(fetch).toHaveBeenCalledTimes(3)
  })
})
