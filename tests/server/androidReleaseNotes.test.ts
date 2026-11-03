import { describe, it, expect, afterEach } from 'vitest'
import { spawnSync } from 'child_process'
import fs from 'fs'
import os from 'os'
import path from 'path'

const SCRIPT = path.join(process.cwd(), 'scripts', 'android-release-notes.sh')
const repos: string[] = []

function git(cwd: string, ...args: string[]) {
  const r = spawnSync('git', args, {
    cwd,
    encoding: 'utf8',
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: 't',
      GIT_AUTHOR_EMAIL: 't@example.com',
      GIT_COMMITTER_NAME: 't',
      GIT_COMMITTER_EMAIL: 't@example.com',
    },
  })
  if (r.status !== 0) throw new Error(`git ${args.join(' ')}: ${r.stderr}`)
  return r.stdout
}

function makeRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'release-notes-'))
  repos.push(dir)
  git(dir, 'init', '-q', '-b', 'main')
  return dir
}

let counter = 0
function commit(dir: string, file: string, subject: string) {
  fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true })
  fs.writeFileSync(path.join(dir, file), String(counter++))
  git(dir, 'add', '-A')
  git(dir, 'commit', '-q', '-m', subject)
}

function tag(dir: string, name: string) {
  git(dir, 'tag', '-a', name, '-m', name)
}

function notes(dir: string, tagName: string, env: Record<string, string> = {}) {
  const r = spawnSync('bash', [SCRIPT, tagName], { cwd: dir, encoding: 'utf8', env: { ...process.env, ...env } })
  return { status: r.status, stdout: r.stdout, stderr: r.stderr, lines: r.stdout.trimEnd().split('\n') }
}

afterEach(() => {
  while (repos.length) fs.rmSync(repos.pop()!, { recursive: true, force: true })
})

describe('android-release-notes.sh', () => {
  it('lists android commits since the previous android tag, newest first', () => {
    const d = makeRepo()
    commit(d, 'android/a.txt', 'android: first screen')
    tag(d, 'android-v0.0.1')
    commit(d, 'android/b.txt', 'android: add login')
    commit(d, 'server/s.txt', 'server: unrelated')
    commit(d, 'android/c.txt', 'android: add home')
    tag(d, 'android-v0.1.0')
    const r = notes(d, 'android-v0.1.0')
    expect(r.status).toBe(0)
    expect(r.lines).toEqual(['Bacta Android 0.1.0', '', '- android: add home', '- android: add login'])
  })

  it('with no previous android tag lists all android commits', () => {
    const d = makeRepo()
    commit(d, 'android/a.txt', 'android: first screen')
    commit(d, 'server/s.txt', 'server: unrelated')
    commit(d, 'android/b.txt', 'android: add login')
    tag(d, 'android-v0.0.1')
    const r = notes(d, 'android-v0.0.1')
    expect(r.status).toBe(0)
    expect(r.lines).toEqual(['Bacta Android 0.0.1', '', '- android: add login', '- android: first screen'])
  })

  it('says so when nothing in android/ changed since the last tag', () => {
    const d = makeRepo()
    commit(d, 'android/a.txt', 'android: first screen')
    tag(d, 'android-v0.0.1')
    commit(d, 'server/s.txt', 'server: unrelated')
    tag(d, 'android-v0.0.2')
    const r = notes(d, 'android-v0.0.2')
    expect(r.status).toBe(0)
    expect(r.lines).toEqual(['Bacta Android 0.0.2', '', '- No Android changes since android-v0.0.1'])
  })

  it('says so on a first release with no android commits at all', () => {
    const d = makeRepo()
    commit(d, 'server/s.txt', 'server: unrelated')
    tag(d, 'android-v0.0.1')
    const r = notes(d, 'android-v0.0.1')
    expect(r.status).toBe(0)
    expect(r.lines).toEqual(['Bacta Android 0.0.1', '', '- First Android release'])
  })

  it('caps the list at ANDROID_NOTES_MAX', () => {
    const d = makeRepo()
    commit(d, 'android/a.txt', 'android: one')
    commit(d, 'android/b.txt', 'android: two')
    commit(d, 'android/c.txt', 'android: three')
    tag(d, 'android-v0.0.1')
    const r = notes(d, 'android-v0.0.1', { ANDROID_NOTES_MAX: '2' })
    expect(r.lines).toEqual(['Bacta Android 0.0.1', '', '- android: three', '- android: two'])
  })

  it('skips merge commits', () => {
    const d = makeRepo()
    commit(d, 'android/a.txt', 'android: base')
    tag(d, 'android-v0.0.1')
    git(d, 'checkout', '-q', '-b', 'topic')
    commit(d, 'android/b.txt', 'android: on a branch')
    git(d, 'checkout', '-q', 'main')
    git(d, 'merge', '--no-ff', '-q', 'topic', '-m', 'Merge branch topic')
    tag(d, 'android-v0.0.2')
    const r = notes(d, 'android-v0.0.2')
    expect(r.lines).toEqual(['Bacta Android 0.0.2', '', '- android: on a branch'])
    expect(r.stdout).not.toContain('Merge')
  })

  it('rejects a malformed tag', () => {
    const d = makeRepo()
    commit(d, 'android/a.txt', 'android: base')
    const r = notes(d, 'v0.1.0')
    expect(r.status).not.toBe(0)
    expect(r.stdout).toBe('')
    expect(r.stderr).toContain('android-version:')
  })
})
