import { render, screen } from '@testing-library/react'
import { MX4Card } from '../../../client/src/components/MX4Card'

describe('MX4Card', () => {
  const mockInsight = {
    generated_at: '2026-05-28T06:12:00',
    summary: 'HRV up 4ms — looking good for Thursday.',
    tone: 'positive' as const,
    flags: [],
  }

  it('renders the summary text', () => {
    render(<MX4Card insight={mockInsight} section="recovery" />)
    expect(screen.getByText('HRV up 4ms — looking good for Thursday.')).toBeInTheDocument()
  })

  it('renders section label in header', () => {
    render(<MX4Card insight={mockInsight} section="recovery" />)
    expect(screen.getByText(/MX-4/)).toBeInTheDocument()
  })

  it('shows a loading state when insight is null', () => {
    render(<MX4Card insight={null} section="recovery" />)
    expect(screen.getByTestId('mx4-loading')).toBeInTheDocument()
  })

  it('shows a generating indicator when isGenerating is true', () => {
    render(<MX4Card insight={mockInsight} section="recovery" isGenerating />)
    expect(screen.getByTestId('mx4-generating')).toBeInTheDocument()
  })
})
