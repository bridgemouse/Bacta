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
      // Backtick-wrapped, matching how the protocol actually references page names —
      // a bare substring check would pass for "correlations" even if its specific
      // reference here were missing, since the word already appears elsewhere in the
      // template as unrelated prose ("cross-domain correlations").
      expect(template).toContain(`\`${name}\``)
    }
  })
})

describe('HEARTBEAT.md.example — tone standing order', () => {
  it('includes the dry-wit-not-cheerfulness standing order (#111)', () => {
    const template = fs.readFileSync(
      path.join(process.cwd(), 'mx4', 'HEARTBEAT.md.example'),
      'utf-8'
    )

    expect(template).toContain('Dry wit, not cheerfulness')
  })
})
