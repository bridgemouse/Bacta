import { render, screen, fireEvent } from '@testing-library/react'
import { BottomBar } from '../../../client/src/components/BottomBar'

describe('BottomBar', () => {
  it('renders tab buttons when tabs prop is provided', () => {
    render(
      <BottomBar
        tabs={['Overview', 'Trends']}
        activeTab="Overview"
        accent="#64b5f6"
        onTabChange={vi.fn()}
        onMenuOpen={vi.fn()}
      />
    )
    expect(screen.getByText('Overview')).toBeInTheDocument()
    expect(screen.getByText('Trends')).toBeInTheDocument()
  })

  it('marks the active tab with data-active="true"', () => {
    render(
      <BottomBar
        tabs={['Overview', 'Trends']}
        activeTab="Trends"
        accent="#64b5f6"
        onTabChange={vi.fn()}
        onMenuOpen={vi.fn()}
      />
    )
    expect(screen.getByText('Trends').closest('[data-active="true"]')).toBeInTheDocument()
    expect(screen.getByText('Overview').closest('[data-active="false"]')).toBeInTheDocument()
  })

  it('calls onTabChange when a tab is clicked', () => {
    const onTabChange = vi.fn()
    render(
      <BottomBar
        tabs={['Overview', 'Trends']}
        activeTab="Overview"
        accent="#64b5f6"
        onTabChange={onTabChange}
        onMenuOpen={vi.fn()}
      />
    )
    fireEvent.click(screen.getByText('Trends'))
    expect(onTabChange).toHaveBeenCalledWith('Trends')
  })

  it('renders no tab buttons when tabs is undefined', () => {
    render(<BottomBar onMenuOpen={vi.fn()} />)
    expect(screen.queryByRole('button', { name: /overview/i })).not.toBeInTheDocument()
  })

  it('renders menu button with data-testid', () => {
    render(<BottomBar onMenuOpen={vi.fn()} />)
    expect(screen.getByTestId('menu-button')).toBeInTheDocument()
  })

  it('calls onMenuOpen when menu button is clicked', () => {
    const onMenuOpen = vi.fn()
    render(<BottomBar onMenuOpen={onMenuOpen} />)
    fireEvent.click(screen.getByTestId('menu-button'))
    expect(onMenuOpen).toHaveBeenCalled()
  })
})
