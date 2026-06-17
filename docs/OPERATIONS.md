# Bacta — Operations & Disaster Recovery

Runbook for keeping Bacta alive: backups, restore, rollback, observability. Bacta
runs on **LXC 109** (Debian, no Docker) at `/opt/bacta`, served by the
`bacta-api` systemd service on `:3001`. Deploys land via the self-hosted GitHub
Actions runner on push to `main`.

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
node -e "const D=require('better-sqlite3');const d=new D('/opt/bacta/data/bacta.db',{readonly:true});console.log(d.pragma('integrity_check',{simple:true}));console.log('snapshots',d.prepare('SELECT COUNT(*) c FROM garmin_snapshots').get().c)"
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
- Models pinned to `gemini-2.5-flash` (briefing + chat).

## 5. Scheduling note (timezone)

The host runs in **UTC**. The MX-4 nightly time (`mx4_nightly_time`, default `04:00`)
and the poller timer (`03:00`) are interpreted in **server-local (UTC)** time, i.e.
~midnight/23:00 US-Eastern. Adjust the configured times if you want them at a
specific local hour, or set the host timezone.

## 6. Deploy & rollback

**Deploy:** push to `main` → the self-hosted runner runs `git reset --hard origin/main`,
`npm ci`, `npm run build`, `sudo systemctl restart bacta-api`, then a health check.

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
