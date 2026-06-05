import { render, screen, fireEvent, waitForElementToBeRemoved } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AppShell } from '../../../client/src/components/AppShell'

function renderShell(section: 'home' | 'recovery' = 'home') {
  return render(
    <MemoryRouter initialEntries={[section === 'home' ? '/' : `/${section}`]}>
      <AppShell section={section}>
        <div data-testid="child">content</div>
      </AppShell>
    </MemoryRouter>
  )
}

describe('AppShell', () => {
  it('renders children in content area', () => {
    renderShell()
    expect(screen.getByTestId('child')).toBeInTheDocument()
  })

  it('renders BACTA·OS in home mode', () => {
    renderShell('home')
    expect(screen.getByText('BACTA')).toBeInTheDocument()
    expect(screen.getByText('·OS')).toBeInTheDocument()
  })

  it('renders section label in section mode', () => {
    renderShell('recovery')
    expect(screen.getByText('RECOVERY')).toBeInTheDocument()
  })

  it('renders ask button and nav button', () => {
    renderShell()
    expect(screen.getByTestId('ask-button')).toBeInTheDocument()
    expect(screen.getByTestId('nav-button')).toBeInTheDocument()
  })

  it('opens NavSheet when nav button is clicked', () => {
    renderShell()
    fireEvent.click(screen.getByTestId('nav-button'))
    expect(screen.getByText('ALL SYSTEMS')).toBeInTheDocument()
  })

  it('opens AskSheet when ask button is clicked', () => {
    renderShell()
    fireEvent.click(screen.getByTestId('ask-button'))
    expect(screen.getByText(/Standing by, Commander/)).toBeInTheDocument()
  })

  it('renders Overview and Trends tabs when hasTabs is true', () => {
    render(
      <MemoryRouter initialEntries={['/recovery']}>
        <AppShell section="recovery" hasTabs>
          <div>content</div>
        </AppShell>
      </MemoryRouter>
    )
    expect(screen.getByText('Overview')).toBeInTheDocument()
    expect(screen.getByText('Trends')).toBeInTheDocument()
  })

  it('closes NavSheet when backdrop is clicked', async () => {
    renderShell()
    fireEvent.click(screen.getByTestId('nav-button'))
    expect(screen.getByText('ALL SYSTEMS')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('sheet-backdrop'))
    await waitForElementToBeRemoved(() => screen.queryByText('ALL SYSTEMS'), { timeout: 1000 })
  })
})
