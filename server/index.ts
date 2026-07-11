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
import nutritionRouter from './api/nutrition'
import pollRouter from './api/poll'
import mx4Router from './api/mx4'
import settingsRouter from './api/settings'
import logsRouter from './api/logs'
import authRouter from './api/auth'
import { integrationsRouter, callbackHandler } from './api/integrations'
import { isAuthConfigured, verifyToken, parseCookies, SESSION_COOKIE } from './lib/auth'
import { VALID_LOGOS } from './api/settings'
import { scheduleNightly } from './lib/ai/scheduler'
import { scheduleGarminBackgroundSync } from './lib/garminSync'
import { scheduleProviderBackgroundSync } from './lib/providerSync'
import { getSetting } from './lib/settings'

migrate()
scheduleNightly()
scheduleGarminBackgroundSync()
scheduleProviderBackgroundSync()

const isTest = process.env.NODE_ENV === 'test' || !!process.env.VITEST

export const app = express()
app.disable('x-powered-by')
// Bacta is served behind Nginx Proxy Manager which adds X-Forwarded-For.
// Trusting the first proxy hop makes express-rate-limit work correctly on LAN.
app.set('trust proxy', 1)

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
      // Bacta is served over plain HTTP on the LAN until the TLS runbook lands;
      // do NOT upgrade requests to https or the app becomes unreachable. (helmet
      // adds this by default — null removes it.)
      upgradeInsecureRequests: null,
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

// Strict limiter for credential endpoints — slows PIN brute-force.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTest,
})

// Auth gate: enforced only once a PIN is configured, so a fresh box / the test
// suite stay open until the user secures it. Health + auth endpoints are exempt.
// Accepts BACTA_INTERNAL_TOKEN Bearer header so pollers and scheduled syncs
// can reach protected routes without a browser session.
function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction): void {
  if (!isAuthConfigured()) return next()
  const internal = process.env.BACTA_INTERNAL_TOKEN ?? ''
  const bearer = (req.headers.authorization ?? '').replace('Bearer ', '')
  if (internal && bearer === internal) return next()
  const token = parseCookies(req.headers.cookie)[SESSION_COOKIE]
  if (verifyToken(token)) return next()
  res.status(401).json({ error: 'Authentication required' })
}

app.use('/api/health', healthRouter)
app.use('/api/auth/login', loginLimiter)
app.use('/api/auth/set-pin', loginLimiter)
app.use('/api/auth', authRouter)
app.use('/api/garmin', requireAuth, garminRouter)
app.use('/api/manual', requireAuth, manualRouter)
app.use('/api/insights', requireAuth, insightsRouter)
app.use('/api/bloodwork', requireAuth, bloodworkRouter)
app.use('/api/nutrition', requireAuth, nutritionRouter)
app.use('/api/poll', requireAuth, aiLimiter, pollRouter)
app.use('/api/mx4', requireAuth, aiLimiter, mx4Router)
app.use('/api/settings', requireAuth, settingsRouter)
app.use('/api/logs', requireAuth, logsRouter)

// OAuth callbacks exempt from requireAuth — browser arrives from external redirect
// CSRF state parameter is the guard inside callbackHandler
app.get('/api/integrations/:provider/callback', callbackHandler)

// All other integration routes require session auth
app.use('/api/integrations', requireAuth, integrationsRouter)

// Serve built React app in production
if (process.env.NODE_ENV === 'production') {
  const clientDir = path.join(process.cwd(), 'dist/client')

  // Dynamic manifest — returns icon pointing to the selected logo
  app.get('/manifest.json', (_req, res) => {
    const key = getSetting('app_logo') ?? 'splash'
    const logoKey = VALID_LOGOS.includes(key) ? key : 'splash'
    res.set('Cache-Control', 'no-store')
    res.json({
      name: 'Bacta',
      short_name: 'Bacta',
      description: 'Personal health dashboard',
      start_url: '/',
      display: 'standalone',
      background_color: '#0f1117',
      theme_color: '#0f1117',
      orientation: 'portrait',
      icons: [
        { src: `/logos/logo-${logoKey}.png`, sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
      ],
    })
  })

  // Dynamic apple-touch-icon — iOS reads this at "Add to Home Screen" time
  app.get('/apple-touch-icon.png', (_req, res) => {
    const key = getSetting('app_logo') ?? 'splash'
    const logoKey = VALID_LOGOS.includes(key) ? key : 'splash'
    res.set('Cache-Control', 'no-store')
    res.sendFile(path.join(clientDir, 'logos', `logo-${logoKey}.png`))
  })
  // iOS also requests these variants
  app.get('/apple-touch-icon-precomposed.png', (_req, res) => res.redirect('/apple-touch-icon.png'))

  // index: false — otherwise express.static serves index.html directly for GET /
  // using its own default Cache-Control (public, max-age=0 + Last-Modified),
  // bypassing the explicit no-store below entirely. iOS Safari's standalone PWA
  // mode can hold onto that cached shell (with a stale JS bundle reference)
  // indefinitely instead of revalidating, so a new deploy silently never reaches
  // the device. Forcing every request through the catch-all guarantees no-store.
  app.use(express.static(clientDir, { etag: false, index: false }))
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
  app.listen(port, () => {
    console.log(`[server] listening on :${port}`)
    if (!isAuthConfigured()) {
      console.warn('[server] ⚠ AUTH NOT CONFIGURED — the app is OPEN to anyone on the network. Set a PIN to secure it.')
    }
  })
}
