// tests/client/TabBar.test.tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, test, expect, vi } from 'vitest'
import { TabBar } from '../../client/src/components/TabBar'
import type { TabId } from '../../client/src/components/TabBar'

describe('TabBar', () => {
  test('renders all 5 tab labels', () => {
    render(<TabBar active="home" onChange={vi.fn()} />)
    expect(screen.getByText('Home')).toBeInTheDocument()
    expect(screen.getByText('Recovery')).toBeInTheDocument()
    expect(screen.getByText('Sleep')).toBeInTheDocument()
    expect(screen.getByText('Training')).toBeInTheDocument()
    expect(screen.getByText('Fitness')).toBeInTheDocument()
  })

  test('calls onChange with correct tab id when clicked', async () => {
    const onChange = vi.fn()
    render(<TabBar active="home" onChange={onChange} />)
    await userEvent.click(screen.getByText('Recovery'))
    expect(onChange).toHaveBeenCalledWith('recovery')
  })

  test('active tab has blue colour class', () => {
    render(<TabBar active="sleep" onChange={vi.fn()} />)
    const sleepBtn = screen.getByText('Sleep').closest('button')
    expect(sleepBtn).toHaveClass('text-blue-400')
  })

  test('inactive tabs have grey colour class', () => {
    render(<TabBar active="home" onChange={vi.fn()} />)
    const recoveryBtn = screen.getByText('Recovery').closest('button')
    expect(recoveryBtn).toHaveClass('text-gray-500')
  })
})
