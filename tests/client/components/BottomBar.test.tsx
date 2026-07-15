import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BottomBar } from '../../../client/src/components/BottomBar'
import { TabContext } from '../../../client/src/lib/TabContext'

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

  it('renders Overview and Trends buttons when hasTabs is true', () => {
    render(
      <TabContext.Provider value={{ tab: 'overview', setTab: vi.fn() }}>
        <BottomBar accent="#2bc4e8" hasTabs onAsk={vi.fn()} onNav={vi.fn()} />
      </TabContext.Provider>
    )
    expect(screen.getByText('Overview')).toBeInTheDocument()
    expect(screen.getByText('Trends')).toBeInTheDocument()
  })

  it('does not render tab buttons when hasTabs is false', () => {
    render(
      <TabContext.Provider value={{ tab: 'overview', setTab: vi.fn() }}>
        <BottomBar accent="#2bc4e8" hasTabs={false} onAsk={vi.fn()} onNav={vi.fn()} />
      </TabContext.Provider>
    )
    expect(screen.queryByText('Overview')).not.toBeInTheDocument()
    expect(screen.queryByText('Trends')).not.toBeInTheDocument()
  })

  it('clicking Trends calls setTab from context', async () => {
    const user = userEvent.setup()
    const setTab = vi.fn()
    render(
      <TabContext.Provider value={{ tab: 'overview', setTab }}>
        <BottomBar accent="#2bc4e8" hasTabs onAsk={vi.fn()} onNav={vi.fn()} />
      </TabContext.Provider>
    )
    await user.click(screen.getByText('Trends'))
    expect(setTab).toHaveBeenCalledWith('trends')
  })

  it('renders a custom tab pair (Overview/Library) when tabs prop is provided', () => {
    render(
      <TabContext.Provider value={{ tab: 'overview', setTab: vi.fn() }}>
        <BottomBar accent="#3ecf8e" hasTabs tabs={['overview', 'library']} onAsk={vi.fn()} onNav={vi.fn()} />
      </TabContext.Provider>
    )
    expect(screen.getByText('Library')).toBeInTheDocument()
    expect(screen.queryByText('Trends')).not.toBeInTheDocument()
  })

  it('clicking Library calls setTab with library', async () => {
    const user = userEvent.setup()
    const setTab = vi.fn()
    render(
      <TabContext.Provider value={{ tab: 'overview', setTab }}>
        <BottomBar accent="#3ecf8e" hasTabs tabs={['overview', 'library']} onAsk={vi.fn()} onNav={vi.fn()} />
      </TabContext.Provider>
    )
    await user.click(screen.getByText('Library'))
    expect(setTab).toHaveBeenCalledWith('library')
  })
})
