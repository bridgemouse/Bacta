import { render, screen, fireEvent, act, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
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

// Mirrors the real app's shape: main.tsx mounts everything under #root, and Sheet
// portals to document.body (outside #root) — so #root is exactly the "background"
// this issue wants marked inert while a sheet covers it.
function ToggleHarness() {
  const [open, setOpen] = useState(false)
  return (
    <div id="root">
      <button onClick={() => setOpen(true)}>Open Sheet</button>
      <Sheet open={open} onClose={() => setOpen(false)}>
        <SheetShell accent="#2bc4e8" onClose={() => setOpen(false)}>
          <button>Inside action</button>
        </SheetShell>
      </Sheet>
    </div>
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

describe('Sheet — focus management (#187)', () => {
  it('moves focus to an element inside the sheet when it opens', async () => {
    const user = userEvent.setup()
    render(<ToggleHarness />)
    await user.click(screen.getByText('Open Sheet'))
    await waitFor(() => expect(document.activeElement?.textContent).toBe('Inside action'))
  })

  it('returns focus to the trigger element when the sheet closes', async () => {
    const user = userEvent.setup()
    render(<ToggleHarness />)
    const trigger = screen.getByText('Open Sheet')
    await user.click(trigger)
    await waitFor(() => expect(document.activeElement).not.toBe(trigger))

    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => expect(document.activeElement).toBe(trigger))
  })

  it('marks #root inert while the sheet is open, and clears it on close', async () => {
    const user = userEvent.setup()
    render(<ToggleHarness />)
    const root = document.getElementById('root')!
    expect(root.hasAttribute('inert')).toBe(false)

    await user.click(screen.getByText('Open Sheet'))
    await waitFor(() => expect(root.hasAttribute('inert')).toBe(true))

    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => expect(root.hasAttribute('inert')).toBe(false))
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
