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
