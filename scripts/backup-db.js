#!/usr/bin/env node
/**
 * Nightly Bacta DB backup. Produces a consistent gzipped snapshot via SQLite
 * `VACUUM INTO` (online-safe while WAL writers are active), tightens perms, and
 * rotates to the last N copies. No sqlite3 CLI needed (uses better-sqlite3).
 *
 * Env:
 *   BACTA_DB         source DB         (default /opt/bacta/data/bacta.db)
 *   BACTA_BACKUP_DIR destination dir   (default /opt/bacta/backups)
 *   BACTA_BACKUP_KEEP rotation count   (default 14)
 *
 * The backup contains plaintext API keys + all PHI — keep BACTA_BACKUP_DIR
 * owner-only and the off-box copy encrypted (see docs/OPERATIONS.md).
 */
const fs = require('fs')
const path = require('path')
const zlib = require('zlib')
const Database = require('better-sqlite3')

const DB   = process.env.BACTA_DB ?? '/opt/bacta/data/bacta.db'
const DEST = process.env.BACTA_BACKUP_DIR ?? '/opt/bacta/backups'
const KEEP = parseInt(process.env.BACTA_BACKUP_KEEP ?? '14', 10)

function stamp() {
  return new Date().toISOString().replace(/[:T]/g, '').replace(/\..+/, '').replace(/-/g, '').slice(0, 14)
  // -> YYYYMMDDHHMMSS
}

function main() {
  fs.mkdirSync(DEST, { recursive: true, mode: 0o700 })
  const raw = path.join(DEST, `bacta-${stamp()}.db`)
  const gz  = `${raw}.gz`

  // Consistent snapshot.
  const db = new Database(DB, { readonly: true })
  db.pragma('busy_timeout = 10000')
  db.exec(`VACUUM INTO '${raw.replace(/'/g, "''")}'`)
  db.close()

  // Compress + tighten perms, then drop the uncompressed copy.
  const data = fs.readFileSync(raw)
  fs.writeFileSync(gz, zlib.gzipSync(data), { mode: 0o600 })
  fs.chmodSync(gz, 0o600)
  fs.unlinkSync(raw)

  // Rotate: keep the newest KEEP gzip backups.
  const backups = fs.readdirSync(DEST)
    .filter(f => /^bacta-\d{14}\.db\.gz$/.test(f))
    .sort()
    .reverse()
  for (const old of backups.slice(KEEP)) {
    fs.unlinkSync(path.join(DEST, old))
  }

  const sizeMb = (fs.statSync(gz).size / 1e6).toFixed(1)
  console.log(`[backup] wrote ${gz} (${sizeMb} MB); ${Math.min(backups.length, KEEP)} kept`)
}

main()
