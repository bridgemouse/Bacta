import { render, screen } from '@testing-library/react'
import { HRVRangeBadge } from '../../../../client/src/components/viz/HRVRangeBadge'
import { COLORS } from '../../../../client/src/theme'

describe('HRVRangeBadge', () => {
  it('shows both badges plus a qualifying caption when today is BELOW range but the week trend is IMPROVING', () => {
    // Exact issue #115 scenario: HRV 53,58,68,72,70,57 across 7/3-7/9 — today (57) is
    // below baseline, but the whole-week slope stays net positive. Both badges are
    // independently correct; the caption is what stops them from reading as contradictory.
    render(
      <HRVRangeBadge
        inRange={false}
        direction={{ slope: 0.5, direction: 'up', label: '↑ IMPROVING', sub: '+0.5 ms/day' }}
        dirColor={COLORS.green}
      />
    )

    expect(screen.getByText('BELOW')).toBeInTheDocument()
    expect(screen.getByText('↑ IMPROVING')).toBeInTheDocument()
    expect(screen.getByText(/7-day trend/i)).toBeInTheDocument()
  })

  it('does not show a caption when there is no direction data yet', () => {
    render(<HRVRangeBadge inRange={true} direction={null} dirColor={COLORS.green} />)

    expect(screen.getByText('IN RANGE')).toBeInTheDocument()
    expect(screen.queryByText(/7-day trend/i)).not.toBeInTheDocument()
  })
})
