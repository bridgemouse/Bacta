import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { VitalTile } from '../../../../client/src/components/viz/VitalTile'
import { InfoCardProvider } from '../../../../client/src/lib/InfoCardContext'

const wrap = (ui: React.ReactElement) => render(<InfoCardProvider>{ui}</InfoCardProvider>)

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

describe('VitalTile info overlay', () => {
  it('shows overlay description when tapped with info prop', async () => {
    const user = userEvent.setup()
    wrap(
      <VitalTile label="Stress" value={24} unit="avg" accent="#64b5f6"
        info={{ description: 'HRV-derived stress' }} />
    )
    await user.click(screen.getByText('24'))
    expect(screen.getByText('HRV-derived stress')).toBeInTheDocument()
  })

  it('does not show overlay when no info prop', async () => {
    const user = userEvent.setup()
    wrap(<VitalTile label="Stress" value={24} unit="avg" accent="#64b5f6" />)
    await user.click(screen.getByText('24'))
    expect(screen.queryByRole('paragraph')).not.toBeInTheDocument()
  })
})
