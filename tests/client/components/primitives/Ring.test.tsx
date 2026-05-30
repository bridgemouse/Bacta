import { render } from '@testing-library/react'
import { Ring } from '../../../../client/src/components/primitives/Ring'

describe('Ring', () => {
  it('renders an svg element', () => {
    const { container } = render(<Ring progress={0.75} accent="#7c9af8" />)
    expect(container.querySelector('svg')).toBeInTheDocument()
  })

  it('renders children inside the ring', () => {
    const { getByText } = render(
      <Ring progress={0.5} accent="#7c9af8">
        <span>82</span>
      </Ring>
    )
    expect(getByText('82')).toBeInTheDocument()
  })

  it('applies the size prop', () => {
    const { container } = render(<Ring progress={0.5} accent="#7c9af8" size={60} />)
    const svg = container.querySelector('svg')!
    expect(svg.getAttribute('width')).toBe('60')
  })
})
