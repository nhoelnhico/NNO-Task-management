import { DatabaseSync } from 'node:sqlite'
import { mkdirSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const file = path.resolve(root, process.env.DB_PATH || 'data/tasks.db')
mkdirSync(path.dirname(file), { recursive: true })

export const db = new DatabaseSync(file)
db.exec('PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;')

// Migrations: server/migrations/NNN_name.sql, applied once each in order.
// PRAGMA user_version records the last applied number inside the database file itself.
const dir = new URL('./migrations/', import.meta.url)
const applied = db.prepare('PRAGMA user_version').get().user_version
for (const name of readdirSync(dir).filter(f => f.endsWith('.sql')).sort()) {
  const version = parseInt(name, 10)
  if (version <= applied) continue
  db.exec('BEGIN')
  try {
    db.exec(readFileSync(new URL(name, dir), 'utf8'))
    db.exec(`PRAGMA user_version = ${version}`)
    db.exec('COMMIT')
    console.log(`Applied migration ${name}`)
  } catch (err) {
    db.exec('ROLLBACK')
    throw err
  }
}
