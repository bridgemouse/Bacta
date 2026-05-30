import { render, screen, fireEvent } from '@testing-library/react'
import { BottomBar } from '../../../client/src/components/BottomBar'

describe('BactaDock (BottomBar)', () => {
  it('renders the Ask MX-4 button', () => {
    render(<BottomBar accent="#2bc4e8" onAsk={vi.fn()} onNav={vi.fn()} />)
    expect(screen.getByTestId('ask-button')).toBeInTheDocument()
  })

  it('renders the nav button', () => {
    render(<BottomBar accent="#2bc4e8" onAsk={vi.fn()} onNav={vi.fn()} />)
    expect(screen.getByTestId('nav-button')).toBeInTheDocument()
  })

  it('calls onAsk when Ask button is clicked', () => {
    const onAsk = vi.fn()
    render(<BottomBar accent="#2bc4e8" onAsk={onAsk} onNav={vi.fn()} />)
    fireEvent.click(screen.getByTestId('ask-button'))
    expect(onAsk).toHaveBeenCalled()
  })

  it('calls onNav when nav button is clicked', () => {
    const onNav = vi.fn()
    render(<BottomBar accent="#2bc4e8" onAsk={vi.fn()} onNav={onNav} />)
    fireEvent.click(screen.getByTestId('nav-button'))
    expect(onNav).toHaveBeenCalled()
  })

  it('renders Ask MX-4 label text', () => {
    render(<BottomBar accent="#2bc4e8" onAsk={vi.fn()} onNav={vi.fn()} />)
    expect(screen.getByText('Ask MX-4')).toBeInTheDocument()
  })
})
