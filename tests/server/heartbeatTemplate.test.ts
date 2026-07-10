import fs from 'fs'
import path from 'path'

describe('HEARTBEAT.md.example — tone standing order', () => {
  it('includes the dry-wit-not-cheerfulness standing order (#111)', () => {
    const template = fs.readFileSync(
      path.join(process.cwd(), 'mx4', 'HEARTBEAT.md.example'),
      'utf-8'
    )

    expect(template).toContain('Dry wit, not cheerfulness')
  })
})
