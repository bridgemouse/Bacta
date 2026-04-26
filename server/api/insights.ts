import { Router } from 'express'
import fs from 'fs'
import path from 'path'

const router = Router()
const INSIGHTS_DIR = path.join(process.cwd(), 'insights')

router.get('/', (_req, res) => {
  if (!fs.existsSync(INSIGHTS_DIR)) return res.json({ sections: [] })
  const sections = fs.readdirSync(INSIGHTS_DIR)
    .filter(f => f.endsWith('.html'))
    .map(f => f.replace('.html', ''))
  res.json({ sections })
})

router.get('/:section', (req, res) => {
  const filePath = path.join(INSIGHTS_DIR, `${req.params.section}.html`)
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'not found' })
  res.setHeader('Content-Type', 'text/html')
  res.send(fs.readFileSync(filePath, 'utf-8'))
})

export default router
