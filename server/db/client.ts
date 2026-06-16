import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'

const dbPath = process.env.DB_PATH ?? './data/bacta.db'
// IMPORTANT: This module is a singleton — the DB connection is established
// at import time. Set process.env.DB_PATH BEFORE importing this module.
// In tests, use dynamic import() inside beforeAll() after setting DB_PATH.

// Ensure data directory exists (skip for in-memory DBs)
if (dbPath !== ':memory:') {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true })
}

const db = new Database(dbPath)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')
// Wait up to 5s for a competing writer (poller vs API vs MX-4) instead of
// failing immediately with SQLITE_BUSY.
db.pragma('busy_timeout = 5000')

// Engine-level read-only handle for untrusted SQL (the MX-4 queryDb tool).
// SQLite rejects all writes on a readonly connection regardless of SQL text.
// For in-memory test DBs a second connection would be a different empty DB, so
// fall back to the shared handle there (the queryDb tool also guards by stmt.reader).
export const dbReadonly =
  dbPath === ':memory:' ? db : new Database(dbPath, { readonly: true })
dbReadonly.pragma('busy_timeout = 5000')

export default db
