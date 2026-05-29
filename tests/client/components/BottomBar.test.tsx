import { render, screen, fireEvent } from '@testing-library/react'
import { BottomBar } from '../../../client/src/components/BottomBar'

describe('BottomBar', () => {
  it('renders provided action buttons', () => {
    render(
      <BottomBar
        actions={[{ icon: '🔄', label: 'Sync', onClick: vi.fn() }]}
        onMenuOpen={vi.fn()}
      />
    )
    expect(screen.getByText('Sync')).toBeInTheDocument()
  })

  it('calls action onClick when action button is clicked', () => {
    const onClick = vi.fn()
    render(
      <BottomBar
        actions={[{ icon: '🔄', label: 'Sync', onClick }]}
        onMenuOpen={vi.fn()}
      />
    )
    fireEvent.click(screen.getByText('Sync'))
    expect(onClick).toHaveBeenCalled()
  })

  it('renders menu button with data-testid', () => {
    render(<BottomBar actions={[]} onMenuOpen={vi.fn()} />)
    expect(screen.getByTestId('menu-button')).toBeInTheDocument()
  })

  it('calls onMenuOpen when menu button is clicked', () => {
    const onMenuOpen = vi.fn()
    render(<BottomBar actions={[]} onMenuOpen={onMenuOpen} />)
    fireEvent.click(screen.getByTestId('menu-button'))
    expect(onMenuOpen).toHaveBeenCalled()
  })

  it('renders no action buttons when actions is empty', () => {
    render(<BottomBar actions={[]} onMenuOpen={vi.fn()} />)
    expect(screen.queryByRole('button', { name: /sync/i })).not.toBeInTheDocument()
  })
})
