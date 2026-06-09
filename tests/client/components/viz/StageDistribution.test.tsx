import { render, screen } from '@testing-library/react'
import { StageDistribution } from '../../../../client/src/components/viz/StageDistribution'

const STAGES = [
  { key: 'deep',  label: 'Deep',  mins: 63,  pct: 18, color: '#7c5cff' },
  { key: 'light', label: 'Light', mins: 256, pct: 57, color: '#a78bfa' },
  { key: 'rem',   label: 'REM',   mins: 102, pct: 25, color: '#c4b5fd' },
  { key: 'awake', label: 'Awake', mins: 42,  pct: 0,  color: '#56657a' },
]

describe('StageDistribution', () => {
  it('renders all four stage labels', () => {
    render(<StageDistribution stages={STAGES} />)
    expect(screen.getByText('Deep')).toBeInTheDocument()
    expect(screen.getByText('Light')).toBeInTheDocument()
    // REM appears in row + footer
    expect(screen.getAllByText('REM').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Awake')).toBeInTheDocument()
  })

  it('renders minute values for all active stages', () => {
    render(<StageDistribution stages={STAGES} />)
    expect(screen.getByText('63m')).toBeInTheDocument()
    expect(screen.getByText('256m')).toBeInTheDocument()
    expect(screen.getByText('102m')).toBeInTheDocument()
    expect(screen.getByText('42m')).toBeInTheDocument()
  })

  it('renders DEEP and REM footer labels', () => {
    render(<StageDistribution stages={STAGES} />)
    expect(screen.getByText('DEEP')).toBeInTheDocument()
    // REM appears in row + footer — at least 2 instances
    expect(screen.getAllByText('REM').length).toBeGreaterThanOrEqual(2)
  })

  it('renders TOTAL in footer with correct value', () => {
    render(<StageDistribution stages={STAGES} />)
    // total = 63+256+102+42 = 463; rendered as "TOTAL" + "463 min" in adjacent spans
    expect(screen.getByText('TOTAL')).toBeInTheDocument()
    expect(screen.getByText('463 min')).toBeInTheDocument()
  })

  it('renders awake percentage using full total (not hook pct=0)', () => {
    render(<StageDistribution stages={STAGES} />)
    // awake 42 / 463 total = ~9%
    const pcts = screen.getAllByText(/^\d+%$/)
    const values = pcts.map(el => el.textContent)
    expect(values).toContain('9%')
  })

  it('returns null when all stages are zero', () => {
    const { container } = render(
      <StageDistribution stages={STAGES.map(s => ({ ...s, mins: 0 }))} />
    )
    expect(container.firstChild).toBeNull()
  })
})
