import { render, screen } from '@testing-library/react'
import { MetricTile } from '../../../client/src/components/MetricTile'

describe('MetricTile', () => {
  it('renders value and label', () => {
    render(<MetricTile value="74" label="Body Battery" accent="#64b5f6" />)
    expect(screen.getByText('74')).toBeInTheDocument()
    expect(screen.getByText('Body Battery')).toBeInTheDocument()
  })

  it('renders unit when provided', () => {
    render(<MetricTile value="61" unit="ms" label="HRV" accent="#a78bfa" />)
    expect(screen.getByText('ms')).toBeInTheDocument()
  })

  it('renders progress bar when progress prop is provided', () => {
    render(<MetricTile value="74" label="Body Battery" accent="#64b5f6" progress={0.74} />)
    expect(screen.getByTestId('metric-progress')).toBeInTheDocument()
  })

  it('renders trend when provided', () => {
    render(<MetricTile value="61" label="HRV" accent="#a78bfa" trend="↑ +4ms" />)
    expect(screen.getByText('↑ +4ms')).toBeInTheDocument()
  })
})
