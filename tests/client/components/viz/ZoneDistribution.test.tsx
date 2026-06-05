import { render, screen } from '@testing-library/react'
import { ZoneDistribution } from '../../../../client/src/components/viz/ZoneDistribution'

const ZONES = [
  { zone: 1, label: 'Warm Up',   mins: 5.5, pct: 87, color: '#56657a' },
  { zone: 2, label: 'Easy',      mins: 0.8, pct: 13, color: '#4ade80' },
  { zone: 3, label: 'Aerobic',   mins: 0,   pct: 0,  color: '#fbbf24' },
  { zone: 4, label: 'Threshold', mins: 0,   pct: 0,  color: '#f87171' },
  { zone: 5, label: 'Maximum',   mins: 0,   pct: 0,  color: '#ef4444' },
]

describe('ZoneDistribution', () => {
  it('renders all 5 zone labels in the vertical list', () => {
    render(<ZoneDistribution zones={ZONES} accent="#fb923c" />)
    expect(screen.getByText('Warm Up')).toBeInTheDocument()
    expect(screen.getByText('Easy')).toBeInTheDocument()
    expect(screen.getByText('Aerobic')).toBeInTheDocument()
    expect(screen.getByText('Threshold')).toBeInTheDocument()
    expect(screen.getByText('Maximum')).toBeInTheDocument()
  })

  it('shows time value for active zones', () => {
    render(<ZoneDistribution zones={ZONES} accent="#fb923c" />)
    expect(screen.getByText('5.5m')).toBeInTheDocument()
    expect(screen.getByText('0.8m')).toBeInTheDocument()
  })

  it('shows — for inactive zones', () => {
    render(<ZoneDistribution zones={ZONES} accent="#fb923c" />)
    const dashes = screen.getAllByText('—')
    expect(dashes).toHaveLength(3)
  })

  it('shows percentage only for active zones', () => {
    render(<ZoneDistribution zones={ZONES} accent="#fb923c" />)
    expect(screen.getByText('87%')).toBeInTheDocument()
    expect(screen.getByText('13%')).toBeInTheDocument()
  })

  it('shows correct TOTAL in summary footer', () => {
    render(<ZoneDistribution zones={ZONES} accent="#fb923c" />)
    // totalMins = Math.round(5.5 + 0.8) = 6
    expect(screen.getByText('6 min')).toBeInTheDocument()
  })

  it('shows correct Z2+ in summary footer', () => {
    render(<ZoneDistribution zones={ZONES} accent="#fb923c" />)
    // z2plus = 0.8 + 0 + 0 + 0 = 0.8
    expect(screen.getByText('0.8 min')).toBeInTheDocument()
  })

  it('returns null when all zones have 0 mins', () => {
    const empty = ZONES.map(z => ({ ...z, mins: 0, pct: 0 }))
    const { container } = render(<ZoneDistribution zones={empty} accent="#fb923c" />)
    expect(container.firstChild).toBeNull()
  })
})
