# Bacta — Operations & Disaster Recovery

Runbook for keeping Bacta alive: backups, restore, rollback, observability. Bacta
runs on **LXC 109** (Debian, no Docker) at `/opt/bacta`, served by the
`bacta-api` systemd service on `:3001`. CI (GitHub Actions, cloud runners) runs
tests and type checks only — there is no deploy workflow. Deploys are manual,
operator-run on LXC 109 (§6).

---

## 1. Backups (the single most important control)

`data/bacta.db` is the only copy of 13+ months of health data. There is no other
source of truth — Garmin only retains a rolling window.

**Backup script:** `scripts/backup-db.js` — consistent gzipped snapshot via
`VACUUM INTO` (safe while the app is running), `0600` perms, rotates to the last
14. Run manually anytime:
```bash
node /opt/bacta/scripts/backup-db.js      # -> /opt/bacta/backups/bacta-YYYYMMDDHHMMSS.db.gz
```
Tunables (env): `BACTA_DB`, `BACTA_BACKUP_DIR`, `BACTA_BACKUP_KEEP`.

**Install the nightly timer (RUNBOOK — operator runs once):**
```bash
bash /opt/bacta/scripts/install-db-backup.sh   # bacta-backup.timer @ 03:30 (after the 03:00 poll)
```

**Off-box copy (RUNBOOK — required for real DR):** a local backup does not survive
disk loss. After the nightly snapshot, copy the newest `*.db.gz` off-box and
**encrypted** (it contains PHI + plaintext API keys). Example:
```bash
rclone copy /opt/bacta/backups <remote>:bacta-backups --include 'bacta-*.db.gz'   # remote should be encrypted
# or: scp the newest file to another host on an encrypted path (Tailscale)
```

**Restore (verified during the v1.0 sweep — integrity ok, row counts matched):**
```bash
sudo systemctl stop bacta-api
gunzip -c /opt/bacta/backups/bacta-<STAMP>.db.gz > /opt/bacta/data/bacta.db
node -e "const D=require('better-sqlite3');const d=new D('/opt/bacta/data/bacta.db',{readonly:true});console.log(d.pragma('integrity_check',{simple:true}));console.log('snapshots',d.prepare('SELECT COUNT(*) c FROM health_snapshots').get().c)"
sudo systemctl start bacta-api
```
Expect `ok` and a sane row count before starting the service.

## 2. Database durability

- **WAL mode** on all connections (`server/db/client.ts`, `garmin_poller.py`, `garmin_ingest.py`); `synchronous=FULL`.
- **`busy_timeout = 5000`** on every connection so the poller, API, and MX-4 writes wait for each other instead of failing with `SQLITE_BUSY`.
- Idempotent writes (`INSERT OR REPLACE`) — a failed/partial poll is safe to re-run.
- Health check: `PRAGMA integrity_check` (run inside the restore snippet above).

## 3. Observability & failure notification

- **Failure notifications:** set `DISCORD_WEBHOOK_URL` in the host environment for
  `bacta-api` and the poller. The orchestrator notifies on a failed nightly MX-4
  run (`server/lib/notify.ts`); the poller notifies on login/poll failure
  (`garmin_poller.py`). No-op if the var is unset.
- **Logs:** `journalctl -u bacta-api`, `journalctl -u bacta-garmin`, `journalctl -u bacta-backup` (journald rotates them).
- **Quick health:** `curl -sf localhost:3001/api/health`.

## 4. Cost / runaway controls

- Orchestrator: 3 retries/section with 30s backoff, hard abort on quota/rate/429, every generation bounded by `stepCountIs(8)`.
- In-flight lock on `POST /api/mx4/run` + `/run/:section` (returns 409) so rapid Home-refresh taps can't stack full runs.
- Chat history compresses past `mx4_chat_compression_threshold` (default 20).
- Models are chosen in Settings (web and Android) from the list the server offers (`GET /api/settings/models`, `SUPPORTED_MODELS` in `server/lib/ai/provider.ts`); the default is `gemini-3.8-flash`. `gemini-2.5-flash` is deprecated by Google (shutdown 2026-12-01 at the earliest), so an install still pinned to it should switch.

## 5. Scheduling note (timezone)

The host runs in **UTC**. The MX-4 nightly time (`mx4_nightly_time`, default `04:00`)
and the poller timer (`03:00`) are interpreted in **server-local (UTC)** time, i.e.
~midnight/23:00 US-Eastern. Adjust the configured times if you want them at a
specific local hour, or set the host timezone.

## 6. Deploy & rollback

**Deploy is manual — no deploy workflow exists.** CI (GitHub Actions, cloud runners) only
runs tests and type checks on push/PR; nothing restarts the running service. After merging
to `main`, the operator runs, on LXC 109:
```bash
cd /opt/bacta
git pull origin main
npm ci
npm run build            # TypeScript compile + Vite client bundle
sudo systemctl restart bacta-api
curl -sf http://localhost:3001/api/health
```
If the merge touched `client/src`, `npm run build:client` (a subset of `npm run build`)
is what actually ships the change — merging to `main` alone does not update what the
phone loads, since the client is a static build served from `dist/client`.

**Rollback (RUNBOOK):**
```bash
cd /opt/bacta
git log --oneline -n 10                 # find the last good SHA
git reset --hard <good-sha>
npm ci && npm run build
sudo systemctl restart bacta-api
curl -sf localhost:3001/api/health || echo "health FAILED — restore DB from backup if a migration ran"
```
If a bad deploy shipped a destructive migration, restore the DB from the latest
pre-deploy backup (§1) before retrying. Take a backup before any risky deploy.

## 7. Graceful degradation (verified)

- **Garmin down:** read paths serve last-known DB data; the poller logs per-metric errors and notifies on hard failure.
- **Vault (LXC 106) down:** vault tools are gated by `isVaultEnabled()`; briefings/chat still work without them.
- **AI provider error/quota:** chat streams a clear error and ends; the orchestrator aborts cleanly and notifies. No crashes.

## 8. Versioning

`package.json` version + `CHANGELOG.md`; surfaced in the Settings footer (`BACTA·OS vX.Y.Z`).
Tag releases (`git tag v1.0.0`) on merge to `main`.

## 9. Android release channel (Firebase App Distribution)

> Development rules for the app itself (docs-first, no hardcoding, synthetic data only, device workflow) are in `docs/ANDROID.md`.

Plan: `docs/superpowers/plans/2026-11-03-firebase-app-distribution.md`.

**Flow.** The owner pushes a tag `android-vX.Y.Z`. `.github/workflows/android-release.yml` builds and signs the APK, publishes the GitHub Release (the permanent archive), then uploads the same APK to Firebase App Distribution with release notes generated from the git history of `android/`. The owner gets an invitation email on the first release and a "new build" email afterwards. If the Firebase secrets are absent the Firebase steps are skipped and the release still succeeds.

**One-time setup (owner).** Firebase project `Bacta` (Spark plan), Android app `io.github.bridgemouse.bacta`, tester group alias `owner`, a service account with the **Firebase App Distribution Admin** role and a JSON key. Then `bash scripts/firebase-secrets.sh ~/secrets/firebase-sa.json <APP_ID>` validates both and sets the `FIREBASE_SERVICE_ACCOUNT` and `FIREBASE_APP_ID` GitHub secrets. The key grants administrator access to App Distribution: never paste it anywhere; a key can always be re-created.

**Limits and expiry** (Firebase docs, 2026-11): builds stay in the console 150 days; invitations must be accepted within 30 days; 500 testers per project, 200 per group; 1,000 releases per app. Installed apps keep running after a build expires. Always upload with a higher `versionCode` (the tag script guarantees it); Firebase's docs do not say whether a duplicate version is accepted.

**Key rotation.** Create a new key for the same service account, run `scripts/firebase-secrets.sh` again, then delete the old key in the Cloud console.

**Troubleshooting.** If an upload fails citing a disabled API, enable "Firebase App Distribution API" from the link in the error.

**First install on the Fold (owner's report, 2026-11-03, Galaxy Z Fold 8 Ultra, Android 17).** Firebase's tester page does not say what Android asks; in practice: (1) opening the invitation from Chrome made Android ask to allow installs from Chrome; (2) Android testers need Firebase's **App Tester** app, which was installed first from its own APK; (3) after that, permission to download the build was granted; (4) Google Play Protect ran a scan, then the build downloaded and installed. Bacta then launched and showed `BACTA·OS`. Expect this sequence again only on a new device or after clearing those permissions; later builds arrive as "new build" emails.

**Update path (owner's report, 2026-11-03, `0.0.2` to `0.0.3`).** A "new build" email arrived; opening the Firebase **App Tester** app offered the update; Play Protect scanned the build again; the update then installed over the existing app with no uninstall. Updates are therefore one tap in App Tester plus a scan, not silent. Verified end to end: tag, CI, Firebase upload, email, in-app prompt, install-over.
