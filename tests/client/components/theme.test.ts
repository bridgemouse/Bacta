import { COLORS, SECTION_ACCENTS, SECTION_LABELS, SECTION_ICONS } from '../../../client/src/theme'
import type { SectionKey } from '../../../client/src/theme'

const SECTIONS: SectionKey[] = ['home', 'recovery', 'training', 'sleep', 'nutrition', 'bloodwork', 'dailylog']

describe('theme tokens', () => {
  it('exports a base background color', () => {
    expect(COLORS.base).toBe('#0f1117')
  })

  it('exports section accent colors for all seven sections', () => {
    SECTIONS.forEach(s => {
      expect(SECTION_ACCENTS[s]).toBeDefined()
      expect(SECTION_ACCENTS[s]).toMatch(/^#[0-9a-fA-F]{6}$/)
    })
  })

  it('exports section labels for all seven sections', () => {
    SECTIONS.forEach(s => {
      expect(SECTION_LABELS[s]).toBeDefined()
      expect(typeof SECTION_LABELS[s]).toBe('string')
    })
  })

  it('exports section icons for all seven sections', () => {
    SECTIONS.forEach(s => {
      expect(SECTION_ICONS[s]).toBeDefined()
      expect(typeof SECTION_ICONS[s]).toBe('string')
    })
  })
})
