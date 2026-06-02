import { render, screen } from '@testing-library/react'
import { VitalTile } from '../../../../client/src/components/viz/VitalTile'

describe('VitalTile', () => {
  it('renders label and value', () => {
    render(<VitalTile label="Stress" value={24} unit="avg" accent="#7c9af8" />)
    expect(screen.getByText('Stress')).toBeInTheDocument()
    expect(screen.getByText('24')).toBeInTheDocument()
  })

  it('renders sub text when provided', () => {
    render(<VitalTile label="Stress" value={24} unit="avg" accent="#7c9af8" sub="LOW" />)
    expect(screen.getByText('LOW')).toBeInTheDocument()
  })

  it('does not render sub element when omitted', () => {
    render(<VitalTile label="Stress" value={24} unit="avg" accent="#7c9af8" />)
    expect(screen.queryByText('LOW')).not.toBeInTheDocument()
  })
})
