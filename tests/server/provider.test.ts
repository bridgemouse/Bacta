import { describe, it, expect, beforeAll, vi } from 'vitest'

process.env.DB_PATH = ':memory:'

vi.mock('ai', () => ({
  generateText: vi.fn().mockResolvedValue({ text: 'ok' }),
}))

vi.mock('@ai-sdk/google', () => ({
  createGoogleGenerativeAI: vi.fn(
    () => (modelId: string) => ({ _provider: 'google', modelId })
  ),
}))

vi.mock('@ai-sdk/anthropic', () => ({
  createAnthropic: vi.fn(
    () => (modelId: string) => ({ _provider: 'anthropic', modelId })
  ),
}))

vi.mock('@ai-sdk/openai', () => ({
  createOpenAI: vi.fn(
    () => (modelId: string) => ({ _provider: 'openai', modelId })
  ),
}))

describe('AI Provider', () => {
  beforeAll(async () => {
    const { migrate } = await import('../../server/db/migrate')
    migrate()
  })

  it('getModel returns a google model with default settings', async () => {
    const { getModel } = await import('../../server/lib/ai/provider')
    const model = getModel('briefing') as any
    expect(model._provider).toBe('google')
    expect(model.modelId).toBe('gemini-2.5-flash')
  })

  it('getModel returns chat model for purpose="chat"', async () => {
    const { getModel } = await import('../../server/lib/ai/provider')
    const model = getModel('chat') as any
    expect(model._provider).toBe('google')
    expect(model.modelId).toBe('gemini-2.5-flash')
  })

  it('getModel switches to anthropic when ai_provider=anthropic', async () => {
    const { setSetting } = await import('../../server/lib/settings')
    setSetting('ai_provider', 'anthropic')
    setSetting('mx4_briefing_model', 'claude-sonnet-4-6')
    const { getModel } = await import('../../server/lib/ai/provider')
    const model = getModel('briefing') as any
    expect(model._provider).toBe('anthropic')
    expect(model.modelId).toBe('claude-sonnet-4-6')
    // restore
    setSetting('ai_provider', 'google')
    setSetting('mx4_briefing_model', 'gemini-2.5-flash')
  })

  it('getModel switches to openai when ai_provider=openai', async () => {
    const { setSetting } = await import('../../server/lib/settings')
    setSetting('ai_provider', 'openai')
    setSetting('mx4_briefing_model', 'gpt-4o')
    const { getModel } = await import('../../server/lib/ai/provider')
    const model = getModel('briefing') as any
    expect(model._provider).toBe('openai')
    expect(model.modelId).toBe('gpt-4o')
    // restore
    setSetting('ai_provider', 'google')
    setSetting('mx4_briefing_model', 'gemini-2.5-flash')
  })

  it('testConnection returns ok:true when generateText succeeds', async () => {
    const { testConnection } = await import('../../server/lib/ai/provider')
    const result = await testConnection()
    expect(result.ok).toBe(true)
    expect(result.error).toBeUndefined()
  })

  it('testConnection returns ok:false when generateText throws', async () => {
    const { generateText } = await import('ai')
    vi.mocked(generateText).mockRejectedValueOnce(new Error('API key invalid'))
    const { testConnection } = await import('../../server/lib/ai/provider')
    const result = await testConnection()
    expect(result.ok).toBe(false)
    expect(result.error).toContain('API key invalid')
  })

  it('SUPPORTED_MODELS lists models for all three providers', async () => {
    const { SUPPORTED_MODELS } = await import('../../server/lib/ai/provider')
    expect(SUPPORTED_MODELS.google.length).toBeGreaterThan(0)
    expect(SUPPORTED_MODELS.anthropic.length).toBeGreaterThan(0)
    expect(SUPPORTED_MODELS.openai.length).toBeGreaterThan(0)
  })
})
