import db from '../db/client'

export type LogLevel = 'info' | 'warn' | 'error'

const DEFAULT_MAX_ROWS_PER_SOURCE = 500

export function logEvent(source: string, level: LogLevel, message: string, maxRows = DEFAULT_MAX_ROWS_PER_SOURCE): void {
  db.prepare('INSERT INTO app_logs (source, level, message) VALUES (?, ?, ?)').run(source, level, message)
  db.prepare(
    `DELETE FROM app_logs WHERE source = ? AND id NOT IN (
       SELECT id FROM app_logs WHERE source = ? ORDER BY id DESC LIMIT ?
     )`
  ).run(source, source, maxRows)
}
