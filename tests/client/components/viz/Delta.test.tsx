import { render } from '@testing-library/react'
import { Delta } from '../../../../client/src/components/viz/Delta'

describe('Delta', () => {
  it('renders ±0 for zero', () => {
    const { container } = render(<Delta value={0} />)
    expect(container.textContent).toContain('±0')
  })

  it('renders ±0 for null', () => {
    const { container } = render(<Delta value={null} />)
    expect(container.textContent).toContain('±0')
  })

  it('rounds float to 1 decimal', () => {
    const { container } = render(<Delta value={-0.6999} />)
    expect(container.textContent).toContain('0.7')
    expect(container.textContent).not.toContain('0.6999')
  })

  it('drops trailing zero for whole numbers', () => {
    const { container } = render(<Delta value={1.0} />)
    expect(container.textContent).toContain('1')
    expect(container.textContent).not.toContain('1.0')
  })

  it('renders positive value with up arrow', () => {
    const { container } = render(<Delta value={5} />)
    expect(container.textContent).toContain('▲')
    expect(container.textContent).toContain('5')
  })
})
