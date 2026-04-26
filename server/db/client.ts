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

export default db
