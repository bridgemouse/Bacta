# Bacta Android — Native App Design

**Date:** 2026-11-02 · **Status:** Draft for owner review · **Path:** Architectural (new subsystem)

## 1. Purpose and success criteria

Bacta is moving from an iOS-style PWA to a **native Android app** (Kotlin + Jetpack Compose), built as a full rebuild of the client. The owner switched to a Samsung foldable and uses **MacroFactor**, which syncs nutrition to **Health Connect**; the app makes Health Connect a first-class data source and replaces the PWA as the daily-use client.

The owner has never built an app, so the build should be understandable and extendable by a beginner, not just fast to generate.

**Milestone 1 (the first test, before any Health Connect work):** the app is standing on the owner's phone and does what the PWA does today for the features actually in use — PIN login, Home, Recovery, Sleep, Training, MX-4 briefings and Ask-MX-4 chat, and the Settings the owner uses (AI provider/model/key, MX-4 schedule toggles, Garmin sync interval, PIN change, version, log viewer) — against the live server, with Nutrition excluded. Nothing in Milestone 1 depends on Health Connect.

**Cutover:** the web front end on LXC 109 keeps running until the Android app is stood up with Settings included. Once the owner is satisfied with Milestone 1 (no fixed trial period), the web front end is retired and Android becomes the only UI. The app is expanded from there, and Health Connect is explored on the real phone only after the cutover.

**Success for v1.0.0 of the app:**
1. Installs on the owner's phone by APK and updates through GitHub Releases without Claude's help.
2. Shows Home, Recovery, Sleep, Training and a read-only Nutrition view against the live Bacta server, matching the Claude Design visual system.
3. Shows MX-4 briefings and supports MX-4 chat.
4. Reads MacroFactor nutrition and phone step data from Health Connect and uploads it to the server, including after the app has been closed for a day.
5. The server keeps working unchanged for the PWA during the whole transition.

## 2. Decisions already made

| Decision | Choice |
|---|---|
| Toolkit | Kotlin + Jetpack Compose, Android only |
| Scope of rebuild | Full client rebuild; **server stays** |
| Server host | **LXC 109 stays as production**; nothing migrates |
| Dev environment | Dedicated Proxmox **VM** ("dev VM"), left running during dev cycles; the owner starts and stops it manually |
| Claude sessions | **One** session on LXC 109 only. The VM is an SSH build worker with no Claude and no git credentials |
| Nutrition logging | Not ported. MacroFactor is the logger; Bacta reads it via Health Connect. The existing PWA nutrition UI is frozen, not deleted |
| Visual design | Claude Design is the source of truth (see §8) |
| Emulator | Optional, later. First loop is Gradle on the VM plus the real phone |
| MX-4 | Stays on Gemini. The owner has not renewed the AI Studio credits yet, so MX-4 stays offline until they do; the model must then also be swapped off the retired `gemini-2.5-flash` (secondary sources; confirm against Google's page). This is not a blocker for the Android work |
| Web front end | Retired after Milestone 1 trial: stop serving the client bundle from Express. **The code stays in the repo** (it is the design reference and Playwright baseline) and the API is unchanged |

## 3. Architecture

```
GitHub (public repo: source of truth, CI, Releases, signing secrets)
   ▲ push/PR/tags                          │ APK via Releases
LXC 109 (always on) ───────────────────────┼───────► Phone (Fold)
 ├ /opt/bacta: PRODUCTION checkout, stays on main       ▲ Obtainium updates
 ├ worktrees/android-*: Android work                    │ app ⇄ server over LAN
 ├ Express API + SQLite, Garmin poller, MX-4, vault link
 ├ NEW: /api/version, /api/health-connect/ingest
 └ the only Claude session; the only place git writes happen
        │ rsync android/ (one-way), ssh: build/test/adb
        ▼
Dev VM (Debian 13, cpu=host): JDK 17, Android SDK, Gradle; adb → phone
```

The app is a client: it never talks to Garmin or runs MX-4. Those remain server jobs. Health Connect data flows phone → server → existing database, and the app reads everything back through the same API surface the PWA uses.

## 4. Versioning

- **Server + web:** unchanged `v1.x.y` tags. Baseline tag **`v1.1.0`** on current `main` before Android work starts (**pending owner approval**). `client/src/version.ts` is changed to read `package.json` so it cannot drift.
- **Android app:** `android-v0.x.y` tags, starting `0.1.0`; becomes `1.0.0` when it replaces the PWA for daily use. `versionName` comes from the tag in CI; `versionCode = major×10000 + minor×100 + patch`, computed, never hand-edited.
- **Compatibility:** new `GET /api/version` returns `{ server, minApp }`. The app checks on launch and shows "update the app" or "update the server".
- **Open check:** Obtainium must ignore server releases that have no APK. Its release-filter options are unverified; if they don't suffice, a small self-updater inside the app (checks the server, downloads APK) replaces it.

## 5. Git workflow

1. One repo. Android lives in **`android/`** (Gradle root). Nothing else moves.
2. **LXC 109 is the only machine that commits and pushes.** The dev VM has no git credentials and is disposable.
3. **Never check out a branch in `/opt/bacta`** — production runs `tsx watch` from that directory, so a branch switch changes live Bacta. All work happens in `worktrees/<name>`.
4. Short-lived `android/<topic>` branches → PR → `main`. No long-lived Android branch.
5. `.gitignore` gains `.gradle/`, `build/`, `local.properties`, `*.jks`, `*.keystore`, `*.apk`.
6. CI: existing `test` job is untouched. A new path-filtered `android.yml` runs lint, unit tests and `assembleDebug` on `android/**` changes. It is **not** a required status check (a required path-filtered check would hang PRs that don't touch `android/`).
7. Releases: pushing tag `android-vX.Y.Z` triggers CI to build a signed APK from a clean checkout and attach it to a GitHub Release. The signing key lives in GitHub Secrets and a second offline backup, never on the VM.
8. Note: live branch protection requires only the `test` check (strict) with force-push blocked; it has **no required reviews**, contrary to CLAUDE.md. Fix the docs separately.

## 6. Development loop

- **Inner loop (no GitHub):** edit in the worktree on LXC 109 → `scripts/android-build.sh` rsyncs `android/` to the VM (one-way, `--delete`, excluding build outputs) → builds over SSH in the background with plain, filtered Gradle output → install via `adb` → logs and screenshots pulled back. The VM copy is never edited.
- **Outer loop:** commit → PR → CI → merge → tag → release → Obtainium.
- **Visual checks:** Playwright captures reference screenshots of the live PWA (phone-width and Fold-width). `android preview render` (Google's Android CLI, on the dev VM) renders Compose `@Preview` functions to PNG with no device or IDE and can export the component tree as JSON; those images are compared to the reference screenshots. The real phone covers behavior.
- **Environment gotchas to handle in setup:** `ANDROID_HOME` set where non-interactive SSH reads it; long builds use `nohup` so a dropped connection doesn't kill them.

## 7. Server changes (LXC 109, TDD)

- `GET /api/version` as above (needed for Milestone 1).
- **After the Health Connect exploration, not before:** `POST /api/health-connect/ingest`, authenticated like other routes: idempotent upserts keyed on Health Connect record ids; accepts steps and daily nutrition totals; writes `health_snapshots` rows with `source = 'healthconnect'`. Its exact shape depends on what the exploration finds. Meal-level nutrition is out of scope for v1.
- Staging: Milestone 1 is read-mostly (the only writes are the same chat messages the PWA already writes), so the app points at LXC 109 directly. Once the ingest endpoint exists, development points at a **staging server on the dev VM** running against a copy of the database so test writes never reach production.
- Auth: the server issues an httpOnly session cookie from the PIN; the app keeps it in a persistent cookie jar. No server auth change for v1.
- Android 17 (target API 37) blocks LAN connections unless the manifest declares `ACCESS_LOCAL_NETWORK` and the user grants it at runtime (part of the *Nearby devices* group). The app requests it and shows a clear message if denied. Whether traffic over Tailscale's address range counts as "local network" is unverified; check when Tailscale is added.
- Transport: the server is plain HTTP on the LAN, so the app needs a network-security config allowing cleartext **to the Bacta host only**. Tailscale (already on the security runbook) would later make sync work off-LAN.

## 8. Design source

- Existing: `design_bacta-handoff-package/` (v3, Jun 4) plus the live app (~v3.5) fully specify Home, Recovery, Sleep and Training. The port follows them; Claude does not invent visuals.
- **Milestone 1 needs no new design.** It uses the existing phone-width design; on the Fold's wider inner screen it is centered at a fixed max width. A proper foldable layout waits for the Claude Design pass below.
- A platform-neutral **design spec** (colors, type scale, spacing, per-component specs) is extracted from `theme.ts` and the handoff so the Kotlin side has a precise reference.
- **One new Claude Design pass**, run by the owner, for Android-only surfaces: foldable cover vs. inner-screen layouts, system back gesture and bars, Health Connect onboarding/permission screens, sync-status surface, and the read-only Nutrition view.
- Known gaps to resolve in that pass: no equivalent of CSS `backdrop-filter` (sheets use a scrim); CSS keyframes become Compose animations.

## 9. App scope

**Milestone 1:** login (PIN), Home, Recovery, Sleep, Training, MX-4 briefing display and chat, and Settings limited to what is in use (server URL, AI provider/model/key, MX-4 nightly/on-sync toggles and time, Garmin background-sync interval, PIN change, version, log viewer).
**Added after the cutover:** read-only Nutrition, Health Connect sync + status.
**Out of scope for now:** Blood Work and Daily Log (unbuilt), food logging UI, barcode scanning, recipes. Also deferred, because the web UI is retired: provider OAuth setup and the custom-skills editor. Checked in the live database on 2026-11-02: all six non-Garmin providers are disabled with no credentials, and the stored custom-skills value is invalid JSON, so neither is in use. If either is needed, it gets added to the app; until then the settings API can be called directly.
**Device target:** `minSdk 34` (Android 14+, where Health Connect is part of the OS), because there is a single known device. Revisit if another device is added.

## 10. Health Connect

- Confirmed from Google's docs: no cloud API; on-device only; default read window is 30 days before first permission unless the history permission is requested; background reads need their own permission; changes-token sync is the recommended incremental pattern.
- Garmin writes to Health Connect one-way and (per press coverage) omits Body Battery, HRV status and training load, so the Garmin poller remains the primary Garmin source.
- Sync design: a periodic WorkManager worker reads changes and uploads; if the server is unreachable (off-LAN) it queues and retries.
- **Unverified until the spike:** which nutrients MacroFactor exports, and whether Health Connect permissions work as expected for a sideloaded (non-Play) build.

## 11. Phases and exit criteria

| Phase | Work | Done when |
|---|---|---|
| A | Housekeeping on LXC 109: commit the Aug 12 doc edits via PR, clean stale branches/worktrees, install the backup timer, tag `v1.1.0`, fix `version.ts`. (MX-4 revival is deferred by the owner.) | A backup file exists; tag pushed |
| B | `GET /api/version` | Tests green |
| C | Owner creates the VM; SSH from LXC 109; toolchain + `android-build.sh` | Script builds a sample on the VM |
| D | Hello World app builds on the VM and installs on the Fold; Android CI + signing key | App icon on the phone; a tagged build publishes an APK |
| E1 | Design-spec extraction from `theme.ts` + handoff; app shell, PIN login, Home, Recovery | Matches Playwright references on the Fold |
| E2 | Sleep, Training, MX-4 briefings and Ask-MX-4 chat, and the in-use Settings (§9) | **Milestone 1:** owner uses these screens on the phone against the live server |
| E3 | **Cutover:** when the owner is satisfied with Milestone 1, stop serving the web client from LXC 109 (code and API stay) | Owner opens only the app; rollback is re-enabling static serving |
| F | **Health Connect exploration** on the real phone (throwaway screen): what MacroFactor and the phone actually export, permissions in a sideloaded build, history limits | Written findings and a go/no-go on what to sync — the owner's judgment of how useful it is |
| G | Claude Design pass for Android-only surfaces (foldable layouts, Health Connect onboarding, sync status, read-only Nutrition), informed by F | Handoff package in repo |
| H | Ingest endpoint, Health Connect sync, read-only Nutrition view | Steps and nutrition appear on the server a day after the app was closed |
| I | Daily-driver trial, then `android-v1.0.0` | Owner stops opening the PWA |

Each phase gets its own implementation plan; this spec covers architecture only.

## 12. Risks

- **Google developer-verification rollout** for sideloaded apps (official docs, `kb://android/developer-verification/guides/{index,faq}`, read 2026-11-02): enforcement starts Sep 30 2026 in Brazil, Indonesia, Singapore and Thailand and goes global in 2027. `adb` installs are explicitly exempt, with no waiting period. Installs and *updates* by any other route (including Obtainium) of an unregistered app need the user's "advanced flow" (24-hour wait). The clean fix is a free **limited distribution** registration (no ID check, up to 20 devices) for the package name, signed with the release key; register it before the 2027 global rollout. Until then `adb` and APK installs are unaffected for a US device.
- Lost signing key forces uninstall/reinstall; mitigated by two backups.
- Fold inner-screen layout is untested. At target API 37 the app cannot opt out of large-screen resizing, so content width is capped rather than assuming a phone-sized window.
- Build pins (AGP 9.5.0, Kotlin 2.4.21, Compose BOM 2026.09.00, Gradle 9.8.2) were verified to build together on the dev VM on 2026-11-02, using Google's `android create` template with the block form `compileSdk { version = release(37) { minorApiLevel = 0 } }`; plain `compileSdk = 37` fails against the installed `android-37.0` platform.
- After cutover the phone is the only UI. If it is lost or broken there is no browser fallback until the static serving is re-enabled; keep that a one-line, documented rollback and keep the client code buildable.
- MX-4 is offline until credits are renewed; the app will show stale briefings and failing chat until then. The app should show a clear "MX-4 offline" state instead of an error.
- The dev VM is manually managed; builds stall if it is down.
- LAN-only reach means sync only works at home until Tailscale is added.

## 13. Out of scope here

Replacing the Garmin poller, iOS support, Play Store distribution, multi-user support, a Compose-for-web build.
