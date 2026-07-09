import fs from 'fs'
import path from 'path'

describe('Garmin poller — single canonical implementation', () => {
  it('does not have a stale duplicate under scripts/providers/garmin/', () => {
    const stalePath = path.join(process.cwd(), 'scripts', 'providers', 'garmin', 'poller.py')
    expect(fs.existsSync(stalePath)).toBe(false)
  })

  it('ROADMAP.md does not claim Garmin scripts were relocated to scripts/providers/garmin/', () => {
    const roadmap = fs.readFileSync(path.join(process.cwd(), 'docs', 'ROADMAP.md'), 'utf-8')
    expect(roadmap).not.toContain('Garmin scripts relocated to `scripts/providers/garmin/`')
  })
})
