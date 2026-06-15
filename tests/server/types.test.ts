import { describe, it, expect } from 'vitest'
import { BriefingResultSchema } from '../../server/lib/ai/types'

describe('BriefingResultSchema', () => {
  it('parses a valid briefing result', () => {
    const result = BriefingResultSchema.parse({
      tone: 'POSITIVE',
      headline: 'HRV elevated above baseline.',
      summary: 'HRV is up. Recovery looks solid.',
      body: 'Detailed analysis here.',
      recommendation: 'Proceed with hard session.',
      flags: [],
    })
    expect(result.tone).toBe('POSITIVE')
    expect(result.flags).toEqual([])
  })

  it('rejects unknown tone values', () => {
    expect(() => BriefingResultSchema.parse({
      tone: 'GREAT',
      headline: 'x', summary: 'x', body: 'x', recommendation: 'x', flags: [],
    })).toThrow()
  })

  it('accepts all three tone values', () => {
    for (const tone of ['POSITIVE', 'CAUTION', 'FLAG'] as const) {
      expect(() => BriefingResultSchema.parse({
        tone, headline: 'x', summary: 'x', body: 'x', recommendation: 'x', flags: [],
      })).not.toThrow()
    }
  })
})
