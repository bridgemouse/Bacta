import db from './client'
import fs from 'fs'
import path from 'path'

export function migrate() {
  const schema = fs.readFileSync(
    path.join(__dirname, 'schema.sql'),
    'utf-8'
  )
  db.exec(schema)
  console.log('[db] migrations complete')
}
