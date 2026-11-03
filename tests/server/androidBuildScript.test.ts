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

describe('android-build.sh screenshot', () => {
  const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  let bin: string
  let out: string

  beforeAll(() => {
    bin = fs.mkdtempSync(path.join(os.tmpdir(), 'fake-ssh-'))
    out = fs.mkdtempSync(path.join(os.tmpdir(), 'android-out-'))
    // A multi-display phone (e.g. a foldable) prints a text warning to stdout before the PNG bytes.
    fs.writeFileSync(
      path.join(bin, 'ssh'),
      "#!/usr/bin/env bash\nprintf '[Warning] Multiple displays were found\\n'\nprintf '\\x89PNG\\r\\n\\x1a\\nIMAGEDATA'\n",
      { mode: 0o755 },
    )
  })
  afterAll(() => {
    fs.rmSync(bin, { recursive: true, force: true })
    fs.rmSync(out, { recursive: true, force: true })
  })

  it('strips text printed before the PNG data so the saved file is a valid PNG', () => {
    const r = run(['screenshot', '192.168.1.50:37123'], {
      PATH: `${bin}:${process.env.PATH}`,
      ANDROID_OUT_DIR: out,
    })
    expect(r.status).toBe(0)
    const saved = fs.readFileSync(path.join(out, 'screen.png'))
    expect(saved.subarray(0, 8).equals(PNG_SIGNATURE)).toBe(true)
    expect(saved.toString('latin1')).toContain('IMAGEDATA')
  })

  it('selects a specific display when ANDROID_DISPLAY is set', () => {
    const r = run(['--dry-run', 'screenshot', '192.168.1.50:37123'], { ANDROID_DISPLAY: '4630946722019192211' })
    expect(r.status).toBe(0)
    expect(r.stdout).toContain('screencap -p -d 4630946722019192211')
  })

  it('refuses a non-numeric display id', () => {
    const r = run(['--dry-run', 'screenshot', '192.168.1.50:37123'], { ANDROID_DISPLAY: '1; rm -rf ~' })
    expect(r.status).not.toBe(0)
    expect(r.stdout).toBe('')
    expect(r.stderr).toContain('android-build:')
  })
})
