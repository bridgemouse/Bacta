import { describe, it, expect } from 'vitest'
import pkg from '../../../package.json'
import { APP_VERSION } from '../../../client/src/version'

describe('APP_VERSION', () => {
  it('comes from package.json so the two cannot drift', () => {
    expect(APP_VERSION).toBe(pkg.version)
  })

  it('is a plain semver string', () => {
    expect(APP_VERSION).toMatch(/^\d+\.\d+\.\d+$/)
  })
})
