import { useEffect } from 'react'
import { render } from '@testing-library/react'
import { FadeValue } from '../../../../client/src/components/primitives/FadeValue'

function ProbeChild({ onMount }: { onMount: () => void }) {
  useEffect(() => { onMount() }, [])
  return <span>content</span>
}

describe('FadeValue', () => {
  it('does not remount its content when the value is unchanged', () => {
    const onMount = vi.fn()
    const { rerender } = render(
      <FadeValue value="10"><ProbeChild onMount={onMount} /></FadeValue>
    )
    expect(onMount).toHaveBeenCalledTimes(1)

    rerender(<FadeValue value="10"><ProbeChild onMount={onMount} /></FadeValue>)
    expect(onMount).toHaveBeenCalledTimes(1)
  })

  it('remounts its content to restart the fade animation when the value changes', () => {
    const onMount = vi.fn()
    const { rerender } = render(
      <FadeValue value="10"><ProbeChild onMount={onMount} /></FadeValue>
    )
    expect(onMount).toHaveBeenCalledTimes(1)

    rerender(<FadeValue value="20"><ProbeChild onMount={onMount} /></FadeValue>)
    expect(onMount).toHaveBeenCalledTimes(2)
  })

  it('applies the valueFadeIn keyframe animation', () => {
    const { container } = render(
      <FadeValue value="10"><span>10</span></FadeValue>
    )
    const wrapper = container.firstElementChild as HTMLElement
    expect(wrapper.style.animation).toContain('valueFadeIn')
  })
})
