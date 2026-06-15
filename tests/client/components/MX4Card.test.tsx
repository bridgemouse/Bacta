import { render, screen } from '@testing-library/react'
import { TransmissionPanel, MX4Briefing } from '../../../client/src/components/MX4Card'
import { BRIEFS } from '../../../client/src/lib/stubData'

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
