import { describe, it, expect } from 'vitest'
import { SECTIONS } from '../../server/lib/ai/sections'

describe('SECTIONS', () => {
  it('defines exactly four sections in the correct run order', () => {
    const ids = SECTIONS.map(s => s.id)
    expect(ids).toEqual(['recovery', 'sleep', 'training', 'home'])
  })

  it('home section runs last', () => {
    expect(SECTIONS[SECTIONS.length - 1].id).toBe('home')
  })

  it('each non-home section has at least one metric', () => {
    for (const s of SECTIONS.filter(s => s.id !== 'home')) {
      expect(s.metrics.length).toBeGreaterThan(0)
    }
  })

  it('home section has empty metrics array (reads from mx4_briefings instead)', () => {
    const home = SECTIONS.find(s => s.id === 'home')!
    expect(home.metrics).toEqual([])
  })

  it('uses corrected metric names (no stale Python names)', () => {
    const allMetrics = SECTIONS.flatMap(s => s.metrics)
    expect(allMetrics).not.toContain('hrv_5min_high')
    expect(allMetrics).not.toContain('recovery_time_hours')
    expect(allMetrics).not.toContain('stress_score')
    expect(allMetrics).not.toContain('body_battery')
    expect(allMetrics).toContain('hrv_baseline_high')
    expect(allMetrics).toContain('recovery_time_h')
    expect(allMetrics).toContain('stress_avg')
  })

  it('each section has a non-empty promptAddendum without "patient" language', () => {
    for (const s of SECTIONS) {
      expect(s.promptAddendum.length).toBeGreaterThan(20)
      expect(s.promptAddendum.toLowerCase()).not.toContain('patient')
    }
  })

  it('home promptAddendum instructs querying mx4_briefings', () => {
    const home = SECTIONS.find(s => s.id === 'home')!
    expect(home.promptAddendum).toContain('mx4_briefings')
    expect(home.promptAddendum).toContain("section IN ('recovery', 'sleep', 'training')")
  })
})
