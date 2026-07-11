import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'

process.env.DB_PATH   = ':memory:'
process.env.WIKI_DIR  = path.join(os.tmpdir(), 'bacta-orch-wiki-' + process.pid)

// Mock generateText and generateObject from 'ai' before any imports
// Use importOriginal to preserve `tool` (used at module load time in tools.ts)
vi.mock('ai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('ai')>()
  return {
    ...actual,
    generateText: vi.fn().mockResolvedValue({ text: 'MX-4 mock analysis: HRV looks good. Recovery is strong.' }),
    generateObject: vi.fn().mockResolvedValue({
      object: {
        tone: 'POSITIVE',
        headline: 'Recovery nominal.',
        body: 'HRV above baseline. Body battery charged.',
        recommendation: 'Clear for hard session.',
        flags: [],
      },
    }),
  }
})

vi.mock('../../server/lib/ai/vaultClient', () => ({
  getVaultTools: vi.fn().mockResolvedValue({}),
  isVaultEnabled: vi.fn().mockReturnValue(false),
  resetVaultClient: vi.fn(),
  testVaultConnection: vi.fn().mockResolvedValue({ ok: true }),
}))

vi.mock('../../server/lib/ai/wrap', () => ({
  wrapSession: vi.fn().mockResolvedValue(undefined),
}))

describe('runOrchestrator', () => {
  beforeAll(async () => {
    const { migrate } = await import('../../server/db/migrate')
    migrate()
    const testWikiDir = process.env.WIKI_DIR!
    fs.mkdirSync(testWikiDir, { recursive: true })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('writes a briefing row to mx4_briefings for each section', async () => {
    const { runOrchestrator } = await import('../../server/lib/ai/orchestrator')
    await runOrchestrator()

    const { default: db } = await import('../../server/db/client')
    const rows = db.prepare('SELECT section, content_json FROM mx4_briefings').all() as { section: string; content_json: string }[]
    expect(rows.length).toBe(5)

    const sections = rows.map(r => r.section).sort()
    expect(sections).toEqual(['home', 'nutrition', 'recovery', 'sleep', 'training'])

    const parsed = JSON.parse(rows[0].content_json)
    expect(parsed).toHaveProperty('tone')
    expect(parsed).toHaveProperty('headline')
    expect(parsed).toHaveProperty('body')
    expect(parsed).toHaveProperty('recommendation')
    expect(parsed).toHaveProperty('flags')
  })

  it('does not duplicate wiki content: system prompt carries it, readAllWikiPages tool is not also offered', async () => {
    vi.clearAllMocks()
    const { generateText } = await import('ai')
    const mockGenerateText = vi.mocked(generateText)
    mockGenerateText.mockResolvedValue({ text: 'MX-4 mock analysis.' } as any)

    const { runOrchestrator } = await import('../../server/lib/ai/orchestrator')
    await runOrchestrator()

    const firstCallArgs = mockGenerateText.mock.calls[0][0] as { system: string; tools: Record<string, unknown> }
    expect(firstCallArgs.system).toContain('Wiki Knowledge')
    expect(firstCallArgs.tools).not.toHaveProperty('readAllWikiPages')
  })

  it('instructs the model that the headline must not restate the body\'s opening sentence', async () => {
    vi.clearAllMocks()
    const { generateObject } = await import('ai')
    const mockGenerateObject = vi.mocked(generateObject)

    const { runOrchestrator } = await import('../../server/lib/ai/orchestrator')
    await runOrchestrator()

    const firstCallArgs = mockGenerateObject.mock.calls[0][0] as { prompt: string }
    expect(firstCallArgs.prompt).toContain('headline')
    expect(firstCallArgs.prompt.toLowerCase()).toContain('must not restate')
  })

  it('each briefing row has a generated_at timestamp and model name', async () => {
    const { default: db } = await import('../../server/db/client')
    const row = db.prepare('SELECT generated_at, model FROM mx4_briefings WHERE section = ?').get('recovery') as { generated_at: string; model: string }
    expect(new Date(row.generated_at).getTime()).toBeGreaterThan(0)
    expect(row.model.length).toBeGreaterThan(0)
  })

  describe('retry and error handling', () => {
    it('retries a failing section and succeeds on second attempt', async () => {
      vi.useFakeTimers()

      const { generateText } = await import('ai')
      const mockGenerateText = vi.mocked(generateText)

      vi.clearAllMocks()
      // First call throws a transient error; all subsequent calls succeed
      mockGenerateText.mockRejectedValueOnce(new Error('temporary failure'))
      mockGenerateText.mockResolvedValue({ text: 'MX-4 mock analysis.' } as any)

      const { runOrchestrator } = await import('../../server/lib/ai/orchestrator')

      // Start run, advance fake timers past the 30s retry delay, then await completion
      const runPromise = runOrchestrator()
      await vi.runAllTimersAsync()
      await runPromise

      vi.useRealTimers()
    })

    it('aborts the full run on a rate-limit error', async () => {
      const { generateText } = await import('ai')
      const mockGenerateText = vi.mocked(generateText)

      vi.clearAllMocks()
      // First call hits rate limit; remaining calls would succeed but should never be reached
      mockGenerateText.mockRejectedValueOnce(new Error('quota exceeded: 429'))
      mockGenerateText.mockResolvedValue({ text: 'MX-4 mock analysis.' } as any)

      const { runOrchestrator } = await import('../../server/lib/ai/orchestrator')
      await expect(runOrchestrator()).rejects.toThrow(/quota exceeded: 429/)

      // Only one call should have been made — the rate-limit aborts the entire run
      expect(mockGenerateText).toHaveBeenCalledTimes(1)
    })

    it('rejects when a section fails all retry attempts, so callers can detect the failure', async () => {
      vi.useFakeTimers()

      const { generateText } = await import('ai')
      const mockGenerateText = vi.mocked(generateText)

      vi.clearAllMocks()
      mockGenerateText.mockRejectedValue(new Error('persistent model failure'))

      const { runOrchestrator } = await import('../../server/lib/ai/orchestrator')

      const runPromise = runOrchestrator()
      const assertion = expect(runPromise).rejects.toThrow(/persistent model failure/)
      await vi.runAllTimersAsync()
      await assertion

      vi.useRealTimers()
    })
  })

  describe('logging', () => {
    it('records an mx4-source log entry for the run', async () => {
      vi.clearAllMocks()
      const { generateText } = await import('ai')
      vi.mocked(generateText).mockResolvedValue({ text: 'MX-4 mock analysis.' } as any)

      const { runOrchestrator } = await import('../../server/lib/ai/orchestrator')
      await runOrchestrator()

      const { default: db } = await import('../../server/db/client')
      const rows = db.prepare("SELECT level, message FROM app_logs WHERE source = 'mx4'").all() as { level: string; message: string }[]
      expect(rows.length).toBeGreaterThan(0)
    })
  })

  describe('vault tool failures', () => {
    it('logs the failure and degrades gracefully when getVaultTools rejects during a section run', async () => {
      const vaultMod = await import('../../server/lib/ai/vaultClient')
      vi.clearAllMocks()
      vi.mocked(vaultMod.isVaultEnabled).mockReturnValue(true)
      vi.mocked(vaultMod.getVaultTools).mockRejectedValueOnce(new Error('ECONNREFUSED vault.local'))
      const { generateText } = await import('ai')
      vi.mocked(generateText).mockResolvedValue({ text: 'MX-4 mock analysis.' } as any)

      const { runSectionById } = await import('../../server/lib/ai/orchestrator')
      await expect(runSectionById('recovery')).resolves.toBeUndefined()

      const { default: db } = await import('../../server/db/client')
      const rows = db.prepare(
        "SELECT level, message FROM app_logs WHERE source = 'mx4' ORDER BY id DESC LIMIT 5"
      ).all() as { level: string; message: string }[]

      expect(rows.some(r => r.level === 'error' && r.message.includes('ECONNREFUSED vault.local'))).toBe(true)
    })
  })

  describe('wrapSession failures', () => {
    it('logs to app_logs when wrapSession rejects', async () => {
      const wrapMod = await import('../../server/lib/ai/wrap')
      vi.clearAllMocks()
      vi.mocked(wrapMod.wrapSession).mockRejectedValueOnce(new Error('synthesis failed: model unavailable'))
      const { generateText } = await import('ai')
      vi.mocked(generateText).mockResolvedValue({ text: 'MX-4 mock analysis.' } as any)

      const { runOrchestrator } = await import('../../server/lib/ai/orchestrator')
      await runOrchestrator()

      const { default: db } = await import('../../server/db/client')
      const rows = db.prepare(
        "SELECT level, message FROM app_logs WHERE source = 'mx4' ORDER BY id DESC LIMIT 10"
      ).all() as { level: string; message: string }[]

      expect(rows.some(r => r.level === 'error' && r.message.includes('synthesis failed: model unavailable'))).toBe(true)
    })
  })

  describe('same-day activity context', () => {
    const today = new Date().toLocaleDateString('en-CA')

    afterEach(async () => {
      const { default: db } = await import('../../server/db/client')
      db.prepare("DELETE FROM health_activities WHERE source = 'test-activity-context'").run()
    })

    it('includes same-day activities with their timestamps in the section prompt', async () => {
      const { default: db } = await import('../../server/db/client')
      db.prepare(
        `INSERT OR REPLACE INTO health_activities (activity_id, source, date, start_time, name, type_key, duration_s)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run('act-same-day-1', 'test-activity-context', today, `${today}T07:30:00`, 'Morning Walk', 'walking', 1800)

      vi.clearAllMocks()
      const { generateText } = await import('ai')
      const mockGenerateText = vi.mocked(generateText)
      mockGenerateText.mockResolvedValue({ text: 'MX-4 mock analysis.' } as any)

      const { runSectionById } = await import('../../server/lib/ai/orchestrator')
      await runSectionById('recovery')

      const promptArg = mockGenerateText.mock.calls[0][0].prompt as string
      expect(promptArg).toContain('Morning Walk')
      expect(promptArg).toContain('07:30')
    })

    it('omits the activity-context block when no activities were logged today', async () => {
      vi.clearAllMocks()
      const { generateText } = await import('ai')
      const mockGenerateText = vi.mocked(generateText)
      mockGenerateText.mockResolvedValue({ text: 'MX-4 mock analysis.' } as any)

      const { runSectionById } = await import('../../server/lib/ai/orchestrator')
      await runSectionById('recovery')

      const promptArg = mockGenerateText.mock.calls[0][0].prompt as string
      expect(promptArg).not.toContain("Today's Logged Activities")
    })

    it('looks up activities by the local calendar date, not the UTC date', async () => {
      // health_activities.date is Garmin's startTimeLocal calendar date (local
      // wall-clock day). 23:30 America/New_York on 2026-07-02 is already
      // 2026-07-03 in UTC — a naive `.toISOString()` "today" would look up the
      // wrong (empty) date and silently drop the activity from the prompt.
      const originalTz = process.env.TZ
      process.env.TZ = 'America/New_York'
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-07-03T03:30:00Z')) // 23:30 EDT on 2026-07-02

      try {
        const { default: db } = await import('../../server/db/client')
        db.prepare(
          `INSERT OR REPLACE INTO health_activities (activity_id, source, date, start_time, name, type_key, duration_s)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        ).run('act-late-evening', 'test-activity-context', '2026-07-02', '2026-07-02T19:00:00', 'Evening Run', 'running', 2400)

        vi.clearAllMocks()
        const { generateText } = await import('ai')
        const mockGenerateText = vi.mocked(generateText)
        mockGenerateText.mockResolvedValue({ text: 'MX-4 mock analysis.' } as any)

        const { runSectionById } = await import('../../server/lib/ai/orchestrator')
        await runSectionById('recovery')

        const promptArg = mockGenerateText.mock.calls[0][0].prompt as string
        expect(promptArg).toContain('Evening Run')
      } finally {
        // outer afterEach cleans up rows with source = 'test-activity-context'
        vi.useRealTimers()
        process.env.TZ = originalTz
      }
    })
  })
})
