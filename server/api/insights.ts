import { Router } from 'express'
import fs from 'fs'
import path from 'path'

const insightsRouter = Router()

const INSIGHTS_DIR = process.env.INSIGHTS_DIR ?? path.join(process.cwd(), 'insights')

const VALID_SECTIONS = ['home', 'recovery', 'training', 'sleep', 'nutrition', 'bloodwork', 'dailylog']

// List available sections (those with an HTML file present)
insightsRouter.get('/', (_req, res) => {
  const available: string[] = []
  for (const section of VALID_SECTIONS) {
    const filePath = path.join(INSIGHTS_DIR, `${section}.html`)
    if (fs.existsSync(filePath)) {
      available.push(section)
    }
  }
  res.json({ sections: available })
})

// Serve a section's HTML insight file
insightsRouter.get('/:section', (req, res) => {
  const { section } = req.params

  if (!VALID_SECTIONS.includes(section)) {
    res.status(404).json({ error: 'Unknown section' })
    return
  }

  const filePath = path.join(INSIGHTS_DIR, `${section}.html`)
  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: 'No insight available for section' })
    return
  }

  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.send(fs.readFileSync(filePath, 'utf8'))
})

export default insightsRouter
