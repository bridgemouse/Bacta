import { render, screen, fireEvent } from '@testing-library/react'
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
})
