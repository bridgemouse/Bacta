import { describe, it, expect } from 'vitest'
import { spawnSync } from 'child_process'
import path from 'path'

const SCRIPT = path.join(process.cwd(), 'scripts', 'android-version.sh')
const run = (tag: string) => spawnSync('bash', [SCRIPT, tag], { encoding: 'utf8' })

describe('android-version.sh', () => {
  it.each([
    ['android-v0.1.0', '0.1.0 100'],
    ['android-v1.2.3', '1.2.3 10203'],
    ['android-v0.0.1', '0.0.1 1'],
    ['android-v12.34.56', '12.34.56 123456'],
  ])('%s -> %s', (tag, expected) => {
    const r = run(tag)
    expect(r.status).toBe(0)
    expect(r.stdout.trim()).toBe(expected)
  })

  it('sorts 0.10.0 above 0.9.9 (numeric, not lexical)', () => {
    const code = (t: string) => Number(run(t).stdout.trim().split(' ')[1])
    expect(code('android-v0.10.0')).toBeGreaterThan(code('android-v0.9.9'))
  })

  it.each([
    [''],
    ['v0.1.0'],
    ['android-0.1.0'],
    ['android-v1.0'],
    ['android-v1.0.0-rc1'],
    ['android-v1.100.0'],
    ['android-v1.0.100'],
    ['android-v1000.0.0'],
  ])('rejects %j', (tag) => {
    const r = run(tag)
    expect(r.status).not.toBe(0)
    expect(r.stdout).toBe('')
    expect(r.stderr).toContain('android-version:')
  })
})
