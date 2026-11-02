# Android Foundation Implementation Plan (Phases A–D)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the server-side prerequisites (single version source, `GET /api/version`, nightly backups, `v1.1.0` tag) and stand up the Android toolchain end to end: a Hello World Compose app built on the dev VM, installed on the owner's Fold over `adb`, calling the live server, with CI and a signed-release pipeline.

**Architecture:** LXC 109 is the only machine that edits and runs git. `android/` (a Gradle project) is rsynced one-way to the dev VM (`wheat@bacta-android`), which builds and talks to the phone over `adb`. GitHub Actions runs unit tests on every Android change and builds signed release APKs from `android-v*` tags. The server gains one unauthenticated endpoint so the app can check compatibility before login.

**Tech Stack:** Kotlin + Jetpack Compose (AGP 9.5.0 built-in Kotlin, Kotlin plugin 2.4.21, Compose BOM 2026.09.00, activity-compose 1.13.0, Gradle 9.8.2, JDK 17), Express + TypeScript + Vitest + Supertest (server), bash + rsync + ssh (tooling).

**Spec:** `docs/superpowers/specs/2026-11-02-android-native-app-design.md`

## Global Constraints

- Android: `minSdk 34`, `compileSdk 37`, `targetSdk 37`; SDK on the VM is platform `android-37.0`, build-tools `37.0.0`.
- `applicationId` / `namespace`: `io.github.bridgemouse.bacta` (**permanent once installed — owner confirms in Task 7 Step 1**).
- Build versions are pinned to the values read from Google Maven / Gradle on 2026-11-02 (above). AGP 9 has built-in Kotlin: **never apply `org.jetbrains.kotlin.android`**; the Compose plugin `org.jetbrains.kotlin.plugin.compose` is still applied.
- Dark UI only. Colors are the `client/src/theme.ts` values (e.g. base `#0f1117`, MX-4 cyan `#2bc4e8`).
- The VM holds no git credentials, no secrets, no production database. LXC 109 is the only machine that commits and pushes.
- Never check out a branch in `/opt/bacta` (production runs `tsx watch` from it). All work happens in `worktrees/<name>`.
- Work on feature branches, merge via PR with CI green; squash-merge. Do not commit to `main`.
- `git branch -D` is denied for Claude by the owner's settings. Branch deletion is an owner-run step.
- Server reads files relative to `process.cwd()` (`tsconfig.server.json` has `rootDir: "server"`, so the server cannot `import` the root `package.json`).
- Cleartext HTTP is permitted **only** to `bacta.home` and `192.168.1.119`; everything else stays HTTPS-only.
- Commit messages end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`; PR bodies follow `.github/pull_request_template.md` headings and end with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.
- The dev VM must not run while WinVM 110 is up; the owner starts and stops the VM.

## Review Focus

Failure modes the spec implies that are most likely to bite, each pinned by a test in the owning task:

1. **`/api/version` must work with no auth cookie and expose nothing else** — the app calls it before login. (Task 2 tests: unauthenticated 200; bogus cookie still 200; response has exactly the keys `server` and `minApp`.)
2. **A backup that cannot be restored is worse than none.** (Task 3: restore the newest backup into a scratch file, `integrity_check` must be `ok`, table counts must be close to live.)
3. **`rsync --delete` aimed at the wrong place destroys files.** (Task 6 tests: empty/traversal project names, root-ish remote base, and a missing source dir all abort before any command is built.)
4. **Cleartext must not leak to other hosts.** (Task 7 test parses `network_security_config.xml`: base config forbids cleartext, exactly two allowed domains.)
5. **`versionCode` collisions.** The spec's `major*10000 + minor*100 + patch` collides if minor or patch reaches 100 (`1.0.100` == `1.1.0`). (Task 10 tests reject minor/patch above 99 and check `0.10.0` sorts above `0.9.9`.)
6. **Dev VM off or unreachable must fail fast with a clear message, not hang.** (Task 6 Step 9, manual check against a dead address.)

## File Structure

| File | Responsibility |
|---|---|
| `package.json`, `package-lock.json` | Version source of truth → `1.1.0` |
| `client/src/version.ts` | Re-exports `package.json` version (no hand sync) |
| `tests/client/lib/version.test.ts` | Pins `APP_VERSION === package.json version` |
| `server/api/version.ts` | `GET /api/version` router + `MIN_APP_VERSION` |
| `server/index.ts` | Mounts the router before `requireAuth` |
| `tests/server/version.test.ts` | Endpoint behavior |
| `docs/ARCHITECTURE.md` | Route table row |
| `.gitignore` | Android build outputs, keystores, APKs; stop tracking `settings.local.json` |
| `scripts/android-build.sh` | sync / build / apk / install / adb / screenshot against the dev VM |
| `tests/server/androidBuildScript.test.ts` | Dry-run + guard tests for the script |
| `android/**` | Gradle project (root + `app` module) |
| `.github/workflows/android.yml` | Android CI (path-filtered, not a required check) |
| `scripts/android-version.sh`, `tests/server/androidVersion.test.ts` | Tag → `versionName`/`versionCode` |
| `scripts/android-keygen.sh` | Owner-run release key creation + GitHub secrets |
| `.github/workflows/android-release.yml` | Tag-triggered signed APK → GitHub Release |

## Branch / PR plan

| Branch (worktree `worktrees/<name>`) | Tasks |
|---|---|
| `docs/android-spec` (`android-spec`, exists) | 0 |
| `feature/version-endpoint` | 1, 2 |
| *(host operations, no PR)* | 3 |
| `chore/android-hygiene` | 4 |
| *(tag + owner cleanup)* | 5 |
| `feature/android-foundation` | 6, 7, 9 (8 is verification on the phone) |
| `feature/android-release` | 10 |

---

### Task 0: Land the spec and this plan

**Files:** `docs/superpowers/specs/2026-11-02-android-native-app-design.md`, `docs/superpowers/plans/2026-11-02-android-foundation.md` (both on `docs/android-spec`)

- [ ] **Step 1: Commit the plan**

```bash
cd /opt/bacta/worktrees/android-spec
git add docs/superpowers/plans/2026-11-02-android-foundation.md
git commit -m "docs: implementation plan for Android foundation (phases A-D)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 2: Rebase, push, open the PR**

```bash
git fetch -q origin main && git rebase origin/main
git push -u origin docs/android-spec
gh pr create --base main --head docs/android-spec --title "docs: Android native app design spec and foundation plan" --body "$(cat <<'EOF'
## What does this do?

Adds the approved design spec for a native Android client (Kotlin + Compose) and the first implementation plan (phases A–D). Docs only.

## How to test

Read the two files under `docs/superpowers/`. No code changes.

## Checklist

- [x] `npm test` passes (docs only)
- [x] `npx tsc --noEmit` passes (client) — no code changed
- [x] `npx tsc -p tsconfig.server.json --noEmit` passes (server) — no code changed
- [x] Inline styles only — n/a
- [x] Dark UI only — n/a
- [x] No new comments — n/a

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 3: Wait for CI, merge**

Run: `gh pr checks <N> --watch` → all `pass`. Then `gh pr merge <N> --squash --delete-branch` (the "main is used by worktree" message is harmless — confirm with `gh pr view <N> --json state --jq .state` → `MERGED`).

---

### Task 1: Single source of truth for the version (bump to 1.1.0)

**Files:**
- Modify: `package.json`, `package-lock.json` (via npm), `client/src/version.ts`
- Test: `tests/client/lib/version.test.ts`

**Interfaces:**
- Produces: `APP_VERSION: string` (unchanged name/export, now derived from `package.json`).

- [ ] **Step 0: Create the worktree**

```bash
cd /opt/bacta && git fetch -q origin main
git worktree add -b feature/version-endpoint worktrees/version-endpoint origin/main
cd worktrees/version-endpoint && npm ci --silent
```

- [ ] **Step 1: Write the failing test**

Create `tests/client/lib/version.test.ts`:

```ts
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
```

- [ ] **Step 2: Bump the version so the test fails for the right reason**

```bash
npm version 1.1.0 --no-git-tag-version
npx vitest run --config vitest.client.config.ts tests/client/lib/version.test.ts
```
Expected: FAIL — `expected '1.0.0' to be '1.1.0'` (`version.ts` is still hardcoded).

- [ ] **Step 3: Make `version.ts` read `package.json`**

Replace the contents of `client/src/version.ts` with:

```ts
import { version } from '../../package.json'

export const APP_VERSION: string = version
```

- [ ] **Step 4: Run test, type check, and build**

```bash
npx vitest run --config vitest.client.config.ts tests/client/lib/version.test.ts
npx tsc --noEmit
npm run build:client
grep -l 'better-sqlite3' dist/client/assets/*.js || echo "bundle does not embed package.json deps"
```
Expected: tests PASS; tsc silent; build succeeds; the last line prints `bundle does not embed package.json deps` (named JSON import is tree-shaken to the single version string).

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json client/src/version.ts tests/client/lib/version.test.ts
git commit -m "chore: bump to 1.1.0 and derive APP_VERSION from package.json

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: `GET /api/version`

**Files:**
- Create: `server/api/version.ts`, `tests/server/version.test.ts`
- Modify: `server/index.ts` (mount before `requireAuth` routes, next to `/api/health`), `docs/ARCHITECTURE.md` (route table)

**Interfaces:**
- Produces: `GET /api/version` → `200 { "server": "<package.json version | 'unknown'>", "minApp": "0.1.0" }`, no authentication. Exports `MIN_APP_VERSION = '0.1.0'`.
- Consumed by: Task 7 (Hello World screen).

- [ ] **Step 1: Write the failing tests**

Create `tests/server/version.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import request from 'supertest'
import pkg from '../../package.json'

process.env.DB_PATH = ':memory:'

describe('GET /api/version', () => {
  it('returns the server version and minimum supported app version', async () => {
    const { app } = await import('../../server/index')
    const res = await request(app).get('/api/version')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ server: pkg.version, minApp: '0.1.0' })
  })

  it('needs no authentication, even with a bogus session cookie', async () => {
    const { app } = await import('../../server/index')
    const res = await request(app).get('/api/version').set('Cookie', 'bacta_session=not-a-real-token')
    expect(res.status).toBe(200)
  })

  it('exposes only server and minApp', async () => {
    const { app } = await import('../../server/index')
    const res = await request(app).get('/api/version')
    expect(Object.keys(res.body).sort()).toEqual(['minApp', 'server'])
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/server/version.test.ts`
Expected: FAIL — status `404` (route does not exist).

- [ ] **Step 3: Implement the router**

Create `server/api/version.ts`:

```ts
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
```

- [ ] **Step 4: Mount it before the authenticated routes**

In `server/index.ts` add the import beside the other router imports:

```ts
import versionRouter from './api/version'
```

and mount it directly under the health route (line ~104):

```ts
app.use('/api/health', healthRouter)
app.use('/api/version', versionRouter)
```

- [ ] **Step 5: Run tests, type check, full suite**

```bash
npx vitest run tests/server/version.test.ts
npx tsc -p tsconfig.server.json --noEmit
npm test
```
Expected: version tests PASS (3); tsc silent; full suite green (≥ 975 + 5 new tests).

- [ ] **Step 6: Document the route**

Run `grep -n "/api/health" docs/ARCHITECTURE.md` and add a row directly beneath it in the same table format:

```
| `GET` | `/api/version` | Server version + minimum supported Android app version. **No auth** — the app calls it before login |
```

- [ ] **Step 7: Commit, push, PR, merge, deploy**

```bash
git add server/api/version.ts server/index.ts tests/server/version.test.ts docs/ARCHITECTURE.md
git commit -m "feat: add unauthenticated GET /api/version for app compatibility checks

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
git push -u origin feature/version-endpoint
gh pr create --base main --head feature/version-endpoint --title "feat: bump to 1.1.0, single version source, GET /api/version" --body "<template headings; What: version bump + version.ts from package.json + new endpoint; How to test: npm test, curl /api/version>"
gh pr checks <N> --watch && gh pr merge <N> --squash --delete-branch
```
Then deploy (production checkout is on `main`; `tsx watch` reloads automatically):

```bash
git -C /opt/bacta fetch -q origin main && git -C /opt/bacta merge --ff-only origin/main
sleep 5 && curl -s localhost:3001/api/version
```
Expected: `{"server":"1.1.0","minApp":"0.1.0"}`. (If `merge --ff-only` refuses because of `.claude/settings.local.json`, do Task 4 first or follow its Step 5 procedure.) Rebuild the client so the Settings footer shows 1.1.0: `cd /opt/bacta && npm run build:client`.

---

### Task 3: Nightly database backups (host operation, no PR)

**Files:** none (installs `/etc/systemd/system/bacta-backup.{service,timer}` from the existing `scripts/install-db-backup.sh`)

- [ ] **Step 1: Take a manual backup first**

```bash
node /opt/bacta/scripts/backup-db.js
ls -la /opt/bacta/backups | tail -3
```
Expected: a new `bacta-YYYYMMDDHHMMSS.db.gz`, mode `-rw-------`.

- [ ] **Step 2: Install the timer**

```bash
bash /opt/bacta/scripts/install-db-backup.sh
systemctl list-timers bacta-backup.timer --no-pager
```
Expected: `bacta-backup.timer` listed with NEXT at 03:30 tonight.

- [ ] **Step 3: Run the service once and check the journal**

```bash
sudo systemctl start bacta-backup.service
journalctl -u bacta-backup -n 8 --no-pager
```
Expected: exit status 0 and a "backup written" style line; a newer file in `/opt/bacta/backups`.

- [ ] **Step 4: Prove the backup restores (Review Focus #2)**

```bash
LATEST=$(ls -t /opt/bacta/backups/bacta-*.db.gz | head -1)
gunzip -c "$LATEST" > /tmp/restore-check.db
node -e "
const D=require('/opt/bacta/node_modules/better-sqlite3');
const live=new D('/opt/bacta/data/bacta.db',{readonly:true});
const bak=new D('/tmp/restore-check.db',{readonly:true});
console.log('integrity:',bak.pragma('integrity_check',{simple:true}));
for (const t of ['health_snapshots','health_activities','mx4_chat_messages','app_settings','mx4_briefings']) {
  console.log(t.padEnd(20),'live',live.prepare('SELECT COUNT(*) c FROM '+t).get().c,'backup',bak.prepare('SELECT COUNT(*) c FROM '+t).get().c);
}"
rm -f /tmp/restore-check.db
```
Expected: `integrity: ok`; each table's backup count equals live or is smaller by at most a few rows (the hourly sync can add rows between the two reads). Any other result: stop and investigate before continuing.

- [ ] **Step 5: Record the remaining gap**

The backup lives on the same machine. Tell the owner: an off-box copy is still open (`docs/OPERATIONS.md` §1). The simplest real fix is a scheduled Proxmox backup of LXC 109 — an owner action in the Proxmox UI.

---

### Task 4: Repo hygiene (`.gitignore`, stop tracking local settings)

**Files:**
- Modify: `.gitignore`
- Untrack: `.claude/settings.local.json`

- [ ] **Step 0: Create the worktree**

```bash
cd /opt/bacta && git fetch -q origin main
git worktree add -b chore/android-hygiene worktrees/android-hygiene origin/main
cd worktrees/android-hygiene
```

- [ ] **Step 1: Write the check (fails first)**

```bash
for p in android/app/build/x.apk android/.gradle/x android/local.properties release.jks android/app/src/main/res/mipmap/ic.png; do
  printf '%-50s' "$p"; git check-ignore -q "$p" && echo ignored || echo NOT-ignored
done
git check-ignore -q android/gradle/wrapper/gradle-wrapper.jar && echo "WRAPPER JAR IGNORED (bad)" || echo "wrapper jar tracked (good)"
```
Expected now: the first four print `NOT-ignored` (and the `.png` prints `ignored` because of the global `*.png` rule — the bug we are fixing); the wrapper jar line prints `wrapper jar tracked (good)`.

- [ ] **Step 2: Edit `.gitignore`**

Append:

```
# Android
android/.gradle/
android/**/build/
android/local.properties
android/.idea/
android/captures/
*.jks
*.keystore
*.apk
!android/app/src/**/*.png

# Local Claude Code settings (machine-specific)
.claude/settings.local.json
```

- [ ] **Step 3: Re-run the check**

Re-run the Step 1 loop. Expected: all five print `ignored` except the `.png` under `android/app/src/**`, which must print `NOT-ignored`; the wrapper-jar line still prints `wrapper jar tracked (good)`.

- [ ] **Step 4: Untrack the local settings file (it stays on disk)**

```bash
git rm --cached .claude/settings.local.json
git status --short
```
Expected: `D  .claude/settings.local.json` and ` M .gitignore`.

- [ ] **Step 5: Commit, PR, merge**

```bash
git add .gitignore
git commit -m "chore: ignore Android build output and stop tracking local Claude settings

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
git push -u origin chore/android-hygiene
gh pr create --base main --head chore/android-hygiene --title "chore: Android gitignore rules, untrack local settings" --body "<template headings>"
gh pr checks <N> --watch && gh pr merge <N> --squash --delete-branch
```

- [ ] **Step 6: Pull into production without losing the local file**

Production's `.claude/settings.local.json` has uncommitted edits, so git would refuse to apply a commit that deletes the tracked file. Preserve it:

```bash
cd /opt/bacta
cp .claude/settings.local.json /tmp/settings.local.json.keep
git checkout -- .claude/settings.local.json
git fetch -q origin main && git merge --ff-only origin/main
cp /tmp/settings.local.json.keep .claude/settings.local.json
git status --short
```
Expected: `?? .claude/hooks/` only (the settings file is now ignored). The owner decides separately about the unused `.claude/hooks/gate-pr-merge.py`.

---

### Task 5: Tag `v1.1.0` and clean up merged branches

**Files:** none

- [ ] **Step 1: Confirm the merge commit carries 1.1.0**

```bash
git -C /opt/bacta show origin/main:package.json | grep '"version"'
```
Expected: `"version": "1.1.0"`. Note the commit that introduced it: `git -C /opt/bacta log --oneline -S'"version": "1.1.0"' -- package.json | head -1`.

- [ ] **Step 2: Tag and release (owner approved the tag on 2026-11-02)**

```bash
SHA=$(git -C /opt/bacta log --format=%H -S'"version": "1.1.0"' -- package.json | tail -1)
git -C /opt/bacta tag -a v1.1.0 "$SHA" -m "Bacta v1.1.0"
git -C /opt/bacta push origin v1.1.0
gh release create v1.1.0 --title "Bacta v1.1.0" --notes "Everything since v1.0.0: Nutrition (food variants, recipes, barcode scanning), multi-device wearable integrations (six providers), the August 2026 accessibility/security/logging sweep, 975 passing tests. Baseline before the native Android client work."
```
Verify: `gh release view v1.1.0 --json tagName,name --jq '.tagName+" "+.name'` → `v1.1.0 Bacta v1.1.0`.

- [ ] **Step 3: Produce the cleanup list (read-only)**

```bash
cd /opt/bacta
gh pr list --state merged --limit 300 --json headRefName --jq '.[].headRefName' | sort -u > /tmp/merged-heads.txt
git for-each-ref --format='%(refname:short)' refs/heads/agent refs/heads/feature refs/heads/docs refs/heads/chore | sort > /tmp/local-branches.txt
comm -12 /tmp/merged-heads.txt /tmp/local-branches.txt | tee /tmp/branches-to-delete.txt | wc -l
git worktree list
```

- [ ] **Step 4: Hand the deletions to the owner**

`git branch -D` is denied for Claude. Give the owner this to run, after they skim `/tmp/branches-to-delete.txt`:

```bash
cd /opt/bacta
xargs -a /tmp/branches-to-delete.txt -n1 git branch -D
git worktree prune
```
Worktrees under `worktrees/issue-*` whose branch is in that list can also be removed with `git worktree remove --force worktrees/<name>` (they hold ~513 MB, including a copy of `data/`). Do **not** touch `worktrees/nutrition*` unless their branches appear in the list.

---

### Task 6: `scripts/android-build.sh` (sync / build / adb tooling)

**Files:**
- Create: `scripts/android-build.sh`, `tests/server/androidBuildScript.test.ts`

**Interfaces:**
- Produces (CLI): `scripts/android-build.sh [--dry-run] <cmd> [args]` where `<cmd>` ∈ `sync | build [gradle tasks…] | apk | install <ip:port> | adb <args…> | screenshot <ip:port>`. Env overrides: `ANDROID_VM` (default `wheat@bacta-android`), `ANDROID_REMOTE_BASE` (default `/home/wheat/work`), `ANDROID_PROJECT` (default `bacta-android`), `ANDROID_SRC` (default `<repo>/android`).
- `--dry-run` prints each command it would run, one per line, without executing.

- [ ] **Step 0: Create the worktree**

```bash
cd /opt/bacta && git fetch -q origin main
git worktree add -b feature/android-foundation worktrees/android-foundation origin/main
cd worktrees/android-foundation && npm ci --silent && mkdir -p scripts tests/server
```

- [ ] **Step 1: Write the failing tests**

Create `tests/server/androidBuildScript.test.ts`:

```ts
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
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/server/androidBuildScript.test.ts`
Expected: FAIL — the script does not exist (`bash: …/android-build.sh: No such file`, statuses non-zero where 0 is expected).

- [ ] **Step 3: Write the script**

Create `scripts/android-build.sh`:

```bash
#!/usr/bin/env bash
# Sync android/ to the dev VM and run builds / adb there. One-way: the VM copy is disposable.
set -euo pipefail

VM="${ANDROID_VM:-wheat@bacta-android}"
REMOTE_BASE="${ANDROID_REMOTE_BASE:-/home/wheat/work}"
PROJECT="${ANDROID_PROJECT-bacta-android}"
SSH_OPTS=(-o BatchMode=yes -o ConnectTimeout=8 -o ServerAliveInterval=30)
DRY_RUN=0

die() { echo "android-build: $*" >&2; exit 1; }
usage() { echo "usage: android-build.sh [--dry-run] sync|build [tasks...]|apk|install <ip:port>|adb <args...>|screenshot <ip:port>" >&2; exit 2; }

if [[ "${1:-}" == "--dry-run" ]]; then DRY_RUN=1; shift; fi
CMD="${1:-}"; [[ -n "$CMD" ]] || usage
shift

[[ "$PROJECT" =~ ^[A-Za-z0-9._-]+$ && "$PROJECT" != "." && "$PROJECT" != ".." ]] \
  || die "ANDROID_PROJECT must be a plain directory name (letters, digits, . _ -), got '$PROJECT'"
[[ "$REMOTE_BASE" == /home/*/* ]] \
  || die "ANDROID_REMOTE_BASE must be a directory under a user's home (e.g. /home/wheat/work), got '$REMOTE_BASE'"

SRC="${ANDROID_SRC:-$(git rev-parse --show-toplevel)/android}"
[[ -d "$SRC" ]] || die "source directory not found: $SRC"
REMOTE_DIR="$REMOTE_BASE/$PROJECT"
APK_REMOTE="$REMOTE_DIR/app/build/outputs/apk/debug/app-debug.apk"

run() { if (( DRY_RUN )); then echo "$*"; else "$@"; fi }

do_sync() {
  run ssh "${SSH_OPTS[@]}" "$VM" "mkdir -p '$REMOTE_DIR'"
  run rsync -az --delete --exclude build --exclude .gradle --exclude local.properties --exclude .idea \
    -e "ssh ${SSH_OPTS[*]}" "$SRC/" "$VM:$REMOTE_DIR/"
}

case "$CMD" in
  sync)
    do_sync ;;
  build)
    do_sync
    run ssh "${SSH_OPTS[@]}" "$VM" "cd '$REMOTE_DIR' && ./gradlew --console=plain ${*:-assembleDebug}" ;;
  apk)
    mkdir -p /tmp/bacta-android
    run scp "${SSH_OPTS[@]}" "$VM:$APK_REMOTE" /tmp/bacta-android/ ;;
  install)
    [[ -n "${1:-}" ]] || die "install needs the phone address, e.g. 192.168.1.50:37123"
    run ssh "${SSH_OPTS[@]}" "$VM" "adb -s $1 install -r '$APK_REMOTE'" ;;
  adb)
    run ssh "${SSH_OPTS[@]}" "$VM" adb "$@" ;;
  screenshot)
    [[ -n "${1:-}" ]] || die "screenshot needs the phone address, e.g. 192.168.1.50:37123"
    mkdir -p /tmp/bacta-android
    if (( DRY_RUN )); then echo "ssh $VM adb -s $1 exec-out screencap -p > /tmp/bacta-android/screen.png"
    else ssh "${SSH_OPTS[@]}" "$VM" "adb -s $1 exec-out screencap -p" > /tmp/bacta-android/screen.png; fi ;;
  *)
    usage ;;
esac
```

Note `${ANDROID_PROJECT-bacta-android}` (no colon) is deliberate: an explicitly **empty** `ANDROID_PROJECT` stays empty and is rejected, instead of silently falling back to the default.

Then: `chmod +x scripts/android-build.sh`.

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/server/androidBuildScript.test.ts`
Expected: all PASS (7 tests plus the 6 guard cases).

- [ ] **Step 5: Real end-to-end check against the VM**

```bash
mkdir -p android && echo probe > android/probe.txt
bash scripts/android-build.sh sync
ssh wheat@bacta-android 'cat work/bacta-android/probe.txt && ls work/bacta-android'
rm android/probe.txt && bash scripts/android-build.sh sync
ssh wheat@bacta-android 'ls work/bacta-android'
```
Expected: `probe` is printed after the first sync, and the directory is empty after the second (`--delete` works). Then `ssh wheat@bacta-android 'rm -rf work/bacta-android'` and `rmdir android`.

- [ ] **Step 6: Fail-fast check with the VM unreachable (Review Focus #6)**

```bash
mkdir -p android
time ANDROID_VM=wheat@192.0.2.1 bash scripts/android-build.sh sync; echo "exit=$?"
rmdir android
```
Expected: returns within about 10 seconds with a `Connection timed out` error and `exit=` non-zero — it must not hang.

- [ ] **Step 7: Commit**

```bash
git add scripts/android-build.sh tests/server/androidBuildScript.test.ts
git commit -m "feat: add android-build.sh to sync, build and drive adb on the dev VM

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Hello World Android app (builds on the VM)

**Files (all new under `android/`):**
- `settings.gradle.kts`, `build.gradle.kts`, `gradle.properties`
- `gradlew`, `gradlew.bat`, `gradle/wrapper/gradle-wrapper.jar`, `gradle/wrapper/gradle-wrapper.properties` (generated)
- `app/build.gradle.kts`
- `app/src/main/AndroidManifest.xml`
- `app/src/main/res/xml/network_security_config.xml`
- `app/src/main/java/io/github/bridgemouse/bacta/{BactaColors.kt,ServerVersion.kt,MainActivity.kt}`
- `app/src/test/java/io/github/bridgemouse/bacta/{BactaColorsTest.kt,NetworkSecurityConfigTest.kt}`

**Interfaces:**
- Consumes: `GET /api/version` (Task 2), `scripts/android-build.sh` (Task 6).
- Produces: `BactaColors` (ARGB `Long` constants), `fetchServerVersion(baseUrl: String): Result<ServerVersion>`, a debug APK at `app/build/outputs/apk/debug/app-debug.apk` on the VM.

- [ ] **Step 1: Owner confirms the application id**

Ask the owner to confirm `io.github.bridgemouse.bacta` before any install (it cannot change later without uninstalling). If they want another id, substitute it everywhere in this task and in Task 8.

- [ ] **Step 2: Generate the Gradle wrapper on the VM**

```bash
ssh wheat@bacta-android 'mkdir -p ~/tools && cd ~/tools && curl -sfLO https://services.gradle.org/distributions/gradle-9.8.2-bin.zip && unzip -q -o gradle-9.8.2-bin.zip && rm -rf /tmp/wrapgen && mkdir /tmp/wrapgen && cd /tmp/wrapgen && ~/tools/gradle-9.8.2/bin/gradle wrapper --gradle-version 9.8.2 --distribution-type bin 2>&1 | tail -3'
mkdir -p android/gradle/wrapper
scp wheat@bacta-android:/tmp/wrapgen/gradlew wheat@bacta-android:/tmp/wrapgen/gradlew.bat android/
scp wheat@bacta-android:/tmp/wrapgen/gradle/wrapper/gradle-wrapper.jar wheat@bacta-android:/tmp/wrapgen/gradle/wrapper/gradle-wrapper.properties android/gradle/wrapper/
chmod +x android/gradlew
grep distributionUrl android/gradle/wrapper/gradle-wrapper.properties
```
Expected: `distributionUrl=https\://services.gradle.org/distributions/gradle-9.8.2-bin.zip`.

- [ ] **Step 3: Write the failing tests first**

Create `android/app/src/test/java/io/github/bridgemouse/bacta/BactaColorsTest.kt`:

```kotlin
package io.github.bridgemouse.bacta

import org.junit.Assert.assertEquals
import org.junit.Test

class BactaColorsTest {
    @Test
    fun matchesTheDesignSystemTokens() {
        assertEquals(0xFF0F1117L, BactaColors.Base)
        assertEquals(0xFF111827L, BactaColors.Surface)
        assertEquals(0xFF1E2D3DL, BactaColors.SurfaceElevated)
        assertEquals(0xFF27384AL, BactaColors.Line)
        assertEquals(0xFFF4F7FBL, BactaColors.Text)
        assertEquals(0xFF94A3B8L, BactaColors.TextSecondary)
        assertEquals(0xFF56657AL, BactaColors.TextMuted)
        assertEquals(0xFF2BC4E8L, BactaColors.Mx4)
        assertEquals(0xFF4ADE80L, BactaColors.Positive)
        assertEquals(0xFFFBBF24L, BactaColors.Caution)
        assertEquals(0xFFF87171L, BactaColors.Flag)
    }

    @Test
    fun sectionAccentsAreTheLockedValues() {
        assertEquals(0xFF2BC4E8L, BactaColors.Section.Home)
        assertEquals(0xFF64B5F6L, BactaColors.Section.Recovery)
        assertEquals(0xFFFB923CL, BactaColors.Section.Training)
        assertEquals(0xFFA78BFAL, BactaColors.Section.Sleep)
        assertEquals(0xFF3ECF8EL, BactaColors.Section.Nutrition)
        assertEquals(0xFFEF6F6CL, BactaColors.Section.Bloodwork)
        assertEquals(0xFFF5CF5EL, BactaColors.Section.DailyLog)
    }
}
```

Create `android/app/src/test/java/io/github/bridgemouse/bacta/NetworkSecurityConfigTest.kt`:

```kotlin
package io.github.bridgemouse.bacta

import java.io.File
import javax.xml.parsers.DocumentBuilderFactory
import org.junit.Assert.assertEquals
import org.junit.Test

class NetworkSecurityConfigTest {
    private val doc = DocumentBuilderFactory.newInstance().newDocumentBuilder()
        .parse(File("src/main/res/xml/network_security_config.xml"))

    @Test
    fun cleartextIsForbiddenByDefault() {
        val base = doc.getElementsByTagName("base-config").item(0)
        assertEquals("false", base.attributes.getNamedItem("cleartextTrafficPermitted").nodeValue)
    }

    @Test
    fun cleartextIsAllowedOnlyForTheBactaServerHosts() {
        val domainConfigs = doc.getElementsByTagName("domain-config")
        assertEquals(1, domainConfigs.length)
        assertEquals("true", domainConfigs.item(0).attributes.getNamedItem("cleartextTrafficPermitted").nodeValue)
        val domains = doc.getElementsByTagName("domain")
        val hosts = (0 until domains.length).map { domains.item(it).textContent.trim() }.toSet()
        assertEquals(setOf("bacta.home", "192.168.1.119"), hosts)
    }
}
```

- [ ] **Step 4: Gradle build files**

`android/settings.gradle.kts`:

```kotlin
pluginManagement {
    repositories {
        google {
            content {
                includeGroupByRegex("com\\.android.*")
                includeGroupByRegex("com\\.google.*")
                includeGroupByRegex("androidx.*")
            }
        }
        mavenCentral()
        gradlePluginPortal()
    }
}

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}

rootProject.name = "bacta-android"
include(":app")
```

`android/build.gradle.kts`:

```kotlin
plugins {
    id("com.android.application") version "9.5.0" apply false
    id("org.jetbrains.kotlin.plugin.compose") version "2.4.21" apply false
}
```

`android/gradle.properties`:

```properties
org.gradle.jvmargs=-Xmx3g -Dfile.encoding=UTF-8
org.gradle.caching=true
```

`android/app/build.gradle.kts`:

```kotlin
plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.plugin.compose")
}

android {
    namespace = "io.github.bridgemouse.bacta"
    compileSdk = 37

    defaultConfig {
        applicationId = "io.github.bridgemouse.bacta"
        minSdk = 34
        targetSdk = 37
        versionCode = (project.findProperty("bacta.versionCode") as String?)?.toInt() ?: 1
        versionName = (project.findProperty("bacta.versionName") as String?) ?: "0.0.1"
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

dependencies {
    implementation(platform("androidx.compose:compose-bom:2026.09.00"))
    implementation("androidx.activity:activity-compose:1.13.0")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.foundation:foundation")

    testImplementation("junit:junit:4.13.2")
}
```

- [ ] **Step 5: Run the tests to see them fail**

```bash
bash scripts/android-build.sh build testDebugUnitTest
```
Expected: FAIL — `Unresolved reference: BactaColors` (and the missing `network_security_config.xml`). The first run also downloads dependencies and takes several minutes. If the failure is instead a **configuration** error, apply the matching fix and re-run:

| Error contains | Fix |
|---|---|
| `Failed to find target with hash string 'android-37'` | replace `compileSdk = 37` with `compileSdk { version = release(37) }` |
| `android.useAndroidX` / "AndroidX dependencies" | add `android.useAndroidX=true` to `gradle.properties` |
| `Minimum supported Gradle version is X` | set the wrapper to X (`gradle-wrapper.properties`) — Step 2 with `--gradle-version X` |
| `kotlin` plugin version / Compose compiler mismatch | align `org.jetbrains.kotlin.plugin.compose` to the Kotlin version named in the error |
| `Unresolved reference: kotlinx` | add `implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:<latest from Maven Central>")` |

- [ ] **Step 6: Implement the sources**

`android/app/src/main/java/io/github/bridgemouse/bacta/BactaColors.kt`:

```kotlin
package io.github.bridgemouse.bacta

object BactaColors {
    const val Base = 0xFF0F1117L
    const val Surface = 0xFF111827L
    const val SurfaceElevated = 0xFF1E2D3DL
    const val Line = 0xFF27384AL
    const val Text = 0xFFF4F7FBL
    const val TextSecondary = 0xFF94A3B8L
    const val TextMuted = 0xFF56657AL
    const val Mx4 = 0xFF2BC4E8L
    const val Positive = 0xFF4ADE80L
    const val Caution = 0xFFFBBF24L
    const val Flag = 0xFFF87171L

    object Section {
        const val Home = 0xFF2BC4E8L
        const val Recovery = 0xFF64B5F6L
        const val Training = 0xFFFB923CL
        const val Sleep = 0xFFA78BFAL
        const val Nutrition = 0xFF3ECF8EL
        const val Bloodwork = 0xFFEF6F6CL
        const val DailyLog = 0xFFF5CF5EL
    }
}
```

`android/app/src/main/res/xml/network_security_config.xml`:

```xml
<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <base-config cleartextTrafficPermitted="false" />
    <domain-config cleartextTrafficPermitted="true">
        <domain includeSubdomains="false">bacta.home</domain>
        <domain includeSubdomains="false">192.168.1.119</domain>
    </domain-config>
</network-security-config>
```

`android/app/src/main/AndroidManifest.xml`:

```xml
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">

    <uses-permission android:name="android.permission.INTERNET" />

    <application
        android:allowBackup="false"
        android:label="Bacta"
        android:networkSecurityConfig="@xml/network_security_config"
        android:theme="@android:style/Theme.Material.NoActionBar">
        <activity
            android:name=".MainActivity"
            android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>

</manifest>
```

`android/app/src/main/java/io/github/bridgemouse/bacta/ServerVersion.kt`:

```kotlin
package io.github.bridgemouse.bacta

import java.net.HttpURLConnection
import java.net.URL
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject

data class ServerVersion(val server: String, val minApp: String)

suspend fun fetchServerVersion(baseUrl: String): Result<ServerVersion> = withContext(Dispatchers.IO) {
    runCatching {
        val conn = URL("$baseUrl/api/version").openConnection() as HttpURLConnection
        try {
            conn.connectTimeout = 5000
            conn.readTimeout = 5000
            val json = JSONObject(conn.inputStream.bufferedReader().use { it.readText() })
            ServerVersion(json.getString("server"), json.getString("minApp"))
        } finally {
            conn.disconnect()
        }
    }
}
```

`android/app/src/main/java/io/github/bridgemouse/bacta/MainActivity.kt`:

```kotlin
package io.github.bridgemouse.bacta

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

private val BASE_URLS = listOf("http://bacta.home", "http://192.168.1.119:3001")

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent { HelloScreen() }
    }
}

@Composable
private fun HelloScreen() {
    var status by remember { mutableStateOf("contacting server…") }

    LaunchedEffect(Unit) {
        status = "no server reachable"
        for (url in BASE_URLS) {
            val result = fetchServerVersion(url)
            val v = result.getOrNull()
            if (v != null) {
                status = "server ${v.server} · min app ${v.minApp}\nvia $url"
                break
            }
            status = "no server reachable\n${result.exceptionOrNull()?.javaClass?.simpleName}: ${result.exceptionOrNull()?.message}"
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(BactaColors.Base))
            .padding(24.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text("BACTA·OS", color = Color(BactaColors.Mx4), fontFamily = FontFamily.Monospace, fontSize = 28.sp)
        Text("android ${BuildConfig.VERSION_NAME}", color = Color(BactaColors.TextMuted), fontFamily = FontFamily.Monospace, fontSize = 12.sp)
        Text(status, color = Color(BactaColors.TextSecondary), fontFamily = FontFamily.Monospace, fontSize = 14.sp, modifier = Modifier.padding(top = 24.dp))
    }
}
```

- [ ] **Step 7: Run tests and assemble**

```bash
bash scripts/android-build.sh build testDebugUnitTest assembleDebug
```
Expected: `BUILD SUCCESSFUL`; 4 unit tests pass (2 colors, 2 network-security-config). Then:

```bash
ssh wheat@bacta-android 'ls -la work/bacta-android/app/build/outputs/apk/debug/app-debug.apk'
```
Expected: the APK exists (a few MB).

- [ ] **Step 8: Commit**

```bash
git add android
git commit -m "feat(android): Hello World Compose app, design-token colors, cleartext limited to Bacta hosts

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 8: First install on the owner's Fold (verification, no code)

**Files:** none. Requires the owner and the phone on the home Wi-Fi, with the dev VM running and WinVM 110 down.

- [ ] **Step 1: Owner prepares the phone**

On the phone: Settings → About phone → tap *Build number* 7 times → Developer options → enable **Wireless debugging** → *Pair device with pairing code*. Note the IP address, the **pairing port**, the **pairing code**, and (on the main Wireless debugging screen) the **connect port**.

- [ ] **Step 2: Pair and connect by address**

```bash
bash scripts/android-build.sh adb pair <phone-ip>:<pairing-port> <pairing-code>
bash scripts/android-build.sh adb connect <phone-ip>:<connect-port>
bash scripts/android-build.sh adb devices
```
Expected: `Successfully paired…`, `connected to …`, and the device listed as `device` (not `unauthorized`/`offline`). If connect times out, check that the phone and the VM are on the same subnet and that the router does not isolate Wi-Fi clients.

- [ ] **Step 3: Install and launch**

```bash
bash scripts/android-build.sh install <phone-ip>:<connect-port>
bash scripts/android-build.sh adb -s <phone-ip>:<connect-port> shell am start -n io.github.bridgemouse.bacta/.MainActivity
bash scripts/android-build.sh screenshot <phone-ip>:<connect-port>
```
Expected: `Success` from the install; open `/tmp/bacta-android/screen.png` with the Read tool.

- [ ] **Step 4: Check the screen**

The screenshot must show `BACTA·OS` in cyan on a near-black background, `android 0.0.1`, and `server 1.1.0 · min app 0.1.0` with `via http://bacta.home` (or `via http://192.168.1.119:3001`). That one screen proves the whole pipeline: toolchain → VM build → `adb` → phone → cleartext network config → live `/api/version`.

- [ ] **Step 5: Failure triage**

| Symptom | Likely cause / action |
|---|---|
| `no server reachable` + `UnknownHostException` | the phone's DNS does not resolve `bacta.home`; the IP fallback should still work — if both fail, check the phone is on the home Wi-Fi |
| `…Cleartext HTTP traffic … not permitted` | the host is not in `network_security_config.xml`; check the exact host string |
| Server shows `unknown` | `/api/version` could not read `package.json`; check the service's working directory |
| App not listed after install | `adb shell pm list packages \| grep bacta` and re-run Step 3 |

- [ ] **Step 6: Record it**

Add a line to the memory file `project_nov1_status_debrief.md` that the first on-device install succeeded and with which phone address style worked.

---

### Task 9: Android CI

**Files:**
- Create: `.github/workflows/android.yml`

- [ ] **Step 1: Verify the action versions before pinning**

```bash
for r in actions/checkout actions/setup-java android-actions/setup-android gradle/actions; do
  printf '%-32s' $r; gh api repos/$r/releases/latest --jq .tag_name
done
```
Use the **major** of each result (e.g. `v4`, `v3`) in the file below; replace the majors shown here if they differ.

- [ ] **Step 2: Write the workflow**

```yaml
name: Android CI

on:
  push:
    paths:
      - 'android/**'
      - '.github/workflows/android.yml'
  pull_request:
    paths:
      - 'android/**'
      - '.github/workflows/android.yml'

jobs:
  build:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: android
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-java@v4
        with:
          distribution: temurin
          java-version: '17'

      - uses: android-actions/setup-android@v3

      - name: Install SDK platform and build-tools
        run: sdkmanager "platforms;android-37.0" "build-tools;37.0.0"

      - uses: gradle/actions/setup-gradle@v4

      - name: Unit tests and debug build
        run: ./gradlew --console=plain testDebugUnitTest assembleDebug
```

This job is deliberately **not** a required status check (a required, path-filtered check would block PRs that never touch `android/`).

- [ ] **Step 3: Validate the YAML locally**

Run: `python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/android.yml')); print('yaml ok')"` → `yaml ok`.

- [ ] **Step 4: Commit, push, PR; prove it runs**

```bash
git add .github/workflows/android.yml
git commit -m "ci: add path-filtered Android CI (unit tests + debug build)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
git push -u origin feature/android-foundation
gh pr create --base main --head feature/android-foundation --title "feat(android): build tooling, Hello World app and CI" --body "<template headings: What = script + Hello World + CI; How to test = bash scripts/android-build.sh build testDebugUnitTest assembleDebug, and the on-device screenshot from Task 8>"
gh pr checks <N> --watch
```
Expected: both `test` (existing) and `build` (Android CI) report `pass`. If `build` fails on the SDK install, read the log with `gh run view --log-failed` and fix the `sdkmanager` ids (they must match the VM's `android-37.0` / `37.0.0`). Merge with `gh pr merge <N> --squash --delete-branch` only after both are green.

---

### Task 10: Version script, signing, and tag-triggered release

**Files:**
- Create: `scripts/android-version.sh`, `tests/server/androidVersion.test.ts`, `scripts/android-keygen.sh`, `.github/workflows/android-release.yml`
- Modify: `android/app/build.gradle.kts` (signing config)

**Interfaces:**
- Produces: `scripts/android-version.sh <tag>` → prints `"<versionName> <versionCode>"` (e.g. `0.1.0 100`) and exits non-zero on a bad tag. Gradle properties `bacta.versionName` / `bacta.versionCode` (already read in Task 7). GitHub secrets `BACTA_KEYSTORE_B64`, `BACTA_KEYSTORE_PASSWORD`, `BACTA_KEY_ALIAS`, `BACTA_KEY_PASSWORD`.

- [ ] **Step 0: Worktree**

```bash
cd /opt/bacta && git fetch -q origin main
git worktree add -b feature/android-release worktrees/android-release origin/main
cd worktrees/android-release && npm ci --silent
```

- [ ] **Step 1: Write the failing tests**

Create `tests/server/androidVersion.test.ts`:

```ts
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
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/server/androidVersion.test.ts`
Expected: FAIL — script missing.

- [ ] **Step 3: Implement**

Create `scripts/android-version.sh`:

```bash
#!/usr/bin/env bash
# android-version.sh android-vMAJOR.MINOR.PATCH -> "MAJOR.MINOR.PATCH versionCode"
# versionCode = major*10000 + minor*100 + patch, so minor and patch must stay <= 99
# (1.0.100 would otherwise equal 1.1.0).
set -euo pipefail

tag="${1:-}"
if [[ ! "$tag" =~ ^android-v([0-9]+)\.([0-9]+)\.([0-9]+)$ ]]; then
  echo "android-version: tag must look like android-vMAJOR.MINOR.PATCH, got '$tag'" >&2
  exit 1
fi

major=$((10#${BASH_REMATCH[1]}))
minor=$((10#${BASH_REMATCH[2]}))
patch=$((10#${BASH_REMATCH[3]}))

if (( minor > 99 || patch > 99 || major > 999 )); then
  echo "android-version: major must be <= 999 and minor/patch <= 99 (versionCode would collide), got '$tag'" >&2
  exit 1
fi

echo "$major.$minor.$patch $(( major * 10000 + minor * 100 + patch ))"
```

`chmod +x scripts/android-version.sh`, then run `npx vitest run tests/server/androidVersion.test.ts` → all PASS.

- [ ] **Step 4: Signing config in Gradle**

In `android/app/build.gradle.kts`, inside `android { … }` add:

```kotlin
    signingConfigs {
        create("release") {
            val keystorePath = System.getenv("BACTA_KEYSTORE_PATH")
            if (keystorePath != null) {
                storeFile = file(keystorePath)
                storePassword = System.getenv("BACTA_KEYSTORE_PASSWORD")
                keyAlias = System.getenv("BACTA_KEY_ALIAS")
                keyPassword = System.getenv("BACTA_KEY_PASSWORD")
            }
        }
    }

    buildTypes {
        release {
            if (System.getenv("BACTA_KEYSTORE_PATH") != null) {
                signingConfig = signingConfigs.getByName("release")
            }
        }
    }
```

Verify it still builds on the VM: `bash scripts/android-build.sh build testDebugUnitTest assembleDebug` → `BUILD SUCCESSFUL`.

- [ ] **Step 5: Key-creation script (owner runs it, so the password never passes through chat)**

Create `scripts/android-keygen.sh`:

```bash
#!/usr/bin/env bash
# Owner-run, once. Creates the Android release signing key on the dev VM, moves it to
# ~/secrets on this machine, stores it as GitHub secrets, and prints the password ONCE.
set -euo pipefail

VM="${ANDROID_VM:-wheat@bacta-android}"
KEYSTORE="$HOME/secrets/bacta-release.jks"

[[ ! -e "$KEYSTORE" ]] || { echo "android-keygen: $KEYSTORE already exists; refusing to overwrite" >&2; exit 1; }

PASS="$(openssl rand -base64 24 | tr -d '/+=')"
mkdir -p "$HOME/secrets" && chmod 700 "$HOME/secrets"

ssh "$VM" "keytool -genkeypair -keystore /tmp/bacta-release.jks -alias bacta -keyalg RSA -keysize 4096 -validity 10000 -storepass '$PASS' -keypass '$PASS' -dname 'CN=Bacta, O=bridgemouse'" >/dev/null
scp "$VM:/tmp/bacta-release.jks" "$KEYSTORE" >/dev/null
ssh "$VM" 'rm -f /tmp/bacta-release.jks'
chmod 600 "$KEYSTORE"

base64 -w0 "$KEYSTORE" | gh secret set BACTA_KEYSTORE_B64
printf %s "$PASS"  | gh secret set BACTA_KEYSTORE_PASSWORD
printf %s "$PASS"  | gh secret set BACTA_KEY_PASSWORD
printf %s bacta    | gh secret set BACTA_KEY_ALIAS

echo
echo "Release key created: $KEYSTORE"
echo "PASSWORD (shown once — save it in your password manager now): $PASS"
echo "ALSO copy $KEYSTORE to a second place off this machine. If both are lost, installed apps must be uninstalled before a new key can be used."
```

`chmod +x scripts/android-keygen.sh`; validate syntax: `bash -n scripts/android-keygen.sh && echo syntax ok`.

- [ ] **Step 6: Owner runs the key script**

Ask the owner to run `bash scripts/android-keygen.sh` themselves, save the password, and make the second copy of the `.jks`. Then verify the secrets exist (names only): `gh secret list` → shows the four `BACTA_*` names.

- [ ] **Step 7: Release workflow**

Create `.github/workflows/android-release.yml` (use the action majors confirmed in Task 9 Step 1):

```yaml
name: Android Release

on:
  push:
    tags:
      - 'android-v*'

permissions:
  contents: write

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-java@v4
        with:
          distribution: temurin
          java-version: '17'

      - uses: android-actions/setup-android@v3

      - name: Install SDK platform and build-tools
        run: sdkmanager "platforms;android-37.0" "build-tools;37.0.0"

      - uses: gradle/actions/setup-gradle@v4

      - name: Compute version from tag
        id: ver
        run: |
          read -r NAME CODE < <(bash scripts/android-version.sh "$GITHUB_REF_NAME")
          echo "name=$NAME" >> "$GITHUB_OUTPUT"
          echo "code=$CODE" >> "$GITHUB_OUTPUT"

      - name: Decode signing key
        run: echo "${{ secrets.BACTA_KEYSTORE_B64 }}" | base64 -d > "$RUNNER_TEMP/bacta-release.jks"

      - name: Build signed release APK
        working-directory: android
        env:
          BACTA_KEYSTORE_PATH: ${{ runner.temp }}/bacta-release.jks
          BACTA_KEYSTORE_PASSWORD: ${{ secrets.BACTA_KEYSTORE_PASSWORD }}
          BACTA_KEY_ALIAS: ${{ secrets.BACTA_KEY_ALIAS }}
          BACTA_KEY_PASSWORD: ${{ secrets.BACTA_KEY_PASSWORD }}
        run: ./gradlew --console=plain testDebugUnitTest assembleRelease -Pbacta.versionName=${{ steps.ver.outputs.name }} -Pbacta.versionCode=${{ steps.ver.outputs.code }}

      - name: Verify the APK is signed
        run: $ANDROID_HOME/build-tools/37.0.0/apksigner verify --print-certs android/app/build/outputs/apk/release/app-release.apk

      - name: Publish GitHub Release
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          cp android/app/build/outputs/apk/release/app-release.apk "bacta-android-${{ steps.ver.outputs.name }}.apk"
          gh release create "$GITHUB_REF_NAME" "bacta-android-${{ steps.ver.outputs.name }}.apk" \
            --title "Bacta Android ${{ steps.ver.outputs.name }}" \
            --notes "Signed release build. Install over an existing release build; a debug-signed install must be uninstalled first (different signing key)." \
            --prerelease
```

Validate: `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/android-release.yml')); print('yaml ok')"`.

- [ ] **Step 8: Commit, PR, merge**

```bash
git add scripts/android-version.sh scripts/android-keygen.sh tests/server/androidVersion.test.ts android/app/build.gradle.kts .github/workflows/android-release.yml
git commit -m "feat(android): tag-driven signed releases and version script

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
git push -u origin feature/android-release
gh pr create --base main --head feature/android-release --title "feat(android): signed release pipeline" --body "<template headings>"
gh pr checks <N> --watch && gh pr merge <N> --squash --delete-branch
```

- [ ] **Step 9: Prove a tagged build publishes an APK**

```bash
git -C /opt/bacta fetch -q origin main
SHA=$(git -C /opt/bacta rev-parse origin/main)
git -C /opt/bacta tag -a android-v0.0.1 "$SHA" -m "Android Hello World release pipeline test"
git -C /opt/bacta push origin android-v0.0.1
gh run watch "$(gh run list --workflow android-release.yml --limit 1 --json databaseId --jq '.[0].databaseId')"
gh release view android-v0.0.1 --json assets --jq '.assets[].name'
```
Expected: the run completes `success`; the release lists `bacta-android-0.0.1.apk`. Download it and confirm the signature on the VM: `gh release download android-v0.0.1 -p '*.apk' -D /tmp/rel && scp /tmp/rel/*.apk wheat@bacta-android:/tmp/ && ssh wheat@bacta-android '/opt/android-sdk/build-tools/37.0.0/apksigner verify --print-certs /tmp/bacta-android-0.0.1.apk | head -3'`. **Do not install this release APK over the debug build** (different signing key) — uninstall the debug app first if the owner wants to test the release install.

---

## Self-Review

**Spec coverage** (spec §11 phases A–D → tasks):

| Spec item | Task |
|---|---|
| A: doc edits via PR | done before this plan (PR #228); spec + plan land in Task 0 |
| A: clean stale branches/worktrees | Task 5 (owner-run deletions) |
| A: backup timer | Task 3 |
| A: tag `v1.1.0` + fix `version.ts` | Tasks 1, 5 |
| B: `GET /api/version` | Task 2 |
| C: toolchain + `android-build.sh` | VM done by the owner's agent (verified 2026-11-02); script in Task 6 |
| D: Hello World on the Fold | Tasks 7, 8 |
| D: Android CI + signing key | Tasks 9, 10 |
| §5: `.gitignore` entries, Android CI not a required check | Tasks 4, 9 |
| §4: versionCode formula | Task 10 (with the collision guard the spec missed) |
| §7: cleartext limited to the Bacta host | Task 7 |
| MX-4 revival | deliberately excluded (owner decision) |

**Placeholder scan:** the only angle-bracket placeholders left are runtime values the executor must substitute (`<N>` PR number, `<phone-ip>`, ports, pairing code) and the PR bodies marked `<template headings…>`, which must be filled in from `.github/pull_request_template.md` exactly as in Task 0 Step 2.

**Type / name consistency:** `BactaColors` constants are `Long` and compared with `L` literals in tests; `Color(BactaColors.X)` accepts `Long`. `fetchServerVersion` / `ServerVersion` names match between `ServerVersion.kt` and `MainActivity.kt`. Gradle properties `bacta.versionName` / `bacta.versionCode` are read in Task 7 and passed in Task 10. Script commands (`sync|build|apk|install|adb|screenshot`) match between Task 6 and its callers in Tasks 7–8. `MainActivity` reads the version from the generated `BuildConfig.VERSION_NAME` (enabled by `buildConfig = true` in Task 7 Step 4).

**Review Focus coverage:** items 1–6 each map to a test or explicit check (Tasks 2, 3, 6, 7, 10, and Task 6 Step 6).
