import { Router } from 'express'
import db from '../db/client'

const insightsRouter = Router()

const VALID_SECTIONS = ['home', 'recovery', 'training', 'sleep', 'nutrition', 'bloodwork', 'dailylog']

const STUB_BRIEFINGS: Record<string, object> = {
  home: {
    tone: 'POSITIVE',
    headline: 'Systems nominal. MX-4 standing by.',
    body: 'Recovery is charged. Training is on track. MX-4 has not yet generated a live briefing for this section.',
    recommendation: 'Configure an AI provider in Settings to enable live briefings.',
    flags: [],
  },
  recovery: {
    tone: 'POSITIVE',
    headline: 'HRV up 4ms. Body battery at 74.',
    body: 'Recovery metrics are within normal range. No live briefing has been generated yet — configure an AI provider in Settings.',
    recommendation: 'Run the orchestrator to generate a live assessment.',
    flags: [],
  },
  training: {
    tone: 'POSITIVE',
    headline: 'Training load moderate. VO2 trajectory on target.',
    body: 'Training status nominal. No live briefing has been generated yet — configure an AI provider in Settings.',
    recommendation: 'Run the orchestrator to generate a live assessment.',
    flags: [],
  },
  sleep: {
    tone: 'CAUTION',
    headline: 'Sleep score 82. Architecture review pending.',
    body: 'Sleep data is available but no live briefing has been generated yet — configure an AI provider in Settings.',
    recommendation: 'Run the orchestrator to generate a live assessment.',
    flags: [],
  },
  nutrition: {
    tone: 'CAUTION',
    headline: 'Nutrition channel online. Architecture review pending.',
    body: 'Logging is available but no live briefing has been generated yet — configure an AI provider in Settings.',
    recommendation: 'Run the orchestrator to generate a live assessment.',
    flags: [],
  },
  bloodwork: {
    tone: 'CAUTION',
    headline: 'No lab panels uploaded.',
    body: 'Blood work section is ready but no panels have been uploaded yet.',
    recommendation: 'Upload lab results when available.',
    flags: [],
  },
  dailylog: {
    tone: 'POSITIVE',
    headline: 'Daily log ready.',
    body: 'Daily log section is ready.',
    recommendation: 'Start logging daily inputs.',
    flags: [],
  },
}

// MX-4's own generated JSON is trusted at write time but not re-validated at read time —
// a shape drift (model output change, partial write) would otherwise pass a valid-JSON,
// wrong-shaped object straight through to the client (#198). Only the fields the client
// actually reads (MX4Briefing) are required; extras are ignored.
function isValidBriefingShape(content: unknown): content is {
  tone: string; headline: string; body: string; recommendation: string; flags: unknown[]
} {
  if (typeof content !== 'object' || content === null) return false
  const c = content as Record<string, unknown>
  return typeof c.tone === 'string'
    && typeof c.headline === 'string'
    && typeof c.body === 'string'
    && typeof c.recommendation === 'string'
    && Array.isArray(c.flags)
}

insightsRouter.get('/:section', (req, res) => {
  const { section } = req.params

  if (!VALID_SECTIONS.includes(section)) {
    res.status(404).json({ error: 'Unknown section' })
    return
  }

  const row = db.prepare(
    'SELECT content_json, generated_at, model FROM mx4_briefings WHERE section = ?'
  ).get(section) as { content_json: string; generated_at: string; model: string } | undefined

  if (row) {
    try {
      const content = JSON.parse(row.content_json)
      if (isValidBriefingShape(content)) {
        res.json({ ...content, generated_at: row.generated_at, model: row.model })
        return
      }
    } catch {
      // fall through to stub
    }
  }

  res.json(STUB_BRIEFINGS[section] ?? STUB_BRIEFINGS.home)
})

export default insightsRouter
