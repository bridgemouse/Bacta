import 'dotenv/config'
import express from 'express'
import path from 'path'
import { migrate } from './db/migrate'
import healthRouter from './api/health'
import garminRouter from './api/garmin'
import manualRouter from './api/manual'
import insightsRouter from './api/insights'
import bloodworkRouter from './api/bloodwork'
import pollRouter from './api/poll'
import azi3Router from './api/azi3'

migrate()

export const app = express()
app.use(express.json())

app.use('/api/health', healthRouter)
app.use('/api/garmin', garminRouter)
app.use('/api/manual', manualRouter)
app.use('/api/insights', insightsRouter)
app.use('/api/bloodwork', bloodworkRouter)
app.use('/api/poll', pollRouter)
app.use('/api/azi3', azi3Router)

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
