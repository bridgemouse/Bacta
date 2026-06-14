import fs from 'fs'
import path from 'path'

const WIKI_DIR       = () => process.env.WIKI_DIR ?? path.join(process.cwd(), 'mx4', 'wiki')
const HEARTBEAT_PATH = () => path.join(process.cwd(), 'mx4', 'HEARTBEAT.md')

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

export function readAllWikiPagesSync(): string {
  const dir = WIKI_DIR()
  if (!fs.existsSync(dir)) return '(wiki not yet initialized)'
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.md')).sort()
  if (files.length === 0) return '(wiki is empty)'
  return files
    .map(f => `\n\n=== ${f} ===\n${fs.readFileSync(path.join(dir, f), 'utf-8')}`)
    .join('')
}

export function writeWikiPageSync(name: string, content: string): { tokenEstimate: number; warning?: string } {
  const dir = WIKI_DIR()
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, `${name}.md`), content, 'utf-8')
  const tokenEstimate = estimateTokens(content)
  const warning = tokenEstimate > 1500
    ? `Page is ~${tokenEstimate} estimated tokens (soft limit 1500, hard limit 2000). Synthesis required if over 2000.`
    : undefined
  return { tokenEstimate, warning }
}

export function listWikiPagesSync(): { name: string; tokenEstimate: number }[] {
  const dir = WIKI_DIR()
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.md'))
    .sort()
    .map(f => ({
      name: f.replace('.md', ''),
      tokenEstimate: estimateTokens(fs.readFileSync(path.join(dir, f), 'utf-8')),
    }))
}

export function archiveWikiPageSync(name: string): void {
  const dir = WIKI_DIR()
  const srcPath = path.join(dir, `${name}.md`)
  if (!fs.existsSync(srcPath)) throw new Error(`Wiki page not found: ${name}`)
  const archiveDir = path.join(dir, 'archive')
  fs.mkdirSync(archiveDir, { recursive: true })
  const date = new Date().toISOString().slice(0, 10)
  fs.copyFileSync(srcPath, path.join(archiveDir, `${date}-${name}.md`))
}

export function loadHeartbeat(): string {
  try {
    return fs.readFileSync(HEARTBEAT_PATH(), 'utf-8')
  } catch {
    return ''
  }
}
