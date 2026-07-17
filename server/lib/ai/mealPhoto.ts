import { generateObject } from 'ai'
import { z } from 'zod'
import { getModel } from './provider'

// Photo-based meal recognition (#141) — a still-image capture (native camera, not
// live in-page video, see NUTRITION UI's <input capture>), sent to the same
// vision-capable model already configured for MX-4 chat/briefings. Returns a proposed
// estimate only — the caller (POST /api/nutrition/scan/meal-photo) never writes to
// food_log_entries itself; the user must review/edit and explicitly log it via the
// normal POST /log flow, same as any other ad-hoc entry.
const mealEstimateSchema = z.object({
  name: z.string().describe('A short description of the meal, e.g. "Grilled chicken with rice and broccoli"'),
  calories: z.number().nullable().describe('Estimated total calories, or null if impossible to estimate'),
  protein_g: z.number().nullable(),
  carbs_g: z.number().nullable(),
  fat_g: z.number().nullable(),
  fiber_g: z.number().nullable(),
})

export interface MealPhotoEstimate {
  name: string
  calories: number | null
  protein_g: number | null
  carbs_g: number | null
  fat_g: number | null
  fiber_g: number | null
}

export async function estimateMealFromPhoto(
  imageBase64: string,
  mediaType: string
): Promise<MealPhotoEstimate | { error: string }> {
  try {
    const { object } = await generateObject({
      model: getModel('chat'),
      schema: mealEstimateSchema,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Estimate the nutritional content of the meal in this photo. Be conservative and realistic — this is a rough estimate the user will review and correct, not a precise measurement. If you genuinely cannot tell, use null for that field rather than guessing wildly.',
            },
            { type: 'image', image: imageBase64, mediaType },
          ],
        },
      ],
    })
    return object
  } catch (err: unknown) {
    console.error('[nutrition] meal photo estimate failed:', err)
    return { error: err instanceof Error ? err.message : 'Could not estimate meal from photo' }
  }
}
