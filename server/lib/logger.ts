import db from '../db/client'

export type LogLevel = 'info' | 'warn' | 'error'

const DEFAULT_MAX_ROWS_PER_SOURCE = 500

export function logEvent(source: string, level: LogLevel, message: string, maxRows = DEFAULT_MAX_ROWS_PER_SOURCE): void {
  // Some call sites (e.g. garminSync.ts's child.on('close') handler) invoke this
  // outside any request's try/catch — a transient SQLITE_BUSY here must never take
  // down the whole process. A missed log line is fine; a crashed server isn't (#163).
  try {
    db.prepare('INSERT INTO app_logs (source, level, message) VALUES (?, ?, ?)').run(source, level, message)
    db.prepare(
      `DELETE FROM app_logs WHERE source = ? AND id NOT IN (
         SELECT id FROM app_logs WHERE source = ? ORDER BY id DESC LIMIT ?
       )`
    ).run(source, source, maxRows)
  } catch (err: unknown) {
    console.error('[logger] logEvent failed:', err)
  }
}
