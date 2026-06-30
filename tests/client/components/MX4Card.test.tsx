import { render, screen, fireEvent, act } from '@testing-library/react'
import { vi, afterEach } from 'vitest'
import { TransmissionPanel, MX4Briefing } from '../../../client/src/components/MX4Card'
import { BRIEFS } from '../../../client/src/lib/stubData'

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('TransmissionPanel', () => {
  it('renders the assessment text', () => {
    render(
      <TransmissionPanel
        accent="#2bc4e8"
        assessment="Recovery is solid and trending up."
      />
    )
    expect(screen.getByText(/Recovery is solid and trending up/)).toBeInTheDocument()
  })

  it('renders the default label', () => {
    render(
      <TransmissionPanel
        accent="#2bc4e8"
        assessment="Standing by."
      />
    )
    expect(screen.getByText('INCOMING // MX-4')).toBeInTheDocument()
  })

  it('renders a custom label', () => {
    render(
      <TransmissionPanel
        accent="#7c9af8"
        label="MX-4 // RECOVERY"
        assessment="Recovery channel standing by."
      />
    )
    expect(screen.getByText('MX-4 // RECOVERY')).toBeInTheDocument()
  })

  it('renders default chip keys', () => {
    render(
      <TransmissionPanel
        accent="#2bc4e8"
        assessment="Standing by."
      />
    )
    expect(screen.getByText('TONE')).toBeInTheDocument()
    expect(screen.getByText('FLAGS')).toBeInTheDocument()
    expect(screen.getByText('SYNC')).toBeInTheDocument()
  })

  it('renders custom chips', () => {
    render(
      <TransmissionPanel
        accent="#7c9af8"
        assessment="Recovery channel standing by."
        chips={[['CH', 'RECOVERY'], ['DATA', 'PENDING']]}
      />
    )
    expect(screen.getByText('CH')).toBeInTheDocument()
    expect(screen.getByText('RECOVERY')).toBeInTheDocument()
    expect(screen.getByText('DATA')).toBeInTheDocument()
    expect(screen.getByText('PENDING')).toBeInTheDocument()
  })

  it('renders meta text when provided', () => {
    render(
      <TransmissionPanel
        accent="#2bc4e8"
        assessment="Standing by."
        meta="MON · MAY 29 · 06:00"
      />
    )
    expect(screen.getByText('MON · MAY 29 · 06:00')).toBeInTheDocument()
  })
})

describe('MX4Briefing', () => {
  const liveBriefing = {
    tone: 'POSITIVE' as const,
    headline: 'Systems nominal.',
    summary: 'Everything looks good today.',
    body: '## DIRECTIVE\nKeep it up.',
    recommendation: 'Train as planned.',
    flags: [],
  }

  it('renders REFRESH button when section prop is provided', () => {
    render(
      <MX4Briefing accent="#2bc4e8" brief={BRIEFS.home} liveData={liveBriefing} section="home" />
    )
    expect(screen.getByText('REFRESH ›')).toBeInTheDocument()
  })

  it('does not render REFRESH button when section prop is absent', () => {
    render(
      <MX4Briefing accent="#2bc4e8" brief={BRIEFS.home} liveData={liveBriefing} />
    )
    expect(screen.queryByText('REFRESH ›')).not.toBeInTheDocument()
  })
})

describe('MX4Briefing — handleFullAnalysis session ID at click time', () => {
  it('seeds using the UTC date at click time, not the stale date from render time', async () => {
    // Bug: sessionId is computed at render time. After UTC midnight (8pm EDT), if MX4Card
    // has not re-rendered since before midnight but AskSheet's useChat re-renders when it
    // opens, the seed goes to yesterday's session while messages load from today's — the
    // seeded content never appears.
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ok: true }),
    } as Response)
    vi.stubGlobal('fetch', fetchMock)

    vi.useFakeTimers()
    // Render at 23:58 UTC (2026-06-29)
    vi.setSystemTime(new Date('2026-06-29T23:58:00Z'))

    const briefing = {
      tone: 'POSITIVE' as const,
      headline: 'Systems nominal.',
      summary: 'All systems nominal.',
      body: '## ASSESSMENT\nHRV trending up.\n\n## DIRECTIVE\nTrain as planned.',
      recommendation: 'Train as planned.',
      flags: [],
      generated_at: '2026-06-29T23:50:00Z',
    }
    render(<MX4Briefing accent="#2bc4e8" brief={BRIEFS.home} liveData={briefing} section="home" />)

    // Advance past UTC midnight — now 2026-06-30
    vi.setSystemTime(new Date('2026-06-30T00:02:00Z'))

    await act(async () => {
      fireEvent.click(screen.getByText('FULL ANALYSIS ›'))
    })

    const seedCall = fetchMock.mock.calls.find(([url]: [string]) => url === '/api/mx4/chat/seed')
    expect(seedCall).toBeDefined()

    const seedBody = JSON.parse(seedCall![1].body as string) as { sessionId: string }
    // Must use 2026-06-30 (click time), not 2026-06-29 (stale render time)
    expect(seedBody.sessionId).toBe('chat-2026-06-30')
  })
})
