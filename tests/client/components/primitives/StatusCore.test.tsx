import { render } from '@testing-library/react'
import { StatusCore } from '../../../../client/src/components/primitives/StatusCore'

describe('StatusCore', () => {
  it('renders without crashing', () => {
    const { container } = render(<StatusCore accent="#4ade80" />)
    expect(container.firstChild).toBeInTheDocument()
  })

  it('renders with active=false without crashing', () => {
    const { container } = render(<StatusCore accent="#4ade80" active={false} />)
    expect(container.firstChild).toBeInTheDocument()
  })
})
