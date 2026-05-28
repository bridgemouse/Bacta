import { Router } from 'express'
import fs from 'fs'
import path from 'path'

const insightsRouter = Router()

const INSIGHTS_DIR = process.env.INSIGHTS_DIR ?? path.join(process.cwd(), 'insights')

const VALID_SECTIONS = ['home', 'recovery', 'training', 'sleep', 'nutrition', 'bloodwork', 'dailylog']

const MOCK_INSIGHTS: Record<string, object> = {
  home: {
    generated_at: new Date().toISOString(),
    summary: 'Recovery solid. Training on track. Nutrition close — protein slightly under. MX-4 standing by.',
    tone: 'positive',
    flags: [],
  },
  recovery: {
    generated_at: new Date().toISOString(),
    summary: 'HRV up 4ms. Body battery at 74. Green for tomorrow.',
    tone: 'positive',
    flags: [],
  },
  training: {
    generated_at: new Date().toISOString(),
    summary: 'Load moderate. Week 4 of 8. Thursday tempo is the key session.',
    tone: 'positive',
    flags: [],
  },
  sleep: {
    generated_at: new Date().toISOString(),
    summary: '8.1h, score 82. Deep sleep slightly low but consistent with mileage spike.',
    tone: 'positive',
    flags: [],
  },
  nutrition: {
    generated_at: new Date().toISOString(),
    summary: 'Calories on target. Protein under by 18g — close the gap at dinner.',
    tone: 'caution',
    flags: ['protein under target'],
  },
  bloodwork: {
    generated_at: new Date().toISOString(),
    summary: 'No panels uploaded yet.',
    tone: 'caution',
    flags: [],
  },
  dailylog: {
    generated_at: new Date().toISOString(),
    summary: 'Daily log ready.',
    tone: 'positive',
    flags: [],
  },
}

// Get insight for a section — reads JSON from insights dir if available, falls back to mock
insightsRouter.get('/:section', (req, res) => {
  const { section } = req.params

  if (!VALID_SECTIONS.includes(section)) {
    res.status(404).json({ error: 'Unknown section' })
    return
  }

  const filePath = path.join(INSIGHTS_DIR, `${section}.json`)
  if (fs.existsSync(filePath)) {
    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'))
      res.json(data)
      return
    } catch {
      // Fall through to mock
    }
  }

  res.json(MOCK_INSIGHTS[section])
})

export default insightsRouter
