import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HeadlineCard } from '../../../../client/src/components/viz/HeadlineCard'
import { InfoCardProvider } from '../../../../client/src/lib/InfoCardContext'

const wrap = (ui: React.ReactElement) => render(<InfoCardProvider>{ui}</InfoCardProvider>)

describe('HeadlineCard', () => {
  it('renders label', () => {
    wrap(<HeadlineCard accent="#64b5f6" label="Resting HR"><span>52</span></HeadlineCard>)
    expect(screen.getByText('Resting HR')).toBeInTheDocument()
  })

  it('renders children', () => {
    wrap(<HeadlineCard accent="#64b5f6" label="Resting HR"><span>52 bpm</span></HeadlineCard>)
    expect(screen.getByText('52 bpm')).toBeInTheDocument()
  })

  it('renders foot when provided', () => {
    wrap(
      <HeadlineCard accent="#64b5f6" label="Resting HR" foot={<span>foot content</span>}>
        <span>52</span>
      </HeadlineCard>
    )
    expect(screen.getByText('foot content')).toBeInTheDocument()
  })

  it('shows overlay description when tapped with info prop', async () => {
    const user = userEvent.setup()
    wrap(
      <HeadlineCard accent="#64b5f6" label="Resting HR"
        info={{ title: 'Resting Heart Rate', description: 'Heart efficiency metric', source: 'Garmin' }}>
        <span>52</span>
      </HeadlineCard>
    )
    await user.click(screen.getByText('52'))
    expect(screen.getByText('Heart efficiency metric')).toBeInTheDocument()
  })

  it('shows title in non-compact overlay', async () => {
    const user = userEvent.setup()
    wrap(
      <HeadlineCard accent="#64b5f6" label="Resting HR"
        info={{ title: 'Resting Heart Rate', description: 'Heart efficiency metric' }}>
        <span>52</span>
      </HeadlineCard>
    )
    await user.click(screen.getByText('52'))
    expect(screen.getByText('RESTING HEART RATE')).toBeInTheDocument()
  })

  it('does not show overlay without info prop', async () => {
    const user = userEvent.setup()
    wrap(
      <HeadlineCard accent="#64b5f6" label="Resting HR"><span>52</span></HeadlineCard>
    )
    await user.click(screen.getByText('52'))
    expect(screen.queryByRole('paragraph')).not.toBeInTheDocument()
  })
})
