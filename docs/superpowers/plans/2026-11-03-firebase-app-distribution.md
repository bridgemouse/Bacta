# Firebase App Distribution Release Channel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every `android-v*` tag publishes the signed APK to the owner's phone through Firebase App Distribution (email invite, then a "new build" email per release), replacing the planned GitHub-Releases-plus-Obtainium channel. GitHub Releases stays as the permanent archive.

**Architecture:** The existing `android-release.yml` already builds and publishes a signed APK. After the GitHub Release step, new shell scripts build release notes from git history and call the Firebase CLI (`appdistribution:distribute`) authenticated with Application Default Credentials from a service account. The scripts are testable in vitest like `android-build.sh`; the console setup and the secrets are owner-run.

**Tech Stack:** bash + vitest (script tests), Firebase CLI `firebase-tools@15.34.2` (Node >= 20), `google-github-actions/auth@v3`, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-11-02-android-native-app-design.md` (this plan amends §1, §3, §4, §6, §12 in Task 4). Builds on `docs/superpowers/plans/2026-11-02-android-foundation.md`.

## Decisions (made with the owner on 2026-11-03, all from Google/Firebase docs read that day)

- **Channel:** Firebase App Distribution. Free: the Firebase pricing page lists it as "No-cost" on Spark with "No payment method needed". Limits: 500 testers/project, 200/group, 1,000 releases/app; builds are kept 150 days; invitations must be accepted within 30 days.
- **Email-only for now.** No Firebase SDK in the app (it would add Firebase/Play-services dependencies to a health app). In-app update prompts can be a later plan.
- **CLI, not the Gradle plugin:** leaves `android/app/build.gradle.kts` (AGP 9.5.0) untouched; Google recommends fastlane or Gradle but also documents the CLI.
- **Auth:** Google's CLI page recommends Application Default Credentials for CI and calls the `login:ci` token "Legacy… no longer recommended". We use a service account JSON key in a GitHub secret through `google-github-actions/auth@v3` (`credentials_json`; the action exports `GOOGLE_APPLICATION_CREDENTIALS`). Workload identity federation is a later hardening (same action, different inputs).
- **Re-uploading:** Firebase's docs don't say whether a duplicate version is accepted, so every upload carries a new, higher `versionCode` (already enforced by `android-version.sh`).
- **Dev builds** stay on `adb` (Task 6, optional): a `.debug` application id so dev and release apps can coexist.

## Global Constraints

- Firebase app is registered with package name `io.github.bridgemouse.bacta` (Firebase: "case-sensitive and cannot be changed… after it's registered").
- Tester group alias: `owner`. GitHub secrets: `FIREBASE_SERVICE_ACCOUNT` (full JSON key), `FIREBASE_APP_ID` (`1:<digits>:android:<hex>`). The owner sets them; **never paste a key or secret into chat**.
- Service account role: **Firebase App Distribution Admin** ("grants administrator access to App Distribution": treat the key as sensitive).
- The Firebase step must never fail or undo a release: it runs **after** "Publish GitHub Release" and is skipped (not failed) when the secrets are absent.
- Scripts never print credentials, the key path's contents, or run with `set -x`.
- Claude cannot create public tags/releases (auto-mode classifier): the owner pushes `android-vX.Y.Z` tags. `git branch -D` is denied for Claude.
- Commit messages end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`; PR bodies follow `.github/pull_request_template.md` headings and end with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`. Squash-merge; never commit to `main`; never check out a branch in `/opt/bacta` (use `worktrees/<name>`).
- **Device rule:** before anything that foregrounds an app on the Fold, tell the owner what you need and wait for "go" (they read this session on that phone).
- Action majors verified 2026-11-02/03: `actions/checkout@v7`, `google-github-actions/auth@v3`.

## Review Focus

1. **Missing Firebase secrets** (forks, first run, key rotated): the release must still succeed and say the Firebase step was skipped. (Task 3 test; Task 4 workflow guard.)
2. **Shallow checkout:** `actions/checkout` defaults to depth 1, so "commits since the previous tag" would be empty or wrong. (Task 4 guard test: `fetch-depth: 0`.)
3. **Credential leakage:** no script output or error may contain the key's contents. (Task 1 and Task 3 tests plant a marker string in a fake key file.)
4. **First tag ever / no previous `android-v*` tag, or a tag with no Android commits:** release notes must still be valid, non-empty text. (Task 2 tests.)
5. **Firebase failing after the GitHub Release exists:** the run goes red but the release and APK remain; ordering is pinned by a test. (Task 4.)

## File Structure

| File | Responsibility |
|---|---|
| `scripts/firebase-secrets.sh` | Owner-run: validate a service-account key and App ID, set the two GitHub secrets |
| `scripts/android-release-notes.sh` | Print release notes for a tag from git history |
| `scripts/firebase-distribute.sh` | Gate on credentials, validate inputs, run the Firebase CLI |
| `tests/server/firebaseSecrets.test.ts`, `androidReleaseNotes.test.ts`, `firebaseDistribute.test.ts`, `androidReleaseWorkflow.test.ts` | Vitest coverage for the above |
| `.github/workflows/android-release.yml` | Full-history checkout; auth + distribute steps after the GitHub Release |
| `docs/OPERATIONS.md`, spec | Runbook; replace the Obtainium channel |
| `android/app/build.gradle.kts`, test (Task 6, optional) | `.debug` application id |

## Branch / PR plan

| Branch (`worktrees/<name>`) | Tasks |
|---|---|
| `docs/firebase-plan` | 0 |
| *(owner, console + shell)* | 1 (setup) |
| `feature/firebase-distribution` | 1 (script), 2, 3, 4 |
| *(owner tag + phone)* | 5 |
| `chore/android-dev-variant` | 6 (optional) |

---

### Task 0: Land this plan

**Files:** this file.

- [ ] **Step 1:** In `worktrees/firebase-plan`, rebase on `origin/main`, push `docs/firebase-plan`, open a docs-only PR titled `docs: Firebase App Distribution release channel plan` (template headings), wait for CI, squash-merge.

---

### Task 1: Owner setup and the secrets script

**Files:**
- Create: `scripts/firebase-secrets.sh`
- Test: `tests/server/firebaseSecrets.test.ts`

**Interfaces:**
- Produces (CLI): `scripts/firebase-secrets.sh [--dry-run] <service-account.json> <app-id>`; `--dry-run` prints one `gh secret set <NAME>` line per secret and never reads the key into output. Sets `FIREBASE_SERVICE_ACCOUNT` (file contents) and `FIREBASE_APP_ID`.
- Consumed by: Task 3/4 (secret names).

- [ ] **Step 0: Worktree** `git worktree add -b feature/firebase-distribution worktrees/firebase-distribution origin/main && cd worktrees/firebase-distribution && npm ci --silent`

- [ ] **Step 1: Owner does the console setup** (Claude walks through it and waits; nothing here is automated):
  1. console.firebase.google.com → Add project (name `Bacta`), no Google Analytics, stay on the Spark plan.
  2. Project settings → Add app → Android → package name exactly `io.github.bridgemouse.bacta`, nickname `Bacta`. Skip downloading `google-services.json` (not needed without the SDK).
  3. Release & Monitor → App Distribution → Get started → Testers & Groups → create group alias `owner`, add the owner's Google email.
  4. Project settings → General → copy the App ID (`1:…:android:…`).
  5. Google Cloud console (same project) → IAM & Admin → Service Accounts → Create `bacta-ci-distribution`, grant **Firebase App Distribution Admin**, Keys → Add key → JSON. Move the file to `~/secrets/firebase-sa.json`, `chmod 600`.
  6. If the first upload later fails citing a disabled API, enable "Firebase App Distribution API" from the link in the error.

- [ ] **Step 2: Write the failing tests** in `tests/server/firebaseSecrets.test.ts` (helper `run(args, env)` spawns `bash scripts/firebase-secrets.sh`; fixtures live in a temp dir; the valid fixture is `{"type":"service_account","private_key":"MARKER-DO-NOT-LEAK"}`):
  - `'--dry-run prints both secret names and exits 0'` — stdout contains `gh secret set FIREBASE_SERVICE_ACCOUNT` and `gh secret set FIREBASE_APP_ID`.
  - `'never prints the key contents'` — neither stdout nor stderr contains `MARKER-DO-NOT-LEAK`, for success and for failure runs.
  - `it.each` refusals (status != 0, stdout `''`, stderr contains `firebase-secrets:`): missing key file; file that is not JSON; JSON whose `type` is not `service_account`; app id `abc`; app id `1:123:ios:abc`; missing arguments.
  - Accepts app id `1:1234567890:android:0a1b2c3d4e5f67890`.

- [ ] **Step 3: Run:** `npx vitest run tests/server/firebaseSecrets.test.ts` → FAIL (script missing).

- [ ] **Step 4: Implement `scripts/firebase-secrets.sh`.** Validate in this order (each failure: message prefixed `firebase-secrets:` on stderr, exit 1, nothing on stdout): argument count, key file readable, JSON parses with `type == "service_account"` (use `node -e`; never echo parsed values), app id matches `^1:[0-9]+:android:[0-9a-f]+$`. Then `gh secret set FIREBASE_SERVICE_ACCOUNT < "$key"` and `gh secret set FIREBASE_APP_ID --body "$id"` (print the command lines instead when `--dry-run`). `chmod +x`.

- [ ] **Step 5: Run the tests** → all PASS; `bash -n scripts/firebase-secrets.sh`.

- [ ] **Step 6: Commit** `feat: add firebase-secrets.sh to validate and store Firebase CI secrets`.

- [ ] **Step 7: Owner runs it:** `bash scripts/firebase-secrets.sh ~/secrets/firebase-sa.json <APP_ID>`, then `gh secret list` shows `FIREBASE_SERVICE_ACCOUNT` and `FIREBASE_APP_ID`. A key can always be re-created, so the owner may delete the local file afterwards.

---

### Task 2: Release notes from git history

**Files:**
- Create: `scripts/android-release-notes.sh`
- Test: `tests/server/androidReleaseNotes.test.ts`

**Interfaces:**
- Produces (CLI): `scripts/android-release-notes.sh <android-vX.Y.Z>` run inside a git repo; prints to stdout: line 1 `Bacta Android X.Y.Z`, a blank line, then `- <commit subject>` for each non-merge commit that touches `android/` since the previous `android-v*` tag (all such commits if there is none), newest first, capped at `ANDROID_NOTES_MAX` (default `20`). When no commit qualifies, the body is the single line `- No Android changes since <previous tag>` (or `- First Android release`). Validates the tag by calling `scripts/android-version.sh` (exits non-zero with its `android-version:` message on a bad tag).
- Consumed by: Task 4 (`--release-notes-file`).

- [ ] **Step 1: Write the failing tests.** Helper builds a throwaway repo in a temp dir (`git init`, commits touching `android/x.txt` and `server/y.txt`, annotated tags `android-v0.0.1` etc.) and runs the script with `cwd` set to it. Cases (exact assertions on stdout lines):
  - `'lists android commits since the previous android tag'` — header `Bacta Android 0.1.0`, then only the post-tag android subjects, newest first.
  - `'ignores commits that do not touch android/'`.
  - `'with no previous android tag lists all android commits'`.
  - `'says so when nothing in android/ changed since the last tag'` → `- No Android changes since android-v0.0.1`.
  - `'caps the list at ANDROID_NOTES_MAX'` (env `ANDROID_NOTES_MAX=2`, 3 qualifying commits → 2 bullets).
  - `'skips merge commits'`.
  - `'rejects a malformed tag'` (`v0.1.0`): status != 0, stdout `''`.

- [ ] **Step 2: Run** `npx vitest run tests/server/androidReleaseNotes.test.ts` → FAIL (script missing).

- [ ] **Step 3: Implement `scripts/android-release-notes.sh`.** Previous tag = the nearest earlier `android-v*` tag by version order that is not `$tag` (`git tag --list 'android-v*' --sort=-version:refname`, pick the entry after `$tag`; if `$tag` does not exist yet, the newest tag). Commit list = `git log --no-merges --format=%s <prev>..<tag-or-HEAD> -- android/`. `chmod +x`.

- [ ] **Step 4: Run the tests** → PASS.

- [ ] **Step 5: Commit** `feat: generate Android release notes from git history`.

---

### Task 3: The distribute script

**Files:**
- Create: `scripts/firebase-distribute.sh`
- Test: `tests/server/firebaseDistribute.test.ts`

**Interfaces:**
- Produces (CLI): `scripts/firebase-distribute.sh [--dry-run] <apk> <release-notes-file>`. Env: `FIREBASE_APP_ID`, `GOOGLE_APPLICATION_CREDENTIALS` (path), optional `FIREBASE_GROUPS` (default `owner`), `FIREBASE_TOOLS_VERSION` (default `15.34.2`). Runs `npx --yes firebase-tools@<version> appdistribution:distribute <apk> --app <id> --groups <groups> --release-notes-file <file>`; `--dry-run` prints that command instead.
- Gate: if `FIREBASE_APP_ID` or `GOOGLE_APPLICATION_CREDENTIALS` is empty/unset → stdout `firebase-distribute: skipped (Firebase credentials not configured)`, exit 0, nothing run.
- Consumed by: Task 4.

- [ ] **Step 1: Write the failing tests** (`run(args, env)` with a temp dir holding a fake APK, notes file, and a fake credentials file containing `MARKER-DO-NOT-LEAK`):
  - `'skips with exit 0 when FIREBASE_APP_ID is empty'` and `'…when credentials are not set'`.
  - `'dry-run prints the firebase command with app id, group and notes file'` — stdout contains `appdistribution:distribute`, `--app 1:123:android:abc`, `--groups owner`, `--release-notes-file`, and `firebase-tools@15.34.2`.
  - `'FIREBASE_GROUPS overrides the group'`.
  - `it.each` refusals (status != 0, stderr contains `firebase-distribute:`): app id `abc`; APK missing; notes file missing; credentials path that does not exist.
  - `'never prints the credentials contents'` on both the success and the refusal paths (stdout and stderr lack `MARKER-DO-NOT-LEAK`).

- [ ] **Step 2: Run** `npx vitest run tests/server/firebaseDistribute.test.ts` → FAIL.

- [ ] **Step 3: Implement `scripts/firebase-distribute.sh`.** Order: parse `--dry-run`; gate (skip case); validate app id (`^1:[0-9]+:android:[0-9a-f]+$`), APK, notes file, credentials file exists; build the command as an array; print it (dry-run) or `exec` it. No `set -x`, no printing of env. `chmod +x`.

- [ ] **Step 4: Run the tests** → PASS.

- [ ] **Step 5: Commit** `feat: add firebase-distribute.sh with credential gating`.

---

### Task 4: Wire into the release workflow, and document

**Files:**
- Modify: `.github/workflows/android-release.yml`
- Test: `tests/server/androidReleaseWorkflow.test.ts`
- Modify: `docs/OPERATIONS.md`, `docs/superpowers/specs/2026-11-02-android-native-app-design.md`

**Interfaces:**
- Consumes: `scripts/android-release-notes.sh`, `scripts/firebase-distribute.sh`; secrets from Task 1; the APK copied to `bacta-android-<version>.apk` by the existing "Publish GitHub Release" step.

- [ ] **Step 1: Write the failing guard test** (reads the workflow as text; asserts on string positions, no YAML library needed):
  - `'checks out full history so release notes can see the previous tag'` — the checkout step has `fetch-depth: 0`.
  - `'distributes to Firebase only after the GitHub Release is published'` — index of `Distribute to Firebase` > index of `Publish GitHub Release`.
  - `'skips Firebase steps when the secret is absent'` — a step computes `enabled` from `secrets.FIREBASE_SERVICE_ACCOUNT != ''` and both the auth and distribute steps are conditioned on it.
  - `'authenticates with the pinned google-github-actions/auth major'` — contains `google-github-actions/auth@v3` and `credentials_json`.
  - `'does not enable shell tracing'` — no `set -x`.

- [ ] **Step 2: Run** `npx vitest run tests/server/androidReleaseWorkflow.test.ts` → FAIL.

- [ ] **Step 3: Edit the workflow.** Add `with: fetch-depth: 0` to checkout. After "Publish GitHub Release" add, in order: a step `id: firebase` that writes `enabled=${{ secrets.FIREBASE_SERVICE_ACCOUNT != '' }}` to `$GITHUB_OUTPUT`; `google-github-actions/auth@v3` (`credentials_json: ${{ secrets.FIREBASE_SERVICE_ACCOUNT }}`) gated on `steps.firebase.outputs.enabled == 'true'`; a step `Distribute to Firebase` with the same gate, env `FIREBASE_APP_ID: ${{ secrets.FIREBASE_APP_ID }}`, running `android-release-notes.sh "$GITHUB_REF_NAME" > "$RUNNER_TEMP/notes.txt"` then `firebase-distribute.sh bacta-android-<version>.apk "$RUNNER_TEMP/notes.txt"`; and a final step that prints `Firebase distribution skipped (secrets not configured)` when not enabled.

- [ ] **Step 4: Validate and run** the guard test → PASS; validate YAML with `cd /tmp && npx --yes js-yaml <path>`.

- [ ] **Step 5: Docs.** In `docs/OPERATIONS.md` add an "Android release channel" section: how a release flows (tag → CI → GitHub Release + Firebase email), the owner-run setup (Task 1), the 150-day expiry and 30-day invite window, key rotation (`firebase-secrets.sh` again), and a line recording what Android asked on first install (filled in during Task 5). In the spec replace the Obtainium channel: §1 criterion 1, the §3 diagram label, §4 "Open check", §6 outer loop, and the §12 verification risk (updates now arrive by Firebase email; the limited-distribution registration is still advised before the 2027 rollout). Verify: `grep -c -i obtainium docs/superpowers/specs/2026-11-02-android-native-app-design.md` prints `0` (or only a "considered alternatives" note).

- [ ] **Step 6: Full verification:** `npm test` green; `npx tsc -p tsconfig.server.json --noEmit` silent.

- [ ] **Step 7: Commit, push, PR** `feat: publish signed Android releases to Firebase App Distribution`; CI green (the existing `test` job; the Android build job does not run for this change); squash-merge. (First live proof is Task 5.)

---

### Task 5: First real release through Firebase (owner + phone, no code)

- [ ] **Step 1:** Owner pushes `git tag -a android-v0.0.2 origin/main -m "First Firebase release"` and `git push origin android-v0.0.2` (a tag change is the only Android change; versionCode becomes 2).
- [ ] **Step 2:** `gh run watch` the release run → success, with the Firebase step green. Release notes in the Firebase console show `Bacta Android 0.0.2` and the first-release bullet list. GitHub Release `android-v0.0.2` exists with the APK.
- [ ] **Step 3: Tell the owner what to expect before any phone action,** then wait for "go". The owner opens the Firebase invitation email on the Fold, signs in with Google, accepts, and installs. Record in `docs/OPERATIONS.md` what Android prompted (unknown-sources, Play Protect), since Firebase's tester page doesn't say.
- [ ] **Step 4:** Confirm on the phone: app shows `server 1.1.0 · min app 0.1.0`, version `0.0.2`.
- [ ] **Step 5 (the update path):** push `android-v0.0.3` and confirm the "new build" email arrives and installs over the existing app without uninstalling.

---

### Task 6 (optional, separate PR): `.debug` application id for dev builds

**Files:**
- Modify: `android/app/build.gradle.kts` (debug build type: `applicationIdSuffix = ".debug"` and `manifestPlaceholders["appLabel"] = "Bacta Dev"`; release: `manifestPlaceholders["appLabel"] = "Bacta"`), `android/app/src/main/AndroidManifest.xml` (`android:label="${appLabel}"`), `scripts/android-build.sh` (nothing to change: it installs the APK by path)
- Test: `android/app/src/test/kotlin/io/github/bridgemouse/bacta/BuildVariantsTest.kt`

A manifest placeholder is used on purpose: defining `app_name` through both `resValue` and `res/values/strings.xml` is a duplicate-resource build error.

- [ ] **Step 1: Write the failing test** `BuildVariantsTest` (reads `build.gradle.kts` and the manifest like `ManifestTest`): `debugAppIdHasASuffixSoDevAndReleaseCoexist` asserts the file contains `applicationIdSuffix = ".debug"` inside the `debug` block; `releaseKeepsTheBaseApplicationId` asserts no suffix in `release`; `appLabelComesFromAPlaceholder` asserts the manifest label is `${appLabel}` and the build file sets `"Bacta Dev"` for debug and `"Bacta"` for release.
- [ ] **Step 2:** `bash scripts/android-build.sh build testDebugUnitTest` → FAIL on the new tests.
- [ ] **Step 3:** Make the three edits above (signatures are fixed by the test).
- [ ] **Step 4:** Same command → PASS; `assembleDebug` succeeds; `aapt2 dump badging` on the debug APK shows package `io.github.bridgemouse.bacta.debug`, on a release APK `io.github.bridgemouse.bacta`.
- [ ] **Step 5:** On-device check (announce first; wait for "go"): both apps installed at once, "Bacta Dev" and "Bacta".
- [ ] **Step 6:** Commit, PR `feat(android): .debug application id for side-by-side dev builds`, CI green, merge.

---

## Self-Review

- **Spec coverage:** the goal (tag → phone via Firebase) is covered by Tasks 1-5; the Obtainium channel is replaced in Task 4's spec edits; archive on GitHub is unchanged; `.debug` dev builds are Task 6.
- **Decisions pinned:** CLI version, action major, role, group alias, secret names, email-only, ordering.
- **Types/names:** secret names, env names (`FIREBASE_APP_ID`, `GOOGLE_APPLICATION_CREDENTIALS`, `FIREBASE_GROUPS`, `FIREBASE_TOOLS_VERSION`, `ANDROID_NOTES_MAX`) and script paths are identical wherever they appear.
- **Review Focus:** items 1-5 each map to named tests (Task 3, Task 4, Tasks 1/3, Task 2, Task 4).
- **Unverified (flagged, not assumed):** whether Android asks for "Install unknown apps" for the Firebase install (Task 5 records it); the exact IAM role label in the Cloud console; whether Firebase accepts a duplicate version (avoided by design).
