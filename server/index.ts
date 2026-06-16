import 'dotenv/config'
import express from 'express'
import path from 'path'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import { migrate } from './db/migrate'
import healthRouter from './api/health'
import garminRouter from './api/garmin'
import manualRouter from './api/manual'
import insightsRouter from './api/insights'
import bloodworkRouter from './api/bloodwork'
import pollRouter from './api/poll'
import mx4Router from './api/mx4'
import settingsRouter from './api/settings'
import { scheduleNightly } from './lib/ai/scheduler'

migrate()
scheduleNightly()

const isTest = process.env.NODE_ENV === 'test' || !!process.env.VITEST

export const app = express()
app.disable('x-powered-by')

// Security headers + CSP. The app uses inline styles everywhere and loads
// Google Fonts; scripts/connections are same-origin only.
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:'],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
      baseUri: ["'self'"],
    },
  },
}))

app.use(express.json({ limit: '1mb' }))

// Throttle the expensive / abusable endpoints (AI runs, chat, Garmin sync,
// poll/force). Disabled under tests so the suite isn't rate-limited.
const aiLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 40,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTest,
})

app.use('/api/health', healthRouter)
app.use('/api/garmin', garminRouter)
app.use('/api/manual', manualRouter)
app.use('/api/insights', insightsRouter)
app.use('/api/bloodwork', bloodworkRouter)
app.use('/api/poll', aiLimiter, pollRouter)
app.use('/api/mx4', aiLimiter, mx4Router)
app.use('/api/settings', settingsRouter)

// Serve built React app in production
if (process.env.NODE_ENV === 'production') {
  const clientDir = path.join(process.cwd(), 'dist/client')
  app.use(express.static(clientDir, { etag: false }))
  app.get('/{*splat}', (_req, res) => {
    res.set('Cache-Control', 'no-store')
    res.sendFile(path.join(clientDir, 'index.html'))
  })
}

// Generic error handler — log details server-side, never leak stack/SQL/paths.
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[server] unhandled error:', err)
  if (res.headersSent) return
  res.status(500).json({ error: 'Internal server error' })
})

if (require.main === module) {
  const port = process.env.PORT ?? 3001
  app.listen(port, () => console.log(`[server] listening on :${port}`))
}
