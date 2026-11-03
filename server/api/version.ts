import fs from 'fs'
import path from 'path'
import { Router } from 'express'

export const MIN_APP_VERSION = '0.1.0'

function readServerVersion(): string {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'))
    return typeof pkg.version === 'string' ? pkg.version : 'unknown'
  } catch {
    return 'unknown'
  }
}

const SERVER_VERSION = readServerVersion()

const versionRouter = Router()

versionRouter.get('/', (_req, res) => {
  res.json({ server: SERVER_VERSION, minApp: MIN_APP_VERSION })
})

export default versionRouter
