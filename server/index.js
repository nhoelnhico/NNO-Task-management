import express from 'express'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { db } from './db.js'
import { buildReport, reportDocx, spanDays } from './report.js'

const root = fileURLToPath(new URL('..', import.meta.url))
const { PORT = 4000, HOST = '127.0.0.1' } = process.env
const PAGE_SIZE = 50
const STATUSES = ['todo', 'in_progress', 'done']
// The only columns the API can write, with their max lengths. Anything else in a request body is ignored.
const FIELDS = { task_date: 10, status: 11, ticket_no: 40, department: 80, category: 120, description: 1000 }
const LABELS = { task_date: 'Date', status: 'Status', ticket_no: 'Ticket number', department: 'Department', category: 'Category', description: 'Description' }
const COLUMNS = 'id, task_date, status, ticket_no, department, category, description, created_at, updated_at'

const fail = (status, message) => Object.assign(new Error(message), { status })

function isDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const d = new Date(`${value}T00:00:00Z`)
  return !isNaN(d) && d.toISOString().startsWith(value) // rejects 2026-02-30
}

function readTask(body, partial) {
  if (!body || typeof body !== 'object') throw fail(400, 'Send the task as JSON.')
  const task = {}
  for (const [key, max] of Object.entries(FIELDS)) {
    if (body[key] === undefined) continue
    const value = String(body[key] ?? '').replace(/\s+/g, ' ').trim()
    if (value.length > max) throw fail(400, `${LABELS[key]} must be ${max} characters or fewer.`)
    task[key] = value || null
  }
  for (const key of ['task_date', 'description']) {
    if ((!partial || key in task) && !task[key]) throw fail(400, `${LABELS[key]} is required.`)
  }
  if (task.task_date && !isDate(task.task_date)) throw fail(400, 'Date must be a real date (YYYY-MM-DD).')
  if (task.status !== undefined && !STATUSES.includes(task.status)) throw fail(400, `Status must be one of: ${STATUSES.join(', ')}.`)
  if (task.ticket_no) task.ticket_no = task.ticket_no.toUpperCase()
  return task
}

function taskId(req) {
  const id = Number(req.params.id)
  if (!Number.isSafeInteger(id) || id < 1) throw fail(404, 'Task not found.')
  return id
}

const app = express()
app.use(express.json({ limit: '100kb' }))

app.get('/api/tasks', (req, res) => {
  const { q, status, before, cursor } = req.query
  const where = []
  const params = []
  if (STATUSES.includes(status)) {
    where.push('status = ?')
    params.push(status)
  }
  if (isDate(before)) {
    where.push('task_date <= ?')
    params.push(before)
  }
  if (typeof q === 'string' && q.trim()) {
    // ponytail: LIKE '%term%' scans the rows left after the other filters; move to an FTS5 index if search passes ~200 ms.
    const term = `%${q.trim().replace(/[\\%_]/g, '\\$&')}%`
    where.push(`(${['description', 'ticket_no', 'department', 'category'].map(c => `${c} LIKE ? ESCAPE '\\'`).join(' OR ')})`)
    params.push(term, term, term, term)
  }
  if (cursor !== undefined) {
    const [, date, id] = String(cursor).match(/^(\d{4}-\d{2}-\d{2})_(\d+)$/) ?? []
    if (!date) throw fail(400, 'Invalid cursor.')
    where.push('(task_date, id) < (?, ?)')
    params.push(date, Number(id))
  }
  const rows = db
    .prepare(`SELECT ${COLUMNS} FROM tasks ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY task_date DESC, id DESC LIMIT ?`)
    .all(...params, PAGE_SIZE + 1)
  const items = rows.slice(0, PAGE_SIZE)
  const last = items.at(-1)
  res.json({ items, nextCursor: rows.length > PAGE_SIZE ? `${last.task_date}_${last.id}` : null })
})

const insertTask = db.prepare(`
  INSERT INTO tasks (task_date, status, ticket_no, department, category, description)
  VALUES (?, ?, ?, ?, ?, ?) RETURNING ${COLUMNS}`)

app.post('/api/tasks', (req, res) => {
  const t = readTask(req.body, false)
  res.status(201).json(insertTask.get(t.task_date, t.status ?? 'todo', t.ticket_no ?? null, t.department ?? null, t.category ?? null, t.description))
})

app.patch('/api/tasks/:id', (req, res) => {
  const t = readTask(req.body, true)
  const keys = Object.keys(t) // whitelisted by FIELDS, safe to interpolate as column names
  if (!keys.length) throw fail(400, 'Nothing to update.')
  const row = db
    .prepare(`UPDATE tasks SET ${keys.map(k => `${k} = ?`).join(', ')}, updated_at = datetime('now') WHERE id = ? RETURNING ${COLUMNS}`)
    .get(...Object.values(t), taskId(req))
  if (!row) throw fail(404, 'Task not found.')
  res.json(row)
})

app.delete('/api/tasks/:id', (req, res) => {
  if (!db.prepare('DELETE FROM tasks WHERE id = ?').run(taskId(req)).changes) throw fail(404, 'Task not found.')
  res.status(204).end()
})

// Autocomplete for the department and category inputs, taken from the latest 2,000 tasks so it stays index-only.
const recent = column => db.prepare(`
  SELECT DISTINCT ${column} AS value FROM (SELECT ${column} FROM tasks ORDER BY task_date DESC, id DESC LIMIT 2000)
  WHERE ${column} IS NOT NULL`)
const recentDepartments = recent('department')
const recentCategories = recent('category')

app.get('/api/suggestions', (req, res) => {
  res.json({
    departments: recentDepartments.all().map(r => r.value),
    categories: recentCategories.all().map(r => r.value),
  })
})

const doneInRange = db.prepare(`
  SELECT task_date, ticket_no, department, category, description FROM tasks
  WHERE status = 'done' AND task_date BETWEEN ? AND ? ORDER BY task_date, id`)

function readReport({ from, to } = {}) {
  if (!isDate(from) || !isDate(to)) throw fail(400, 'Pick a valid start and end date.')
  if (from > to) throw fail(400, 'The start date must be on or before the end date.')
  if (spanDays(from, to) > 366) throw fail(400, 'A report can cover at most one year.')
  return buildReport(doneInRange.all(from, to), from, to)
}

app.get('/api/report', (req, res) => res.json(readReport(req.query)))

app.post('/api/report/docx', async (req, res) => {
  const report = readReport(req.body)
  const { summary } = req.body
  if (summary !== undefined && (typeof summary !== 'string' || summary.length > 5000)) throw fail(400, 'Summary must be text of 5,000 characters or fewer.')
  res.attachment(report.filename).send(await reportDocx(report, summary?.trim() || report.summary))
})

app.use('/api', (req, res) => res.status(404).json({ error: 'Not found.' }))

if (process.argv.includes('--dev')) {
  const { createServer } = await import('vite')
  const vite = await createServer({ configFile: path.join(root, 'vite.config.js'), server: { middlewareMode: true }, appType: 'spa' })
  app.use(vite.middlewares)
} else {
  const dist = path.join(root, 'dist')
  app.use(express.static(dist))
  app.use((req, res, next) => (req.method === 'GET' ? res.sendFile(path.join(dist, 'index.html')) : next()))
}

app.use((err, req, res, next) => {
  if (/UNIQUE constraint failed: tasks\.ticket_no/.test(err.message)) err = fail(409, 'That ticket number is already logged on another task.')
  const status = err.status ?? err.statusCode ?? 500
  if (status >= 500) console.error(err)
  res.status(status).json({ error: status < 500 ? err.message : 'Something went wrong on the server. Check the server log.' })
})

app.listen(PORT, HOST, err => {
  if (err) throw err
  console.log(`NNO Task Management running at http://${HOST}:${PORT}`)
})
