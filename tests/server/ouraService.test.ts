import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('ouraService', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('getAuthUrl returns correct Oura OAuth URL', async () => {
    const { getAuthUrl } = await import('../../server/lib/integrations/oura/ouraService')
    const url = getAuthUrl('client123', 'http://bacta.home/api/integrations/oura/callback', 'state-abc')
    expect(url).toContain('https://cloud.ouraring.com/oauth/authorize')
    expect(url).toContain('client_id=client123')
    expect(url).toContain('state=state-abc')
    expect(url).toContain('daily+sleep')
  })

  it('exchangeCode uses Basic auth and returns tokens with expires_at', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ access_token: 'acc', refresh_token: 'ref', expires_in: 3600 }),
    } as Response)

    const { exchangeCode } = await import('../../server/lib/integrations/oura/ouraService')
    const before = Math.floor(Date.now() / 1000)
    const tokens = await exchangeCode('cid', 'csec', 'code123', 'http://redirect')
    const after  = Math.floor(Date.now() / 1000)

    const headers = vi.mocked(fetch).mock.calls[0][1]?.headers as Record<string, string>
    expect(headers['Authorization']).toMatch(/^Basic /)
    const decoded = Buffer.from(headers['Authorization'].replace('Basic ', ''), 'base64').toString()
    expect(decoded).toBe('cid:csec')
    expect(tokens.access_token).toBe('acc')
    expect(tokens.expires_at).toBeGreaterThanOrEqual(before + 3600)
    expect(tokens.expires_at).toBeLessThanOrEqual(after + 3600)
  })

  it('refreshTokens skips refresh when token not expired', async () => {
    const { refreshTokens } = await import('../../server/lib/integrations/oura/ouraService')
    const tokens = { access_token: 'acc', refresh_token: 'ref', expires_at: Math.floor(Date.now() / 1000) + 3600 }
    const result = await refreshTokens('cid', 'csec', tokens)
    expect(fetch).not.toHaveBeenCalled()
    expect(result).toBe(tokens)
  })

  it('refreshTokens calls Oura when token is expired', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ access_token: 'new-acc', refresh_token: 'new-ref', expires_in: 3600 }),
    } as Response)

    const { refreshTokens } = await import('../../server/lib/integrations/oura/ouraService')
    const expired = { access_token: 'old', refresh_token: 'old-ref', expires_at: 100 }
    const result  = await refreshTokens('cid', 'csec', expired)
    expect(fetch).toHaveBeenCalled()
    expect(result.access_token).toBe('new-acc')
  })

  it('fetchOuraData fetches all three collections and returns combined data', async () => {
    const sleepData     = { data: [{ day: '2026-06-20', score: 78, average_hrv: 45, average_breath: 15, total_sleep_duration: 25200, deep_sleep_duration: 5400, light_sleep_duration: 10800, rem_sleep_duration: 9000, average_saturation: 97 }], next_token: null }
    const readinessData = { data: [{ day: '2026-06-20', score: 82, resting_heart_rate: 54 }], next_token: null }
    const activityData  = { data: [{ day: '2026-06-20', steps: 8500 }], next_token: null }

    vi.mocked(fetch)
      .mockResolvedValueOnce({ ok: true, json: async () => sleepData     } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => readinessData } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => activityData  } as Response)

    const { fetchOuraData } = await import('../../server/lib/integrations/oura/ouraService')
    const result = await fetchOuraData('token', '2026-05-25', '2026-06-24')

    expect(result.sleep).toHaveLength(1)
    expect(result.readiness).toHaveLength(1)
    expect(result.activity).toHaveLength(1)
    expect(result.sleep[0].score).toBe(78)
    expect(result.readiness[0].resting_heart_rate).toBe(54)
    expect(result.activity[0].steps).toBe(8500)
  })
})
