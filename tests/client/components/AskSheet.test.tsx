import { render, screen, fireEvent } from '@testing-library/react'
import { vi, beforeEach } from 'vitest'
import { AskSheet } from '../../../client/src/components/AskSheet'

vi.mock('../../../client/src/hooks/useChat', () => ({
  useChat: vi.fn(() => ({
    messages: [],
    input: '',
    setInput: vi.fn(),
    streaming: false,
    submit: vi.fn(),
    sessionId: 'test-session',
    loadMessages: vi.fn(),
    clearVisualHistory: vi.fn(),
    hiddenBefore: null,
  })),
}))

function renderAsk(open: boolean, onClose = vi.fn(), section = 'home') {
  return render(<AskSheet open={open} onClose={onClose} accent="#2bc4e8" section={section} />)
}

describe('AskSheet', () => {
  beforeEach(() => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ skills: [] }),
    } as unknown as Response)
  })
  it('renders nothing when closed', () => {
    renderAsk(false)
    expect(screen.queryByText('MX-4')).not.toBeInTheDocument()
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
    expect(screen.getByPlaceholderText('Message MX-4')).toBeInTheDocument()
  })

  it('textarea has font-size 16 for iOS zoom prevention', () => {
    renderAsk(true)
    const textarea = screen.getByPlaceholderText('Message MX-4')
    expect(textarea).toHaveStyle({ fontSize: '16px' })
  })

  it('calls onClose when × button is clicked', () => {
    const onClose = vi.fn()
    renderAsk(true, onClose)
    fireEvent.click(screen.getByLabelText('Close'))
    expect(onClose).toHaveBeenCalled()
  })

  it('does not render CLEAR VIEW button when no messages', () => {
    renderAsk(true)
    expect(screen.queryByText('CLEAR VIEW ›')).not.toBeInTheDocument()
  })

  it('does not render skill carousel when skills are empty', async () => {
    renderAsk(true)
    expect(screen.queryByTestId('skill-carousel')).not.toBeInTheDocument()
  })

  it('renders skill carousel with pills when skills are returned', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        skills: [
          { label: 'SYNC WIKI', prompt: 'Review your wiki pages...' },
          { label: 'MORNING BRIEF', prompt: 'Give me a morning brief...' },
        ],
      }),
    } as unknown as Response)

    const { findByTestId } = renderAsk(true)
    const carousel = await findByTestId('skill-carousel')
    expect(carousel).toBeInTheDocument()
    const pills = await screen.findAllByTestId('skill-pill')
    expect(pills).toHaveLength(2)
    expect(pills[0]).toHaveTextContent('SYNC WIKI')
  })

  it('does not render carousel when fetch fails', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'))
    renderAsk(true)
    await new Promise(r => setTimeout(r, 10))
    expect(screen.queryByTestId('skill-carousel')).not.toBeInTheDocument()
  })
})
