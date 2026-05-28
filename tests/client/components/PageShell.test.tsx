import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { PageShell } from '../../../client/src/components/PageShell'

const mockInsight = {
  generated_at: '2026-05-28T06:00:00',
  summary: 'All good.',
  tone: 'positive' as const,
  flags: [],
}

describe('PageShell', () => {
  it('renders section title in header', () => {
    render(
      <MemoryRouter>
        <PageShell section="recovery" tabs={['Overview', 'HRV']} insight={mockInsight} onMenuOpen={() => {}}>
          <div>content</div>
        </PageShell>
      </MemoryRouter>
    )
    expect(screen.getByText('Recovery')).toBeInTheDocument()
  })

  it('calls onMenuOpen when hamburger is clicked', () => {
    const onMenuOpen = vi.fn()
    render(
      <MemoryRouter>
        <PageShell section="recovery" tabs={['Overview']} insight={null} onMenuOpen={onMenuOpen}>
          <div>content</div>
        </PageShell>
      </MemoryRouter>
    )
    fireEvent.click(screen.getByTestId('menu-button'))
    expect(onMenuOpen).toHaveBeenCalled()
  })

  it('renders MX4Card when insight is provided', () => {
    render(
      <MemoryRouter>
        <PageShell section="recovery" tabs={['Overview']} insight={mockInsight} onMenuOpen={() => {}}>
          <div>content</div>
        </PageShell>
      </MemoryRouter>
    )
    expect(screen.getByText('All good.')).toBeInTheDocument()
  })

  it('renders children', () => {
    render(
      <MemoryRouter>
        <PageShell section="recovery" tabs={['Overview']} insight={null} onMenuOpen={() => {}}>
          <div data-testid="child-content">hello</div>
        </PageShell>
      </MemoryRouter>
    )
    expect(screen.getByTestId('child-content')).toBeInTheDocument()
  })
})
