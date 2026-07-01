import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SystemCard } from '../../../client/src/components/MetricTile'
import type { SystemCardTile } from '../../../client/src/components/MetricTile'

const sparkTile: SystemCardTile = {
  key: 'recovery',
  value: '74',
  unit: 'battery',
  sub: 'HRV ↑ 61ms',
  viz: 'spark',
  spark: [50, 54, 49, 57, 55, 60, 66, 74],
  status: 'Good',
}

const ringTile: SystemCardTile = {
  key: 'sleep',
  value: '8.1',
  unit: 'h',
  sub: 'Score 82',
  viz: 'ring',
  ring: 0.82,
  status: 'Solid',
}

const dotsTile: SystemCardTile = {
  key: 'dailylog',
  value: '4',
  unit: '/ 5',
  sub: 'Logged today',
  viz: 'dots',
  dots: 4,
  status: 'Logged',
}

const shieldTile: SystemCardTile = {
  key: 'bloodwork',
  value: 'Clear',
  unit: '',
  sub: 'No flags · 0 panels',
  viz: 'shield',
  status: 'Nominal',
}

describe('SystemCard', () => {
  it('renders section label in uppercase', () => {
    render(<SystemCard tile={sparkTile} index={1} />)
    expect(screen.getByText('RECOVERY')).toBeInTheDocument()
  })

  it('renders value', () => {
    render(<SystemCard tile={sparkTile} index={1} />)
    expect(screen.getByText('74')).toBeInTheDocument()
  })

  it('renders unit', () => {
    render(<SystemCard tile={sparkTile} index={1} />)
    expect(screen.getByText('battery')).toBeInTheDocument()
  })

  it('renders sub text', () => {
    render(<SystemCard tile={sparkTile} index={1} />)
    expect(screen.getByText('HRV ↑ 61ms')).toBeInTheDocument()
  })

  it('renders zero-padded two-digit index', () => {
    render(<SystemCard tile={sparkTile} index={1} />)
    expect(screen.getByText('01')).toBeInTheDocument()
  })

  it('renders index 6 as 06', () => {
    render(<SystemCard tile={shieldTile} index={6} />)
    expect(screen.getByText('06')).toBeInTheDocument()
  })

  it('calls onClick when clicked', async () => {
    const onClick = vi.fn()
    render(<SystemCard tile={sparkTile} index={1} onClick={onClick} />)
    await userEvent.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('renders shield viz with status text for bloodwork', () => {
    render(<SystemCard tile={shieldTile} index={4} />)
    expect(screen.getByText('Nominal')).toBeInTheDocument()
  })

  it('renders sleep label for ring tile', () => {
    render(<SystemCard tile={ringTile} index={3} />)
    expect(screen.getByText('SLEEP')).toBeInTheDocument()
  })

  it('renders the numeric score inside the ring dial', () => {
    render(<SystemCard tile={ringTile} index={3} />)
    expect(screen.getByText('82')).toBeInTheDocument()
  })

  it('renders dailylog label for dots tile', () => {
    render(<SystemCard tile={dotsTile} index={6} />)
    expect(screen.getByText('DAILY LOG')).toBeInTheDocument()
  })
})
