import { computeHypnoAxisLabels } from '../../../client/src/lib/hypnoLabels'

describe('computeHypnoAxisLabels', () => {
  it('returns the fallback labels when start/end are missing', () => {
    expect(computeHypnoAxisLabels(null, null)).toEqual(['23:00', '01:00', '03:00', '05:00', '07:00'])
  })

  it('reads the wall-clock time baked into Garmin\'s fake-UTC epoch, not the browser-local time', () => {
    // Garmin's sleepStartTimestampLocal encodes true wall-clock 22:16 as if
    // it were a UTC epoch (Date.UTC with the true local hour/minute).
    const startLocal = Date.UTC(2026, 5, 29, 22, 16, 50)
    const endLocal = Date.UTC(2026, 5, 30, 5, 53, 50)

    const labels = computeHypnoAxisLabels(startLocal, endLocal)

    expect(labels[0]).toBe('22:16')
  })
})
