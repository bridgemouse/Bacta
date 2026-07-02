const FALLBACK_LABELS = ['23:00', '01:00', '03:00', '05:00', '07:00']

// Garmin's sleepStartTimestampLocal/sleepEndTimestampLocal are epoch-ms
// numbers using a "fake UTC" trick: the wall-clock local time is encoded as
// if it were a UTC epoch. Reading them with the browser's local getters
// (getHours/getMinutes) double-applies a timezone offset on top of the one
// already baked in by Garmin — use the UTC getters to read the intended
// wall-clock value as-is.
export function computeHypnoAxisLabels(startLocal: number | null, endLocal: number | null): string[] {
  if (startLocal == null || endLocal == null) return FALLBACK_LABELS

  return [0, 1, 2, 3, 4].map(i => {
    const ms = startLocal + (i / 4) * (endLocal - startLocal)
    const d = new Date(ms)
    return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`
  })
}
