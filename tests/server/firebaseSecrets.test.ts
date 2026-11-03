import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { spawnSync } from 'child_process'
import fs from 'fs'
import os from 'os'
import path from 'path'

const SCRIPT = path.join(process.cwd(), 'scripts', 'firebase-secrets.sh')
const MARKER = 'MARKER-DO-NOT-LEAK'
const APP_ID = '1:1234567890:android:0a1b2c3d4e5f67890'

let dir: string
let validKey: string
let notJson: string
let wrongType: string

function run(args: string[]) {
  return spawnSync('bash', [SCRIPT, ...args], { encoding: 'utf8' })
}

beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'firebase-secrets-'))
  validKey = path.join(dir, 'sa.json')
  notJson = path.join(dir, 'notjson.txt')
  wrongType = path.join(dir, 'wrongtype.json')
  fs.writeFileSync(validKey, JSON.stringify({ type: 'service_account', private_key: MARKER }))
  fs.writeFileSync(notJson, `this is not json ${MARKER}`)
  fs.writeFileSync(wrongType, JSON.stringify({ type: 'authorized_user', refresh_token: MARKER }))
})
afterAll(() => {
  fs.rmSync(dir, { recursive: true, force: true })
})

describe('firebase-secrets.sh', () => {
  it('--dry-run prints both secret names and exits 0', () => {
    const r = run(['--dry-run', validKey, APP_ID])
    expect(r.status).toBe(0)
    expect(r.stdout).toContain('gh secret set FIREBASE_SERVICE_ACCOUNT')
    expect(r.stdout).toContain('gh secret set FIREBASE_APP_ID')
  })

  it('never prints the key contents on success', () => {
    const r = run(['--dry-run', validKey, APP_ID])
    expect(r.stdout + r.stderr).not.toContain(MARKER)
  })

  it.each([
    ['missing key file', () => ['--dry-run', path.join(dir, 'nope.json'), APP_ID]],
    ['file that is not JSON', () => ['--dry-run', notJson, APP_ID]],
    ['JSON that is not a service account', () => ['--dry-run', wrongType, APP_ID]],
    ['app id that is not an app id', () => ['--dry-run', validKey, 'abc']],
    ['an iOS app id', () => ['--dry-run', validKey, '1:123:ios:abc']],
    ['missing arguments', () => ['--dry-run']],
    ['no arguments at all', () => [] as string[]],
  ])('refuses: %s', (_name, args) => {
    const r = run(args())
    expect(r.status).not.toBe(0)
    expect(r.stdout).toBe('')
    expect(r.stderr).toContain('firebase-secrets:')
  })

  it('never prints the key contents on failure either', () => {
    for (const args of [
      ['--dry-run', notJson, APP_ID],
      ['--dry-run', wrongType, APP_ID],
      ['--dry-run', validKey, 'abc'],
    ]) {
      const r = run(args)
      expect(r.stdout + r.stderr).not.toContain(MARKER)
    }
  })
})
