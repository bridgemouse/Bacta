import db from './client'
import fs from 'fs'
import path from 'path'
import { initSettings } from '../lib/settings'

const NEW_ACTIVITY_COLS = [
  'aerobic_te REAL',
  'anaerobic_te REAL',
  'recovery_time_h REAL',
  'zone1_s INTEGER',
  'zone2_s INTEGER',
  'zone3_s INTEGER',
  'zone4_s INTEGER',
  'zone5_s INTEGER',
  'run_cadence INTEGER',
  'run_stride_cm REAL',
  'run_vert_osc_cm REAL',
  'run_gct_ms INTEGER',
]

export function migrate() {
  const schema = fs.readFileSync(
    path.join(__dirname, 'schema.sql'),
    'utf-8'
  )
  db.exec(schema)

  // Add new columns to existing prod DB — SQLite doesn't support ADD COLUMN IF NOT EXISTS
  for (const col of NEW_ACTIVITY_COLS) {
    try {
      db.exec(`ALTER TABLE garmin_activities ADD COLUMN ${col}`)
    } catch (e: unknown) {
      if (!(e instanceof Error) || !e.message.includes('duplicate column name')) throw e
      // column already exists, idempotent
    }
  }

  // garmin_activity_legs is a new table — CREATE TABLE IF NOT EXISTS handles idempotency
  // (schema.sql already ran above via db.exec(schema))

  // Add section column to mx4_chat_messages — tracks which section a message belongs to
  try {
    db.exec('ALTER TABLE mx4_chat_messages ADD COLUMN section TEXT')
  } catch (e: unknown) {
    if (!(e instanceof Error) || !e.message.includes('duplicate column name')) throw e
    // column already exists, idempotent
  }

  initSettings()

  console.log('[db] migrations complete')
}
