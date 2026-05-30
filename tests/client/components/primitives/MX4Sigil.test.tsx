import { render, screen } from '@testing-library/react'
import { MX4Sigil } from '../../../../client/src/components/primitives/MX4Sigil'

describe('MX4Sigil', () => {
  it('renders an SVG element', () => {
    const { container } = render(<MX4Sigil color="#2bc4e8" />)
    expect(container.querySelector('svg')).toBeInTheDocument()
  })

  it('renders all 6 moods without crashing', () => {
    const moods = ['transmit', 'idle', 'listen', 'think', 'alert', 'pleased'] as const
    for (const mood of moods) {
      const { container } = render(<MX4Sigil color="#2bc4e8" mood={mood} />)
      expect(container.querySelector('svg')).toBeInTheDocument()
    }
  })

  it('applies size as width and height on the svg', () => {
    const { container } = render(<MX4Sigil color="#2bc4e8" size={24} />)
    const svg = container.querySelector('svg')!
    expect(svg.getAttribute('width')).toBe('24')
    expect(svg.getAttribute('height')).toBe('24')
  })

  it('renders with spin and glow props without crashing', () => {
    const { container } = render(<MX4Sigil color="#2bc4e8" spin glow mood="transmit" />)
    expect(container.querySelector('svg')).toBeInTheDocument()
  })
})
