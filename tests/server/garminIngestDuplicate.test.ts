import fs from 'fs'
import path from 'path'

describe('Garmin ingest — single canonical implementation', () => {
  it('does not have a stale duplicate under scripts/providers/garmin/', () => {
    const stalePath = path.join(process.cwd(), 'scripts', 'providers', 'garmin', 'ingest.py')
    expect(fs.existsSync(stalePath)).toBe(false)
  })
})
