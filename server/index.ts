import 'dotenv/config'
import express from 'express'
import path from 'path'
import { migrate } from './db/migrate'
import healthRouter from './api/health'
import garminRouter from './api/garmin'

// Stub routers for routes not yet implemented (Tasks 5-6)
// These will be replaced with real implementations in subsequent tasks
import { Router } from 'express'
const stubRouter = Router()
stubRouter.all('/{*splat}', (_req, res) => res.status(501).json({ error: 'not implemented' }))

migrate()

export const app = express()
app.use(express.json())

app.use('/api/health', healthRouter)
app.use('/api/garmin', garminRouter)
app.use('/api/manual', stubRouter)
app.use('/api/insights', stubRouter)
app.use('/api/bloodwork', stubRouter)
app.use('/api/poll', stubRouter)

// Serve built React app in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(process.cwd(), 'dist/client')))
  app.get('/{*splat}', (_req, res) => {
    res.sendFile(path.join(process.cwd(), 'dist/client/index.html'))
  })
}

if (require.main === module) {
  const port = process.env.PORT ?? 3001
  app.listen(port, () => console.log(`[server] listening on :${port}`))
}
