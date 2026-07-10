import fs from 'fs'
import path from 'path'
import { PATTERN_PAGES } from '../../server/lib/ai/wiki'

describe('HEARTBEAT.md.example — Wiki Management Protocol page naming', () => {
  it('references the real pre-seeded stub page names, not invented examples that don\'t exist', () => {
    // #126: the protocol's example names (hrv-baseline, sleep-architecture) didn't match
    // the actual pre-seeded stub filenames, leaving MX-4 with no clear target page for
    // a new finding — this asserts the template stays in sync with the real stub names.
    const template = fs.readFileSync(
      path.join(process.cwd(), 'mx4', 'HEARTBEAT.md.example'),
      'utf-8'
    )

    for (const name of Object.keys(PATTERN_PAGES)) {
      expect(template).toContain(name)
    }
  })
})
