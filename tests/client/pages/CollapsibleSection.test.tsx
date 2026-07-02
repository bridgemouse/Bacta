import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CollapsibleSection } from '../../../client/src/pages/SettingsPage'

describe('CollapsibleSection', () => {
  it('renders collapsed by default — label visible, content not', () => {
    render(
      <CollapsibleSection label="APPEARANCE" accent="#2bc4e8">
        <span>App icon picker</span>
      </CollapsibleSection>
    )
    expect(screen.getByText('APPEARANCE')).toBeInTheDocument()
    expect(screen.queryByText('App icon picker')).not.toBeInTheDocument()
  })

  it('expands content when the rail is tapped, and collapses again on a second tap', async () => {
    const user = userEvent.setup()
    render(
      <CollapsibleSection label="AI PROVIDER" accent="#2bc4e8">
        <span>Provider controls</span>
      </CollapsibleSection>
    )

    await user.click(screen.getByText('AI PROVIDER'))
    expect(screen.getByText('Provider controls')).toBeInTheDocument()

    await user.click(screen.getByText('AI PROVIDER'))
    expect(screen.queryByText('Provider controls')).not.toBeInTheDocument()
  })

  it('keeps each group\'s expand state independent — toggling one does not affect another', async () => {
    const user = userEvent.setup()
    render(
      <>
        <CollapsibleSection label="VAULT" accent="#2bc4e8">
          <span>Vault controls</span>
        </CollapsibleSection>
        <CollapsibleSection label="WEB SEARCH" accent="#2bc4e8">
          <span>Web search controls</span>
        </CollapsibleSection>
      </>
    )

    await user.click(screen.getByText('VAULT'))
    expect(screen.getByText('Vault controls')).toBeInTheDocument()
    expect(screen.queryByText('Web search controls')).not.toBeInTheDocument()

    await user.click(screen.getByText('WEB SEARCH'))
    expect(screen.getByText('Vault controls')).toBeInTheDocument()
    expect(screen.getByText('Web search controls')).toBeInTheDocument()
  })
})
