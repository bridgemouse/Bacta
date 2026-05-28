import { COLORS, SECTION_ACCENTS } from '../../../client/src/theme'

describe('theme tokens', () => {
  it('exports a base background color', () => {
    expect(COLORS.base).toBe('#0f1117')
  })

  it('exports section accent colors for all seven sections', () => {
    const sections = ['home', 'recovery', 'training', 'sleep', 'nutrition', 'bloodwork', 'dailylog']
    sections.forEach(s => {
      expect(SECTION_ACCENTS[s]).toBeDefined()
      expect(SECTION_ACCENTS[s]).toMatch(/^#[0-9a-fA-F]{6}$/)
    })
  })
})
