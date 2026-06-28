import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('withingsService', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('getAuthUrl returns correct Withings OAuth URL', async () => {
    const { getAuthUrl } = await import('../../server/lib/integrations/withings/withingsService')
    const url = getAuthUrl('wid', 'http://bacta.home/api/integrations/withings/callback', 'st8')
    expect(url).toContain('https://account.withings.com/oauth2_user/authorize2')
    expect(url).toContain('client_id=wid')
    expect(url).toContain('state=st8')
  })

  it('exchangeCode sends action=requesttoken and returns tokens with expires_at', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        status: 0,
        body: { access_token: 'acc', refresh_token: 'ref', expires_in: 10800 },
      }),
    } as Response)

    const { exchangeCode } = await import('../../server/lib/integrations/withings/withingsService')
    const before = Math.floor(Date.now() / 1000)
    const tokens = await exchangeCode('wid', 'wsec', 'code123', 'http://redirect')
    const after  = Math.floor(Date.now() / 1000)

    // Verify body contains action=requesttoken
    const body = vi.mocked(fetch).mock.calls[0][1]?.body as string
    expect(body).toContain('action=requesttoken')
    expect(body).toContain('client_id=wid')
    expect(body).not.toContain('Authorization')

    expect(tokens.access_token).toBe('acc')
    expect(tokens.expires_at).toBeGreaterThanOrEqual(before + 10800)
    expect(tokens.expires_at).toBeLessThanOrEqual(after + 10800)
  })

  it('exchangeCode throws on non-zero Withings status', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: 503, body: {} }),
    } as Response)

    const { exchangeCode } = await import('../../server/lib/integrations/withings/withingsService')
    await expect(exchangeCode('wid', 'wsec', 'code', 'http://redirect')).rejects.toThrow('503')
  })

  it('refreshTokens sends action=requesttoken with refresh_token grant', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        status: 0,
        body: { access_token: 'new', refresh_token: 'newref', expires_in: 10800 },
      }),
    } as Response)

    const { refreshTokens } = await import('../../server/lib/integrations/withings/withingsService')
    const tokens = { access_token: 'old', refresh_token: 'ref', expires_at: 0 }
    const fresh  = await refreshTokens('wid', 'wsec', tokens)

    const body = vi.mocked(fetch).mock.calls[0][1]?.body as string
    expect(body).toContain('action=requesttoken')
    expect(body).toContain('grant_type=refresh_token')
    expect(body).toContain('refresh_token=ref')
    expect(fresh.access_token).toBe('new')
  })

  it('fetchWithingsData returns parsed measure groups', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        status: 0,
        body: {
          measuregrps: [
            {
              date: 1704844800,
              measures: [
                { value: 70750, type: 1, unit: -3 },  // 70.75 kg
                { value: 62, type: 11, unit: 0 },     // 62 bpm
              ],
            },
          ],
        },
      }),
    } as Response)

    const { fetchWithingsData } = await import('../../server/lib/integrations/withings/withingsService')
    const groups = await fetchWithingsData('tok', '2024-01-01', '2024-01-10')
    expect(groups).toHaveLength(1)
    expect(groups[0].measures).toHaveLength(2)
  })
})
