import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { BottomSheet } from '../../../client/src/components/BottomSheet'

function renderSheet(open: boolean, onClose = vi.fn()) {
  return render(
    <MemoryRouter>
      <BottomSheet open={open} onClose={onClose} currentSection="home" />
    </MemoryRouter>
  )
}

describe('NavSheet (BottomSheet)', () => {
  it('renders nothing when closed', () => {
    renderSheet(false)
    expect(screen.queryByTestId('sheet-backdrop')).not.toBeInTheDocument()
  })

  it('renders the sheet when open', () => {
    renderSheet(true)
    expect(screen.getByTestId('sheet-backdrop')).toBeInTheDocument()
  })

  it('renders ALL SYSTEMS title', () => {
    renderSheet(true)
    expect(screen.getByText('ALL SYSTEMS')).toBeInTheDocument()
  })

  it('renders Home · Overview row', () => {
    renderSheet(true)
    expect(screen.getByText('Home · Overview')).toBeInTheDocument()
  })

  it('renders all 6 section channel labels', () => {
    renderSheet(true)
    expect(screen.getByText('Recovery')).toBeInTheDocument()
    expect(screen.getByText('Training')).toBeInTheDocument()
    expect(screen.getByText('Sleep')).toBeInTheDocument()
    expect(screen.getByText('Nutrition')).toBeInTheDocument()
    expect(screen.getByText('Blood Work')).toBeInTheDocument()
    expect(screen.getByText('Daily Log')).toBeInTheDocument()
  })

  it('calls onClose when backdrop is clicked', () => {
    const onClose = vi.fn()
    renderSheet(true, onClose)
    fireEvent.click(screen.getByTestId('sheet-backdrop'))
    expect(onClose).toHaveBeenCalled()
  })

  it('calls onClose when × button is clicked', () => {
    const onClose = vi.fn()
    renderSheet(true, onClose)
    fireEvent.click(screen.getByLabelText('Close'))
    expect(onClose).toHaveBeenCalled()
  })
})
