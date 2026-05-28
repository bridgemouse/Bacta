import { render, screen, fireEvent } from '@testing-library/react'
import { SubNav } from '../../../client/src/components/SubNav'

const tabs = ['Overview', 'HRV', 'Body Battery', 'Stress']

describe('SubNav', () => {
  it('renders all tab labels', () => {
    render(<SubNav tabs={tabs} active="Overview" accent="#64b5f6" onChange={() => {}} />)
    tabs.forEach(t => expect(screen.getByText(t)).toBeInTheDocument())
  })

  it('marks the active tab', () => {
    render(<SubNav tabs={tabs} active="HRV" accent="#64b5f6" onChange={() => {}} />)
    expect(screen.getByText('HRV').closest('[data-active="true"]')).toBeInTheDocument()
  })

  it('calls onChange when a tab is clicked', () => {
    const onChange = vi.fn()
    render(<SubNav tabs={tabs} active="Overview" accent="#64b5f6" onChange={onChange} />)
    fireEvent.click(screen.getByText('HRV'))
    expect(onChange).toHaveBeenCalledWith('HRV')
  })
})
