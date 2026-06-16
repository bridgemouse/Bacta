import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest'

process.env.DB_PATH = ':memory:'

describe('vaultClient', () => {
  beforeAll(async () => {
    const { migrate } = await import('../../server/db/migrate')
    migrate()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('isVaultEnabled returns false when vault_enabled is "false"', async () => {
    const { isVaultEnabled } = await import('../../server/lib/ai/vaultClient')
    expect(isVaultEnabled()).toBe(false)
  })

  it('isVaultEnabled returns false when vault_url is empty', async () => {
    const { default: db } = await import('../../server/db/client')
    db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES ('vault_enabled', 'true')").run()
    db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES ('vault_url', '')").run()
    const { resetVaultClient, isVaultEnabled } = await import('../../server/lib/ai/vaultClient')
    resetVaultClient()
    expect(isVaultEnabled()).toBe(false)
  })

  it('resetVaultClient clears singleton', async () => {
    const { resetVaultClient } = await import('../../server/lib/ai/vaultClient')
    resetVaultClient()
    // no error = singleton was nulled
  })

  it('testVaultConnection returns ok:false on network error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network unreachable')))
    const { testVaultConnection } = await import('../../server/lib/ai/vaultClient')
    const result = await testVaultConnection()
    expect(result.ok).toBe(false)
    expect(result.error).toContain('Network unreachable')
  })

  it('testVaultConnection returns ok:false on non-200 HTTP', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }))
    const { testVaultConnection } = await import('../../server/lib/ai/vaultClient')
    const result = await testVaultConnection()
    expect(result.ok).toBe(false)
    expect(result.error).toContain('503')
  })

  it('testVaultConnection returns ok:true with details on success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, domains: 4, page_count: 34 }),
    }))
    const { testVaultConnection } = await import('../../server/lib/ai/vaultClient')
    const result = await testVaultConnection()
    expect(result.ok).toBe(true)
    expect(result.details).toEqual({ ok: true, domains: 4, page_count: 34 })
  })

  it('getVaultTools returns empty object when vault is disabled', async () => {
    const { default: db } = await import('../../server/db/client')
    db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES ('vault_enabled', 'false')").run()
    const { resetVaultClient, getVaultTools } = await import('../../server/lib/ai/vaultClient')
    resetVaultClient()
    const tools = await getVaultTools()
    expect(tools).toEqual({})
  })
})
