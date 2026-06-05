import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LogEntry } from '../../../../client/src/components/viz/LogEntry'

const ACTIVITY = {
  activity_id: 1,
  date: '2026-06-05',
  start_time: '2026-06-05 07:30:00',
  name: 'Morning Run',
  type_key: 'running',
  distance_m: 7900,
  duration_s: 3540,
  calories: 627,
  avg_hr: 148,
  elevation_m: null,
}

describe('LogEntry', () => {
  it('renders activity label and stats', () => {
    render(<LogEntry activity={ACTIVITY} accent="#fb923c" />)
    expect(screen.getByText('Run')).toBeInTheDocument()
    expect(screen.getByText(/7\.9 km/)).toBeInTheDocument()
  })

  it('renders the chevron character', () => {
    render(<LogEntry activity={ACTIVITY} accent="#fb923c" />)
    expect(screen.getByText('›')).toBeInTheDocument()
  })

  it('chevron has no rotation by default', () => {
    render(<LogEntry activity={ACTIVITY} accent="#fb923c" />)
    const chevron = screen.getByText('›')
    expect(chevron).toHaveStyle({ transform: 'none' })
  })

  it('chevron rotates 90deg when entry is clicked', async () => {
    const user = userEvent.setup()
    render(<LogEntry activity={ACTIVITY} accent="#fb923c" />)
    await user.click(screen.getByRole('button'))
    expect(screen.getByText('›')).toHaveStyle({ transform: 'rotate(90deg)' })
  })

  it('chevron returns to no rotation on second click', async () => {
    const user = userEvent.setup()
    render(<LogEntry activity={ACTIVITY} accent="#fb923c" />)
    await user.click(screen.getByRole('button'))
    await user.click(screen.getByRole('button'))
    expect(screen.getByText('›')).toHaveStyle({ transform: 'none' })
  })

  it('does not render expanded panel (no Phase C data)', async () => {
    const user = userEvent.setup()
    const { container } = render(<LogEntry activity={ACTIVITY} accent="#fb923c" />)
    await user.click(screen.getByRole('button'))
    const panels = container.querySelectorAll('[style*="border-top"]')
    expect(panels).toHaveLength(0)
  })
})
