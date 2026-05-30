import { render, screen, fireEvent } from '@testing-library/react'
import { AskSheet } from '../../../client/src/components/AskSheet'

function renderAsk(open: boolean, onClose = vi.fn()) {
  return render(<AskSheet open={open} onClose={onClose} accent="#2bc4e8" />)
}

describe('AskSheet', () => {
  it('renders nothing when closed', () => {
    renderAsk(false)
    expect(screen.queryByTestId('sheet-backdrop')).not.toBeInTheDocument()
  })

  it('renders MX-4 header when open', () => {
    renderAsk(true)
    expect(screen.getByText('MX-4')).toBeInTheDocument()
  })

  it('renders the greeting text', () => {
    renderAsk(true)
    expect(screen.getByText(/Standing by, Commander/)).toBeInTheDocument()
  })

  it('renders 4 suggested prompts', () => {
    renderAsk(true)
    expect(screen.getByText('How is my recovery trending?')).toBeInTheDocument()
    expect(screen.getByText("Plan today's training")).toBeInTheDocument()
    expect(screen.getByText('Why is my HRV up?')).toBeInTheDocument()
    expect(screen.getByText('Summarize my week')).toBeInTheDocument()
  })

  it('renders the input placeholder', () => {
    renderAsk(true)
    expect(screen.getByText('Message MX-4')).toBeInTheDocument()
  })

  it('calls onClose when × button is clicked', () => {
    const onClose = vi.fn()
    renderAsk(true, onClose)
    fireEvent.click(screen.getByLabelText('Close'))
    expect(onClose).toHaveBeenCalled()
  })
})
