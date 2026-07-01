import { render, screen, fireEvent, act } from '@testing-library/react'
import { vi, afterEach } from 'vitest'
import { TransmissionPanel, MX4Briefing } from '../../../client/src/components/MX4Card'
import { BRIEFS } from '../../../client/src/lib/stubData'

const OLD_BRIEFING = { generated_at: 'ts-old', tone: 'POSITIVE' as const, headline: 'Old headline', body: 'Old body', recommendation: 'Old rec', flags: [] }
const NEW_BRIEFING = { generated_at: 'ts-new', tone: 'POSITIVE' as const, headline: 'New headline', body: 'New body', recommendation: 'New rec', flags: [] }

function makeFetch(responses: Array<object>) {
  let getCallCount = 0
  return vi.fn().mockImplementation((_url: string, opts?: RequestInit) => {
    if (opts?.method === 'POST') {
      return Promise.resolve({ ok: true, status: 202, json: () => Promise.resolve({ ok: true }) } as Response)
    }
    const resp = responses[Math.min(getCallCount, responses.length - 1)]
    getCallCount++
    return Promise.resolve({ ok: true, json: () => Promise.resolve(resp) } as Response)
  })
}

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
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

describe('MX4Briefing — handleRefresh', () => {
  it('does not call onRefresh prematurely when liveData has no generated_at but an old briefing exists in the API', async () => {
    // Scenario: user visits page before liveData prop loads (liveData=undefined), but the DB
    // already has an old briefing. handleRefresh should NOT call onRefresh just because the
    // polling found an existing briefing — it should establish a proper baseline first.
    vi.stubGlobal('fetch', makeFetch([OLD_BRIEFING, OLD_BRIEFING]))
    vi.useFakeTimers()

    const onRefresh = vi.fn()
    render(
      <MX4Briefing accent="#2bc4e8" brief={BRIEFS.home} liveData={undefined} section="home" onRefresh={onRefresh} />
    )

    await act(async () => {
      fireEvent.click(screen.getByText('REFRESH ›'))
    })

    // Advance 10 seconds → triggers the first poll (returns OLD_BRIEFING with same ts as baseline)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000)
    })

    // onRefresh must NOT be called — the poll returned the same timestamp as the baseline
    expect(onRefresh).not.toHaveBeenCalled()
  })

  it('calls onRefresh when polling detects a genuinely new briefing', async () => {
    // Baseline fetch returns old briefing; first poll also returns old; second poll returns new
    vi.stubGlobal('fetch', makeFetch([OLD_BRIEFING, OLD_BRIEFING, NEW_BRIEFING]))
    vi.useFakeTimers()

    const onRefresh = vi.fn()
    render(
      <MX4Briefing accent="#2bc4e8" brief={BRIEFS.home} liveData={OLD_BRIEFING} section="home" onRefresh={onRefresh} />
    )

    await act(async () => {
      fireEvent.click(screen.getByText('REFRESH ›'))
    })

    // First poll → still old briefing → no call
    await act(async () => { await vi.advanceTimersByTimeAsync(10_000) })
    expect(onRefresh).not.toHaveBeenCalled()

    // Second poll → new briefing detected → onRefresh called
    await act(async () => { await vi.advanceTimersByTimeAsync(10_000) })
    expect(onRefresh).toHaveBeenCalledTimes(1)
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

describe('MX4Briefing — handleRefresh failure feedback', () => {
  const liveBriefing = {
    tone: 'POSITIVE' as const,
    headline: 'Systems nominal.',
    summary: 'Everything looks good today.',
    body: '## DIRECTIVE\nKeep it up.',
    recommendation: 'Train as planned.',
    flags: [],
  }

  it('shows a FAILED state instead of silently reverting to REFRESH when the request errors', async () => {
    // Bug: the catch block was silent and finally always reset state to 'idle',
    // so a failed regeneration looked identical to a successful one.
    const fetchMock = vi.fn().mockRejectedValue(new Error('network error'))
    vi.stubGlobal('fetch', fetchMock)

    render(
      <MX4Briefing accent="#2bc4e8" brief={BRIEFS.home} liveData={liveBriefing} section="home" />
    )

    await act(async () => {
      fireEvent.click(screen.getByText('REFRESH ›'))
    })

    expect(screen.getByText('FAILED ›')).toBeInTheDocument()
  })

  it('does not let a stale failed-attempt timer clobber a genuinely in-flight retry', async () => {
    // Bug: the 4s auto-reset-to-idle timer from a failed attempt was never cancelled,
    // so it could fire mid-retry and revert the button to REFRESH while a second
    // request was still actively polling in the background.
    vi.useFakeTimers()
    let callCount = 0
    const fetchMock = vi.fn().mockImplementation(() => {
      callCount++
      if (callCount === 1) {
        // First attempt's POST fails immediately.
        return Promise.reject(new Error('network error'))
      }
      // Second attempt: never resolves, simulating a still in-flight request.
      return new Promise(() => {})
    })
    vi.stubGlobal('fetch', fetchMock)

    render(
      <MX4Briefing accent="#2bc4e8" brief={BRIEFS.home} liveData={liveBriefing} section="home" />
    )

    await act(async () => {
      fireEvent.click(screen.getByText('REFRESH ›'))
    })
    expect(screen.getByText('FAILED ›')).toBeInTheDocument()

    // Retry 1s into the first attempt's 4s auto-reset window.
    await act(async () => {
      vi.advanceTimersByTime(1000)
    })
    await act(async () => {
      fireEvent.click(screen.getByText('FAILED ›'))
    })
    expect(screen.getByText('RUNNING ›')).toBeInTheDocument()

    // Advance past the first attempt's original 4s-from-failure mark.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3500)
    })

    // Must still show RUNNING — the stale timer must not have reset it to idle.
    expect(screen.getByText('RUNNING ›')).toBeInTheDocument()

    vi.useRealTimers()
  })
})

describe('MX4Briefing — handleFullAnalysis', () => {
  it('normalizes literal \\N escape sequences in body before seeding to chat', async () => {
    // liveData.body contains literal backslash-N sequences (model output artifact)
    // After clicking FULL ANALYSIS, the seeded content must have real newlines instead
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ok: true }),
    } as Response)
    vi.stubGlobal('fetch', fetchMock)

    const briefing = {
      tone: 'POSITIVE' as const,
      headline: 'Training load nominal.',
      summary: 'Load is elevated. Reduce intensity.',
      body: '## ASSESSMENT\\NLoad is elevated.\\N\\N## DIRECTIVE\\NReduce intensity by 15%.',
      recommendation: 'Rest tomorrow.',
      flags: [],
      generated_at: 'ts-1',
    }

    render(
      <MX4Briefing accent="#fb923c" brief={BRIEFS.home} liveData={briefing} section="training" />
    )

    await act(async () => {
      fireEvent.click(screen.getByText('FULL ANALYSIS ›'))
    })

    const seedCall = fetchMock.mock.calls.find(([url]: [string]) => url === '/api/mx4/chat/seed')
    expect(seedCall).toBeDefined()

    const seedBody = JSON.parse(seedCall![1].body as string) as { content: string }
    // literal \N (backslash + uppercase N) must be absent — replaced with real newlines
    expect(seedBody.content).not.toMatch(/\\N/)
  })
})

describe('MX4Briefing — handleFullAnalysis directive fallback', () => {
  it('injects recommendation into seeded content when ## DIRECTIVE section has no body', async () => {
    // Root cause: orchestrator prompt says "End with ## DIRECTIVE." — model generates
    // the header but no content. Client-side fallback injects the recommendation field.
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ok: true }),
    } as Response)
    vi.stubGlobal('fetch', fetchMock)

    const briefing = {
      tone: 'CAUTION' as const,
      headline: 'Sleep light — protect tomorrow night.',
      summary: 'Sleep was adequate but shallow.',
      body: '## ASSESSMENT\nDuration was 7h 32m but deep sleep ran short.\n\n## DIRECTIVE',
      recommendation: 'No screens after 22:30. Consistent wake time is key.',
      flags: [],
      generated_at: 'ts-1',
    }

    render(
      <MX4Briefing accent="#a78bfa" brief={BRIEFS.home} liveData={briefing} section="sleep" />
    )

    await act(async () => {
      fireEvent.click(screen.getByText('FULL ANALYSIS ›'))
    })

    const seedCall = fetchMock.mock.calls.find(([url]: [string]) => url === '/api/mx4/chat/seed')
    expect(seedCall).toBeDefined()

    const seedBody = JSON.parse(seedCall![1].body as string) as { content: string }
    // recommendation must appear in the seeded content as fallback directive body
    expect(seedBody.content).toContain('No screens after 22:30')
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
