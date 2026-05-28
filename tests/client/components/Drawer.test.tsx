import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Drawer } from '../../../client/src/components/Drawer'

const renderDrawer = (isOpen: boolean, onClose = vi.fn()) =>
  render(
    <MemoryRouter>
      <Drawer isOpen={isOpen} onClose={onClose} activeSection="home" />
    </MemoryRouter>
  )

describe('Drawer', () => {
  it('renders all section labels when open', () => {
    renderDrawer(true)
    expect(screen.getByText('Home')).toBeInTheDocument()
    expect(screen.getByText('Recovery')).toBeInTheDocument()
    expect(screen.getByText('Training')).toBeInTheDocument()
    expect(screen.getByText('Sleep')).toBeInTheDocument()
    expect(screen.getByText('Nutrition')).toBeInTheDocument()
    expect(screen.getByText('Blood Work')).toBeInTheDocument()
    expect(screen.getByText('Daily Log')).toBeInTheDocument()
  })

  it('calls onClose when overlay is clicked', () => {
    const onClose = vi.fn()
    renderDrawer(true, onClose)
    fireEvent.click(screen.getByTestId('drawer-overlay'))
    expect(onClose).toHaveBeenCalled()
  })

  it('is hidden when isOpen is false', () => {
    renderDrawer(false)
    expect(screen.queryByText('Recovery')).not.toBeInTheDocument()
  })
})
