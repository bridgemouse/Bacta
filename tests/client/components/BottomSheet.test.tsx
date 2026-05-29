import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { BottomSheet } from '../../../client/src/components/BottomSheet'

function renderSheet(isOpen: boolean, onClose = vi.fn()) {
  return render(
    <MemoryRouter>
      <BottomSheet isOpen={isOpen} onClose={onClose} activeSection="home" />
    </MemoryRouter>
  )
}

describe('BottomSheet', () => {
  it('renders nothing when closed', () => {
    renderSheet(false)
    expect(screen.queryByTestId('bottom-sheet-overlay')).not.toBeInTheDocument()
  })

  it('renders overlay and panel when open', () => {
    renderSheet(true)
    expect(screen.getByTestId('bottom-sheet-overlay')).toBeInTheDocument()
    expect(screen.getByTestId('bottom-sheet')).toBeInTheDocument()
  })

  it('calls onClose when overlay is clicked', () => {
    const onClose = vi.fn()
    renderSheet(true, onClose)
    fireEvent.click(screen.getByTestId('bottom-sheet-overlay'))
    expect(onClose).toHaveBeenCalled()
  })

  it('renders all 7 section labels', () => {
    renderSheet(true)
    const sheet = screen.getByTestId('bottom-sheet')
    expect(sheet).toHaveTextContent('Home')
    expect(sheet).toHaveTextContent('Recovery')
    expect(sheet).toHaveTextContent('Training')
    expect(sheet).toHaveTextContent('Sleep')
    expect(sheet).toHaveTextContent('Nutrition')
    expect(sheet).toHaveTextContent('Blood Work')
    expect(sheet).toHaveTextContent('Daily Log')
  })

  it('renders profile header with Ethan and MX-4 status', () => {
    renderSheet(true)
    expect(screen.getByText('Ethan')).toBeInTheDocument()
    expect(screen.getByText(/MX-4 online/)).toBeInTheDocument()
  })

  it('calls onClose when a section is clicked', () => {
    const onClose = vi.fn()
    renderSheet(true, onClose)
    fireEvent.click(screen.getByText('Training'))
    expect(onClose).toHaveBeenCalled()
  })
})
