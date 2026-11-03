import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { spawnSync } from 'child_process'
import fs from 'fs'
import os from 'os'
import path from 'path'

const SCRIPT = path.join(process.cwd(), 'scripts', 'android-build.sh')
let src: string

function run(args: string[], env: Record<string, string> = {}) {
  return spawnSync('bash', [SCRIPT, ...args], {
    encoding: 'utf8',
    env: { ...process.env, ANDROID_SRC: src, ...env },
  })
}

beforeAll(() => {
  src = fs.mkdtempSync(path.join(os.tmpdir(), 'android-src-'))
})
afterAll(() => {
  fs.rmSync(src, { recursive: true, force: true })
})

describe('android-build.sh', () => {
  it('sync builds an rsync that excludes build output and targets the project dir', () => {
    const r = run(['--dry-run', 'sync'])
    expect(r.status).toBe(0)
    expect(r.stdout).toContain('rsync -az --delete --exclude build --exclude .gradle --exclude local.properties --exclude .idea')
    expect(r.stdout).toContain('wheat@bacta-android:/home/wheat/work/bacta-android/')
  })

  it('build syncs first, then runs gradle on the VM with the requested tasks', () => {
    const r = run(['--dry-run', 'build', 'testDebugUnitTest', 'assembleDebug'])
    expect(r.status).toBe(0)
    const lines = r.stdout.trim().split('\n')
    const rsyncAt = lines.findIndex(l => l.startsWith('rsync '))
    const gradleAt = lines.findIndex(l => l.includes('./gradlew'))
    expect(rsyncAt).toBeGreaterThanOrEqual(0)
    expect(gradleAt).toBeGreaterThan(rsyncAt)
    expect(lines[gradleAt]).toContain('testDebugUnitTest assembleDebug')
  })

  it('install targets the given phone address with adb -s', () => {
    const r = run(['--dry-run', 'install', '192.168.1.50:37123'])
    expect(r.status).toBe(0)
    expect(r.stdout).toContain('adb -s 192.168.1.50:37123 install -r')
    expect(r.stdout).toContain('app/build/outputs/apk/debug/app-debug.apk')
  })

  it.each([
    ['empty project', { ANDROID_PROJECT: '' }],
    ['path traversal in project', { ANDROID_PROJECT: '../etc' }],
    ['project with a slash', { ANDROID_PROJECT: 'a/b' }],
    ['project with a space', { ANDROID_PROJECT: 'a b' }],
    ['root remote base', { ANDROID_REMOTE_BASE: '/' }],
    ['remote base outside /home', { ANDROID_REMOTE_BASE: '/etc' }],
    ['remote base escaping /home with ..', { ANDROID_REMOTE_BASE: '/home/../etc/x' }],
    ['remote base climbing out of the home dir', { ANDROID_REMOTE_BASE: '/home/wheat/../../etc' }],
    ['remote base with a quote that would break the remote command', { ANDROID_REMOTE_BASE: "/home/wheat/x'; rm -rf ~; '" }],
  ])('refuses to build any command for: %s', (_name, env) => {
    const r = run(['--dry-run', 'sync'], env)
    expect(r.status).not.toBe(0)
    expect(r.stdout).toBe('')
    expect(r.stderr).toContain('android-build:')
  })

  it('refuses when the source directory does not exist', () => {
    const r = run(['--dry-run', 'sync'], { ANDROID_SRC: path.join(src, 'missing') })
    expect(r.status).not.toBe(0)
    expect(r.stdout).toBe('')
  })

  it('rejects unknown commands with usage', () => {
    const r = run(['--dry-run', 'frobnicate'])
    expect(r.status).not.toBe(0)
    expect(r.stderr).toContain('usage')
  })

  it('install without an address fails', () => {
    const r = run(['--dry-run', 'install'])
    expect(r.status).not.toBe(0)
  })
})
