import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest'

process.env.DB_PATH = ':memory:'

vi.mock('ai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('ai')>()
  return {
    ...actual,
    generateObject: vi.fn(),
  }
})

describe('estimateMealFromPhoto', () => {
  beforeAll(async () => {
    const { migrate } = await import('../../server/db/migrate')
    migrate()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns a macro estimate parsed from the vision model response, never auto-logging', async () => {
    const { generateObject } = await import('ai')
    vi.mocked(generateObject).mockResolvedValue({
      object: { name: 'Grilled chicken with rice', calories: 550, protein_g: 42, carbs_g: 60, fat_g: 12, fiber_g: 3 },
    } as any)

    const { estimateMealFromPhoto } = await import('../../server/lib/ai/mealPhoto')
    const result = await estimateMealFromPhoto('base64imagedata', 'image/jpeg')

    expect(result).toMatchObject({ name: 'Grilled chicken with rice', calories: 550, protein_g: 42 })
    // the vision call must have been given the actual photo, not a text-only prompt
    const call = vi.mocked(generateObject).mock.calls[0][0] as any
    const imagePart = call.messages[0].content.find((p: any) => p.type === 'image')
    expect(imagePart.image).toBe('base64imagedata')
  })

  it('degrades gracefully (returns an error, does not throw) when the vision model call fails', async () => {
    const { generateObject } = await import('ai')
    vi.mocked(generateObject).mockRejectedValue(new Error('model unavailable'))

    const { estimateMealFromPhoto } = await import('../../server/lib/ai/mealPhoto')
    const result = await estimateMealFromPhoto('base64imagedata', 'image/jpeg')

    expect('error' in result).toBe(true)
  })
})
