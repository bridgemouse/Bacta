import { render, screen, fireEvent, act } from '@testing-library/react'
import { vi, afterEach } from 'vitest'
import { TransmissionPanel, MX4Briefing } from '../../../client/src/components/MX4Card'
import { BRIEFS } from '../../../client/src/lib/stubData'
import { ToastProvider } from '../../../client/src/lib/ToastContext'
import { ToastContainer } from '../../../client/src/components/ToastContainer'

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

describe('MX4Briefing — handleRefresh error toast', () => {
  const liveBriefing = {
    tone: 'POSITIVE' as const,
    headline: 'Systems nominal.',
    summary: 'Everything looks good today.',
    body: '## DIRECTIVE\nKeep it up.',
    recommendation: 'Train as planned.',
    flags: [],
  }

  it('shows a toast with the categorized error when the section run fails', async () => {
    const fetchMock = vi.fn((url: string) => {
      if (url === '/api/mx4/run/home') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true }) } as Response)
      }
      if (url === '/api/insights/home') {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ generated_at: undefined }) } as Response)
      }
      if (url === '/api/mx4/run/home/status') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ error: 'No AI provider configured. Check Settings → Intelligence.' }),
        } as Response)
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) } as Response)
    })
    vi.stubGlobal('fetch', fetchMock)
    vi.useFakeTimers()

    render(
      <ToastProvider>
        <ToastContainer />
        <MX4Briefing accent="#2bc4e8" brief={BRIEFS.home} liveData={liveBriefing} section="home" />
      </ToastProvider>
    )

    await act(async () => {
      fireEvent.click(screen.getByText('REFRESH ›'))
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000)
    })

    expect(screen.getByText(/No AI provider configured/)).toBeInTheDocument()
  })

  it('does not poll for status when the trigger is rejected as already-running (409)', async () => {
    // Bug: sectionRunErrors is only cleared on the accepted-request path. A 409-rejected
    // click would otherwise poll /run/:section/status and could surface a stale error
    // left over from a previous, unrelated failed run of this section.
    const statusMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ error: 'stale error from a previous run' }),
    } as Response)
    const fetchMock = vi.fn((url: string) => {
      if (url === '/api/mx4/run/home') {
        return Promise.resolve({ ok: false, status: 409, json: () => Promise.resolve({ ok: false }) } as Response)
      }
      if (url === '/api/mx4/run/home/status') {
        return statusMock()
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) } as Response)
    })
    vi.stubGlobal('fetch', fetchMock)
    vi.useFakeTimers()

    render(
      <ToastProvider>
        <ToastContainer />
        <MX4Briefing accent="#2bc4e8" brief={BRIEFS.home} liveData={liveBriefing} section="home" />
      </ToastProvider>
    )

    await act(async () => {
      fireEvent.click(screen.getByText('REFRESH ›'))
    })

    expect(screen.getByText(/already running/i)).toBeInTheDocument()
    expect(screen.queryByText(/stale error from a previous run/)).not.toBeInTheDocument()

    // Advance well past a poll interval — status must never be checked for a rejected trigger.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000)
    })
    expect(statusMock).not.toHaveBeenCalled()
  })
})
