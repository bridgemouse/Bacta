import { render, screen } from '@testing-library/react'
import { TopBar } from '../../../client/src/components/TopBar'

describe('TopBar', () => {
  it('shows the section label', () => {
    render(<TopBar section="recovery" />)
    expect(screen.getByText('Recovery')).toBeInTheDocument()
  })

  it('shows "Bacta" for home section', () => {
    render(<TopBar section="home" />)
    expect(screen.getByText('Bacta')).toBeInTheDocument()
  })

  it('shows MX-4 status indicator', () => {
    render(<TopBar section="recovery" />)
    expect(screen.getByText(/MX-4/)).toBeInTheDocument()
  })
})
