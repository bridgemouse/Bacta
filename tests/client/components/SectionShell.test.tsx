import { render, screen } from '@testing-library/react'
import { SectionShell } from '../../../client/src/components/SectionShell'

describe('SectionShell', () => {
  it('renders recovery channel greeting', () => {
    render(<SectionShell section="recovery" />)
    expect(screen.getByText(/Recovery channel online/)).toBeInTheDocument()
  })

  it('renders the calibrating footer', () => {
    render(<SectionShell section="recovery" />)
    expect(screen.getByText(/MX-4 IS CALIBRATING THIS SYSTEM/)).toBeInTheDocument()
  })

  it('renders sleep channel greeting', () => {
    render(<SectionShell section="sleep" />)
    expect(screen.getByText(/Sleep channel online/)).toBeInTheDocument()
  })

  it('renders training channel greeting', () => {
    render(<SectionShell section="training" />)
    expect(screen.getByText(/Training channel online/)).toBeInTheDocument()
  })

  it('renders nutrition channel greeting', () => {
    render(<SectionShell section="nutrition" />)
    expect(screen.getByText(/Nutrition channel online/)).toBeInTheDocument()
  })

  it('renders bloodwork channel greeting', () => {
    render(<SectionShell section="bloodwork" />)
    expect(screen.getByText(/Blood Work channel online/)).toBeInTheDocument()
  })

  it('renders dailylog channel greeting', () => {
    render(<SectionShell section="dailylog" />)
    expect(screen.getByText(/Daily Log channel online/)).toBeInTheDocument()
  })
})
