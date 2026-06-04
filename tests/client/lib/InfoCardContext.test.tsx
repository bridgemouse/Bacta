import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderHook, act } from '@testing-library/react'
import { InfoCardProvider, useCardInfoOverlay } from '../../../client/src/lib/InfoCardContext'

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <InfoCardProvider>{children}</InfoCardProvider>
)

describe('useCardInfoOverlay', () => {
  it('is closed by default', () => {
    const { result } = renderHook(
      () => useCardInfoOverlay('id', { description: 'Test' }, '#2bc4e8'),
      { wrapper }
    )
    expect(result.current.isOpen).toBe(false)
  })

  it('is closed when info is undefined', () => {
    const { result } = renderHook(
      () => useCardInfoOverlay('id', undefined, '#2bc4e8'),
      { wrapper }
    )
    expect(result.current.isOpen).toBe(false)
  })

  it('handleTap does nothing when info is undefined', () => {
    const { result } = renderHook(
      () => useCardInfoOverlay('id', undefined, '#2bc4e8'),
      { wrapper }
    )
    act(() => result.current.handleTap({ stopPropagation: () => {} } as React.MouseEvent))
    expect(result.current.isOpen).toBe(false)
  })

  it('handleTap opens when info provided', () => {
    const { result } = renderHook(
      () => useCardInfoOverlay('id', { description: 'Test' }, '#2bc4e8'),
      { wrapper }
    )
    act(() => result.current.handleTap({ stopPropagation: () => {} } as React.MouseEvent))
    expect(result.current.isOpen).toBe(true)
  })

  it('handleTap closes when already open', () => {
    const { result } = renderHook(
      () => useCardInfoOverlay('id', { description: 'Test' }, '#2bc4e8'),
      { wrapper }
    )
    act(() => result.current.handleTap({ stopPropagation: () => {} } as React.MouseEvent))
    act(() => result.current.handleTap({ stopPropagation: () => {} } as React.MouseEvent))
    expect(result.current.isOpen).toBe(false)
  })
})

function TwoCards() {
  const h1 = useCardInfoOverlay('card-1', { description: 'Card 1' }, '#2bc4e8')
  const h2 = useCardInfoOverlay('card-2', { description: 'Card 2' }, '#2bc4e8')
  return (
    <div>
      <button onClick={h1.handleTap} data-testid="btn1">{h1.isOpen ? 'open' : 'closed'}</button>
      <button onClick={h2.handleTap} data-testid="btn2">{h2.isOpen ? 'open' : 'closed'}</button>
    </div>
  )
}

it('opening card-2 closes card-1', async () => {
  const user = userEvent.setup()
  render(<InfoCardProvider><TwoCards /></InfoCardProvider>)
  await user.click(screen.getByTestId('btn1'))
  expect(screen.getByTestId('btn1')).toHaveTextContent('open')
  await user.click(screen.getByTestId('btn2'))
  expect(screen.getByTestId('btn1')).toHaveTextContent('closed')
  expect(screen.getByTestId('btn2')).toHaveTextContent('open')
})
