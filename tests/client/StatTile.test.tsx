// tests/client/StatTile.test.tsx
import { render, screen } from '@testing-library/react'
import { describe, test, expect } from 'vitest'
import { StatTile } from '../../client/src/components/StatTile'
import { StatGrid } from '../../client/src/components/StatGrid'
import type { GarminSummary } from '../../client/src/api'

describe('StatTile', () => {
  test('renders label, value, and unit', () => {
    render(<StatTile label="HRV" value={58} unit="ms" color="#60a5fa" />)
    expect(screen.getByText('HRV')).toBeInTheDocument()
    expect(screen.getByText('58')).toBeInTheDocument()
    expect(screen.getByText('ms')).toBeInTheDocument()
  })

  test('renders dash when value is undefined', () => {
    render(<StatTile label="VO2 MAX" value={undefined} color="#818cf8" />)
    expect(screen.getByText('—')).toBeInTheDocument()
  })
})

describe('StatGrid', () => {
  test('renders all 6 stat tiles', () => {
    const summary: GarminSummary = {
      recovery_score: 74,
      hrv: 58,
      sleep_duration: 432,
      body_battery: 62,
      stress_score: 28,
      vo2max: 52,
    }
    render(<StatGrid summary={summary} />)
    expect(screen.getByText('RECOVERY')).toBeInTheDocument()
    expect(screen.getByText('74')).toBeInTheDocument()
    expect(screen.getByText('HRV')).toBeInTheDocument()
    expect(screen.getByText('SLEEP')).toBeInTheDocument()
    // sleep_duration 432 minutes → 7.2h
    expect(screen.getByText('7.2h')).toBeInTheDocument()
  })
})
