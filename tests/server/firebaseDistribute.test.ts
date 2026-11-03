import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { spawnSync } from 'child_process'
import fs from 'fs'
import os from 'os'
import path from 'path'

const SCRIPT = path.join(process.cwd(), 'scripts', 'firebase-distribute.sh')
const MARKER = 'MARKER-DO-NOT-LEAK'
const APP_ID = '1:123:android:abc'

let dir: string
let apk: string
let notes: string
let creds: string

function run(args: string[], env: Record<string, string | undefined> = {}) {
  const base = { ...process.env }
  for (const k of ['FIREBASE_APP_ID', 'GOOGLE_APPLICATION_CREDENTIALS', 'FIREBASE_GROUPS', 'FIREBASE_TOOLS_VERSION']) {
    delete base[k]
  }
  return spawnSync('bash', [SCRIPT, ...args], { encoding: 'utf8', env: { ...base, ...env } as NodeJS.ProcessEnv })
}

const ok = () => ({ FIREBASE_APP_ID: APP_ID, GOOGLE_APPLICATION_CREDENTIALS: creds })

beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'firebase-distribute-'))
  apk = path.join(dir, 'bacta-android-0.0.2.apk')
  notes = path.join(dir, 'notes.txt')
  creds = path.join(dir, 'creds.json')
  fs.writeFileSync(apk, 'apk')
  fs.writeFileSync(notes, 'Bacta Android 0.0.2')
  fs.writeFileSync(creds, JSON.stringify({ type: 'service_account', private_key: MARKER }))
})
afterAll(() => {
  fs.rmSync(dir, { recursive: true, force: true })
})

describe('firebase-distribute.sh', () => {
  it('skips with exit 0 when FIREBASE_APP_ID is empty', () => {
    const r = run(['--dry-run', apk, notes], { FIREBASE_APP_ID: '', GOOGLE_APPLICATION_CREDENTIALS: creds })
    expect(r.status).toBe(0)
    expect(r.stdout).toContain('firebase-distribute: skipped')
    expect(r.stdout).not.toContain('appdistribution:distribute')
  })

  it('skips with exit 0 when credentials are not set', () => {
    const r = run(['--dry-run', apk, notes], { FIREBASE_APP_ID: APP_ID })
    expect(r.status).toBe(0)
    expect(r.stdout).toContain('firebase-distribute: skipped')
  })

  it('dry-run prints the firebase command with app id, group and notes file', () => {
    const r = run(['--dry-run', apk, notes], ok())
    expect(r.status).toBe(0)
    expect(r.stdout).toContain('firebase-tools@15.34.2')
    expect(r.stdout).toContain('appdistribution:distribute')
    expect(r.stdout).toContain(apk)
    expect(r.stdout).toContain(`--app ${APP_ID}`)
    expect(r.stdout).toContain('--groups owner')
    expect(r.stdout).toContain(`--release-notes-file ${notes}`)
  })

  it('FIREBASE_GROUPS overrides the group', () => {
    const r = run(['--dry-run', apk, notes], { ...ok(), FIREBASE_GROUPS: 'friends' })
    expect(r.stdout).toContain('--groups friends')
  })

  it('FIREBASE_TOOLS_VERSION overrides the pinned CLI version', () => {
    const r = run(['--dry-run', apk, notes], { ...ok(), FIREBASE_TOOLS_VERSION: '99.0.0' })
    expect(r.stdout).toContain('firebase-tools@99.0.0')
  })

  it.each([
    ['an app id that is not an app id', () => ({ args: [apk, notes], env: { ...ok(), FIREBASE_APP_ID: 'abc' } })],
    ['an APK that does not exist', () => ({ args: [path.join(dir, 'nope.apk'), notes], env: ok() })],
    ['a notes file that does not exist', () => ({ args: [apk, path.join(dir, 'nope.txt')], env: ok() })],
    ['a credentials path that does not exist', () => ({ args: [apk, notes], env: { ...ok(), GOOGLE_APPLICATION_CREDENTIALS: path.join(dir, 'nope.json') } })],
    ['missing arguments', () => ({ args: [] as string[], env: ok() })],
  ])('refuses: %s', (_name, make) => {
    const { args, env } = make()
    const r = run(['--dry-run', ...args], env)
    expect(r.status).not.toBe(0)
    expect(r.stderr).toContain('firebase-distribute:')
    expect(r.stdout).not.toContain('appdistribution:distribute')
  })

  it('never prints the credentials contents, on success or refusal', () => {
    const outputs = [
      run(['--dry-run', apk, notes], ok()),
      run(['--dry-run', path.join(dir, 'nope.apk'), notes], ok()),
      run(['--dry-run', apk, notes], { ...ok(), FIREBASE_APP_ID: 'abc' }),
    ]
    for (const r of outputs) expect(r.stdout + r.stderr).not.toContain(MARKER)
  })
})
