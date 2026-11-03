import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

const workflow = fs.readFileSync(path.join(process.cwd(), '.github', 'workflows', 'android-release.yml'), 'utf8')

describe('android-release.yml', () => {
  it('checks out full history so release notes can see the previous tag', () => {
    expect(workflow).toMatch(/actions\/checkout@v7\s*\n\s*with:\s*\n\s*fetch-depth: 0/)
  })

  it('distributes to Firebase only after the GitHub Release is published', () => {
    const published = workflow.indexOf('Publish GitHub Release')
    const distributed = workflow.indexOf('Distribute to Firebase')
    expect(published).toBeGreaterThan(-1)
    expect(distributed).toBeGreaterThan(published)
  })

  it('skips Firebase steps when the secret is absent', () => {
    expect(workflow).toContain("secrets.FIREBASE_SERVICE_ACCOUNT != ''")
    expect(workflow).toContain('id: firebase')
    const gated = workflow.split("steps.firebase.outputs.enabled == 'true'").length - 1
    expect(gated).toBeGreaterThanOrEqual(2)
    expect(workflow).toContain('Firebase distribution skipped')
  })

  it('authenticates with the pinned google-github-actions/auth major', () => {
    expect(workflow).toContain('google-github-actions/auth@v3')
    expect(workflow).toContain('credentials_json: ${{ secrets.FIREBASE_SERVICE_ACCOUNT }}')
  })

  it('builds the release notes and calls the distribute script', () => {
    expect(workflow).toContain('scripts/android-release-notes.sh')
    expect(workflow).toContain('scripts/firebase-distribute.sh')
  })

  it('does not enable shell tracing', () => {
    expect(workflow).not.toMatch(/set\s+-[a-z]*x/)
  })
})
