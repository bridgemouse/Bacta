import { describe, it, expect, beforeAll } from 'vitest'
import Database from 'better-sqlite3'

// Use in-memory DB for tests
process.env.DB_PATH = ':memory:'

describe('DB schema — new tables', () => {
  let db: Database.Database

  beforeAll(async () => {
    const { migrate } = await import('../../server/db/migrate')
    const client = await import('../../server/db/client')
    db = client.default
    migrate()
  })

  it('app_settings table exists', () => {
    const row = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='app_settings'"
    ).get()
    expect(row).toBeTruthy()
  })

  it('mx4_briefings table exists', () => {
    const row = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='mx4_briefings'"
    ).get()
    expect(row).toBeTruthy()
  })

  it('mx4_chat_messages table exists', () => {
    const row = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='mx4_chat_messages'"
    ).get()
    expect(row).toBeTruthy()
  })
})
