import { describe, it, expect, beforeAll } from 'vitest'
import Database from 'better-sqlite3'

// Use in-memory DB for tests
process.env.DB_PATH = ':memory:'

describe('schema', () => {
  let db: Database.Database

  beforeAll(async () => {
    const { migrate } = await import('../../server/db/migrate')
    const client = await import('../../server/db/client')
    db = client.default
    migrate()
  })

  it('creates garmin_snapshots table', () => {
    const row = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='garmin_snapshots'"
    ).get()
    expect(row).toBeTruthy()
  })

  it('creates manual_inputs table', () => {
    const row = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='manual_inputs'"
    ).get()
    expect(row).toBeTruthy()
  })

  it('creates macrofactor_snapshots table', () => {
    const row = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='macrofactor_snapshots'"
    ).get()
    expect(row).toBeTruthy()
  })

  it('creates blood_work table', () => {
    const row = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='blood_work'"
    ).get()
    expect(row).toBeTruthy()
  })

  it('enforces readiness range on manual_inputs', () => {
    expect(() => {
      db.prepare(
        'INSERT INTO manual_inputs (date, readiness) VALUES (?, ?)'
      ).run('2026-04-25', 6)
    }).toThrow()
  })

  it('enforces unique date+metric on garmin_snapshots', () => {
    db.prepare(
      'INSERT INTO garmin_snapshots (date, metric, value) VALUES (?, ?, ?)'
    ).run('2026-04-25', 'steps', 9000)
    expect(() => {
      db.prepare(
        'INSERT INTO garmin_snapshots (date, metric, value) VALUES (?, ?, ?)'
      ).run('2026-04-25', 'steps', 9001)
    }).toThrow()
  })
})
