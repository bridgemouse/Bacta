import { render } from '@testing-library/react'
import { Sparkline } from '../../../../client/src/components/primitives/Sparkline'

describe('Sparkline', () => {
  it('renders an svg element', () => {
    const { container } = render(<Sparkline data={[1, 2, 3, 4, 5]} accent="#7c9af8" />)
    expect(container.querySelector('svg')).toBeInTheDocument()
  })

  it('renders without crashing with single data point', () => {
    const { container } = render(<Sparkline data={[42]} accent="#7c9af8" />)
    expect(container.querySelector('svg')).toBeInTheDocument()
  })

  it('renders without crashing with empty data', () => {
    const { container } = render(<Sparkline data={[]} accent="#7c9af8" />)
    expect(container.querySelector('svg')).toBeInTheDocument()
  })
})
