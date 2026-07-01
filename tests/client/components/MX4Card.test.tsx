import { render, screen, fireEvent, act } from '@testing-library/react'
import { vi, afterEach } from 'vitest'
import { TransmissionPanel, MX4Briefing } from '../../../client/src/components/MX4Card'
import { BRIEFS } from '../../../client/src/lib/stubData'

afterEach(() => {
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
