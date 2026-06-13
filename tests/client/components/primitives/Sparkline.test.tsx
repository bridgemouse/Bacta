import { render } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { Sparkline } from '../../../../client/src/components/primitives/Sparkline'

describe('Sparkline', () => {
  it('renders without crashing with empty data', () => {
    const { container } = render(<Sparkline data={[]} accent="#2bc4e8" />)
    expect(container.querySelector('svg')).toBeTruthy()
  })

  it('renders a line path with data', () => {
    const { container } = render(<Sparkline data={[10, 20, 15, 25]} accent="#2bc4e8" />)
    const paths = container.querySelectorAll('path')
    expect(paths.length).toBeGreaterThan(0)
  })

  it('renders avg dashed line when avgLine is provided', () => {
    const { container } = render(
      <Sparkline data={[10, 20, 15, 25]} accent="#2bc4e8" avgLine={17} />
    )
    const lines = container.querySelectorAll('line')
    expect(lines.length).toBe(1)
    expect(lines[0].getAttribute('stroke-dasharray')).toBe('3 3')
  })

  it('does not render avg line when avgLine is undefined', () => {
    const { container } = render(<Sparkline data={[10, 20, 15, 25]} accent="#2bc4e8" />)
    expect(container.querySelectorAll('line').length).toBe(0)
  })

  it('clamps avgLine below min to min position', () => {
    const { container } = render(
      <Sparkline data={[10, 20]} accent="#2bc4e8" avgLine={0} h={30} />
    )
    const line = container.querySelector('line')
    expect(line).toBeTruthy()
    const y = Number(line!.getAttribute('y1'))
    expect(y).toBeGreaterThan(20) // near bottom of 30px chart
  })
})
