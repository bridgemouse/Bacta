import { z } from 'zod'

export const BriefingResultSchema = z.object({
  tone:           z.enum(['POSITIVE', 'CAUTION', 'FLAG']),
  headline:       z.string(),
  summary:        z.string(),
  body:           z.string(),
  recommendation: z.string(),
  flags:          z.array(z.string()),
})

export type BriefingResult = z.infer<typeof BriefingResultSchema>

export interface SectionDef {
  id:             string
  name:           string
  metrics:        string[]
  includeManual:  boolean
  promptAddendum: string
}
