import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HealthStatusTile } from '../../../../client/src/components/viz/HealthStatusTile'
import { InfoCardProvider } from '../../../../client/src/lib/InfoCardContext'

const wrap = (ui: React.ReactElement) => render(<InfoCardProvider>{ui}</InfoCardProvider>)

describe('HealthStatusTile', () => {
  it('renders label and value', () => {
    wrap(<HealthStatusTile label="Stress avg" value={24} unit="avg" accent="#64b5f6" />)
    expect(screen.getByText('Stress avg')).toBeInTheDocument()
    expect(screen.getByText('24')).toBeInTheDocument()
  })

  it('renders sub text', () => {
    wrap(<HealthStatusTile label="Stress avg" value={24} accent="#64b5f6" sub="LOW" />)
    expect(screen.getByText('LOW')).toBeInTheDocument()
  })

  it('applies green sub text when inRange is true', () => {
    wrap(<HealthStatusTile label="SpO₂" value={97} unit="%" accent="#64b5f6" inRange sub="NORMAL" />)
    expect(screen.getByText('NORMAL')).toHaveStyle({ color: '#4ade80' })
  })

  it('applies amber sub text when inRange is false', () => {
    wrap(<HealthStatusTile label="SpO₂" value={93} unit="%" accent="#64b5f6" inRange={false} sub="LOW" />)
    expect(screen.getByText('LOW')).toHaveStyle({ color: '#fbbf24' })
  })

  it('shows info overlay description when tapped with info prop', async () => {
    const user = userEvent.setup()
    wrap(
      <HealthStatusTile
        label="SpO₂" value={97} unit="%" accent="#64b5f6"
        info={{ description: 'Blood oxygen level' }}
      />
    )
    await user.click(screen.getByText('97'))
    expect(screen.getByText('Blood oxygen level')).toBeInTheDocument()
  })
})
