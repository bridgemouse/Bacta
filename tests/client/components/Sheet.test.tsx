import { render, screen, fireEvent, act } from '@testing-library/react'
import { Sheet, SheetShell } from '../../../client/src/components/Sheet'

function renderSheet(onClose: () => void) {
  return render(
    <Sheet open onClose={onClose}>
      <SheetShell accent="#2bc4e8" onClose={onClose}>
        <div>content</div>
      </SheetShell>
    </Sheet>
  )
}

describe('Sheet — portaled font inheritance', () => {
  it('re-declares the Hanken Grotesk font-family on the portaled backdrop', () => {
    // Sheet portals its content to document.body (to escape AppShell's z-index
    // stacking context — see the comment in Sheet.tsx), which means it no longer
    // inherits AppShell root's inline fontFamily. Without redeclaring it here,
    // every Sheet consumer (BottomSheet, AskSheet, and every nutrition sheet)
    // would silently fall back to the browser's default system-font stack.
    const onClose = vi.fn()
    renderSheet(onClose)
    const backdrop = screen.getByTestId('sheet-backdrop')
    expect(backdrop.style.fontFamily).toContain('Hanken Grotesk')
  })
})

describe('Sheet — Escape key', () => {
  it('calls onClose when Escape is pressed while open', () => {
    const onClose = vi.fn()
    renderSheet(onClose)

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(onClose).toHaveBeenCalledOnce()
  })
})

describe('SheetShell drag-to-dismiss', () => {
  it('calls onClose when the drag handle is dragged down past the threshold', () => {
    const onClose = vi.fn()
    renderSheet(onClose)
    const handle = screen.getByTestId('sheet-drag-handle')

    fireEvent.pointerDown(handle, { clientY: 0, pointerId: 1 })
    fireEvent.pointerMove(handle, { clientY: 120, pointerId: 1 })
    fireEvent.pointerUp(handle, { clientY: 120, pointerId: 1 })

    expect(onClose).toHaveBeenCalledOnce()
  })

  it('does not call onClose when the drag handle is dragged below the threshold', () => {
    const onClose = vi.fn()
    renderSheet(onClose)
    const handle = screen.getByTestId('sheet-drag-handle')

    fireEvent.pointerDown(handle, { clientY: 0, pointerId: 1 })
    fireEvent.pointerMove(handle, { clientY: 20, pointerId: 1 })
    fireEvent.pointerUp(handle, { clientY: 20, pointerId: 1 })

    expect(onClose).not.toHaveBeenCalled()
  })

  it('does not call onClose for upward drag', () => {
    const onClose = vi.fn()
    renderSheet(onClose)
    const handle = screen.getByTestId('sheet-drag-handle')

    fireEvent.pointerDown(handle, { clientY: 100, pointerId: 1 })
    fireEvent.pointerMove(handle, { clientY: 0, pointerId: 1 })
    fireEvent.pointerUp(handle, { clientY: 0, pointerId: 1 })

    expect(onClose).not.toHaveBeenCalled()
  })

  it('clears the drag offset after dismissing so a quick reopen renders fully open', () => {
    // Bug: Sheet only unmounts SheetShell ~340ms after close. A rapid
    // close-then-reopen within that window previously kept rendering with
    // the stale dragged-down offset instead of translateY(0).
    vi.useFakeTimers()
    const onClose = vi.fn()
    renderSheet(onClose)
    const handle = screen.getByTestId('sheet-drag-handle')
    const shell = handle.parentElement as HTMLElement

    fireEvent.pointerDown(handle, { clientY: 0, pointerId: 1 })
    fireEvent.pointerMove(handle, { clientY: 120, pointerId: 1 })
    fireEvent.pointerUp(handle, { clientY: 120, pointerId: 1 })

    expect(onClose).toHaveBeenCalledOnce()
    expect(shell.style.transform).toBe('translateY(120px)')

    act(() => {
      vi.advanceTimersByTime(300)
    })

    expect(shell.style.transform).toBe('translateY(0px)')
    vi.useRealTimers()
  })
})
