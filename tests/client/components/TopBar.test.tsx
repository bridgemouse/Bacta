import { render, screen, fireEvent } from '@testing-library/react'
import { TopBar } from '../../../client/src/components/TopBar'

describe('BactaStatusBar (TopBar)', () => {
  it('renders BACTA and ·OS in home mode', () => {
    render(<TopBar section="home" />)
    expect(screen.getByText('BACTA')).toBeInTheDocument()
    expect(screen.getByText('·OS')).toBeInTheDocument()
  })

  it('renders MX-4 ONLINE in home mode', () => {
    render(<TopBar section="home" />)
    expect(screen.getByText('MX-4 ONLINE')).toBeInTheDocument()
  })

  it('renders section label in section mode', () => {
    render(<TopBar section="recovery" onBack={vi.fn()} />)
    expect(screen.getByText('RECOVERY')).toBeInTheDocument()
  })

  it('renders back button in section mode', () => {
    render(<TopBar section="sleep" onBack={vi.fn()} />)
    expect(screen.getByLabelText('Back')).toBeInTheDocument()
  })

  it('calls onBack when back button is clicked', () => {
    const onBack = vi.fn()
    render(<TopBar section="training" onBack={onBack} />)
    fireEvent.click(screen.getByLabelText('Back'))
    expect(onBack).toHaveBeenCalled()
  })

  it('does not render back button in home mode', () => {
    render(<TopBar section="home" />)
    expect(screen.queryByLabelText('Back')).not.toBeInTheDocument()
  })
})
