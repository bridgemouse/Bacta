import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AppShell } from '../../../client/src/components/AppShell'

function renderShell(props: { actions?: { icon: string; label: string; onClick: () => void }[] } = {}) {
  return render(
    <MemoryRouter initialEntries={['/recovery']}>
      <AppShell section="recovery" actions={props.actions ?? []}>
        <div data-testid="child">content</div>
      </AppShell>
    </MemoryRouter>
  )
}

describe('AppShell', () => {
  it('renders children in content area', () => {
    renderShell()
    expect(screen.getByTestId('child')).toBeInTheDocument()
  })

  it('renders the section label via TopBar', () => {
    renderShell()
    expect(screen.getByText('Recovery')).toBeInTheDocument()
  })

  it('renders provided action buttons via BottomBar', () => {
    renderShell({ actions: [{ icon: '🔄', label: 'Sync', onClick: vi.fn() }] })
    expect(screen.getByText('Sync')).toBeInTheDocument()
  })

  it('opens BottomSheet when menu button is clicked', () => {
    renderShell()
    fireEvent.click(screen.getByTestId('menu-button'))
    expect(screen.getByTestId('bottom-sheet')).toBeInTheDocument()
  })

  it('closes BottomSheet when overlay is clicked', () => {
    renderShell()
    fireEvent.click(screen.getByTestId('menu-button'))
    fireEvent.click(screen.getByTestId('bottom-sheet-overlay'))
    expect(screen.queryByTestId('bottom-sheet')).not.toBeInTheDocument()
  })

  it('bottom sheet lists all 7 sections', () => {
    renderShell()
    fireEvent.click(screen.getByTestId('menu-button'))
    const sheet = screen.getByTestId('bottom-sheet')
    expect(sheet).toHaveTextContent('Home')
    expect(sheet).toHaveTextContent('Recovery')
    expect(sheet).toHaveTextContent('Training')
    expect(sheet).toHaveTextContent('Sleep')
    expect(sheet).toHaveTextContent('Nutrition')
    expect(sheet).toHaveTextContent('Blood Work')
    expect(sheet).toHaveTextContent('Daily Log')
  })
})
