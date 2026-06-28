import { describe, it, expect } from 'vitest'
import { resolveSource } from '../../server/lib/integrations/shared/sourceResolver'

describe('resolveSource', () => {
  const rows = [
    { source: 'garmin', value: 45 },
    { source: 'oura',   value: 48 },
    { source: 'polar',  value: 44 },
  ]

  it('returns the highest-priority source that has a row', () => {
    expect(resolveSource(rows, ['oura', 'garmin', 'polar'])).toEqual({ source: 'oura', value: 48 })
  })

  it('falls through to next priority if first is not present', () => {
    expect(resolveSource(rows, ['whoop', 'polar', 'garmin'])).toEqual({ source: 'polar', value: 44 })
  })

  it('falls back to first row if no priority matches', () => {
    expect(resolveSource(rows, ['withings', 'strava'])).toEqual({ source: 'garmin', value: 45 })
  })

  it('returns the only row when given a single-element array', () => {
    expect(resolveSource([{ source: 'garmin', value: 55 }], ['garmin'])).toEqual({ source: 'garmin', value: 55 })
  })
})
