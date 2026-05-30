import { render } from '@testing-library/react'
import { Sigil } from '../../../../client/src/components/primitives/Sigil'
import type { SectionKey } from '../../../../client/src/theme'

describe('Sigil', () => {
  const sections: Exclude<SectionKey, 'home'>[] = [
    'recovery', 'training', 'sleep', 'nutrition', 'bloodwork', 'dailylog',
  ]

  it.each(sections)('renders %s sigil without crashing', (section) => {
    const { container } = render(<Sigil name={section} color="#7c9af8" />)
    expect(container.querySelector('svg')).toBeInTheDocument()
  })

  it('applies size as width and height', () => {
    const { container } = render(<Sigil name="recovery" color="#7c9af8" size={20} />)
    const svg = container.querySelector('svg')!
    expect(svg.getAttribute('width')).toBe('20')
    expect(svg.getAttribute('height')).toBe('20')
  })
})
