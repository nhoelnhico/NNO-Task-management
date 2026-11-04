import { useEffect, useRef, useState } from 'react'
import { STATUS, api, dayLabel, Icon, isoDate } from './lib.jsx'

const DEPARTMENTS = ['HR', 'Sales', 'Marketing', 'Warehouse', 'Administration', 'Fulfillment', 'CSR', 'Executive']

const toForm = t => ({
  description: t.description ?? '',
  task_date: t.task_date ?? isoDate(),
  status: t.status ?? 'done',
  ticket_no: t.ticket_no ?? '',
  department: t.department ?? '',
  category: t.category ?? '',
})

export default function Tasks() {
  const [search, setSearch] = useState('')
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('')
  const [before, setBefore] = useState('')
  const [version, setVersion] = useState(0)
  const [suggestions, setSuggestions] = useState({ departments: [], categories: [] })

  useEffect(() => {
    const t = setTimeout(() => setQ(search.trim()), 250)
    return () => clearTimeout(t)
  }, [search])

  const loadSuggestions = () => api('/suggestions').then(setSuggestions, () => {})
  useEffect(() => { loadSuggestions() }, [])

  const filters = new URLSearchParams(Object.entries({ q, status, before }).filter(([, v]) => v)).toString()

  async function create(form) {
    await api('/tasks', { method: 'POST', body: form })
    setVersion(v => v + 1)
    loadSuggestions()
  }

  return (
    <div className="tasks-layout">
      <datalist id="departments">
        {[...new Set([...suggestions.departments, ...DEPARTMENTS])].map(d => <option key={d} value={d} />)}
      </datalist>
      <datalist id="categories">
        {suggestions.categories.map(c => <option key={c} value={c} />)}
      </datalist>

      <section className="panel glass composer" aria-labelledby="composer-title">
        <div className="panel-head">
          <h1 id="composer-title">Log a task</h1>
          <span className="hint"><kbd>Enter</kbd> to add</span>
        </div>
        <TaskForm sticky initial={toForm({})} submitLabel="Add task" onSubmit={create} />
      </section>

      <section className="panel glass list-panel" aria-label="Tasks">
        <div className="toolbar">
          <label className="search">
            <Icon name="search" />
            <input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search tasks, tickets, departments…" aria-label="Search tasks" />
          </label>
          <fieldset className="segmented">
            <legend className="sr-only">Status</legend>
            {[['', 'All'], ...Object.entries(STATUS)].map(([value, label]) => (
              <label key={value}>
                <input type="radio" name="status-filter" value={value} checked={status === value} onChange={() => setStatus(value)} />
                <span>{label}</span>
              </label>
            ))}
          </fieldset>
          <label className="jump">
            <span>Up to</span>
            <input type="date" value={before} onChange={e => setBefore(e.target.value)} aria-label="Show tasks on or before this date" />
          </label>
        </div>
        {/* Remounting on every filter change resets paging cleanly — no stale pages or observers. */}
        <TaskList key={`${filters}#${version}`} filters={filters} onChanged={loadSuggestions} />
      </section>
    </div>
  )
}

function TaskList({ filters, onChanged }) {
  const [items, setItems] = useState([])
  const [cursor, setCursor] = useState(undefined) // undefined: first page not loaded, null: no more pages
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(null)
  const scroller = useRef(null)
  const sentinel = useRef(null)
  const busy = useRef(false)
  const statusFilter = new URLSearchParams(filters).get('status')

  async function loadMore() {
    if (busy.current || cursor === null) return
    busy.current = true
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams(filters)
      if (cursor) params.set('cursor', cursor)
      const page = await api(`/tasks?${params}`)
      setItems(prev => [...prev, ...page.items])
      setCursor(page.nextCursor)
    } catch (err) {
      setError(err.message)
    } finally {
      busy.current = false
      setLoading(false)
    }
  }

  // Infinite scroll inside the list's own scroll box: load the next page as the end comes into view.
  useEffect(() => {
    const io = new IntersectionObserver(([e]) => e.isIntersecting && loadMore(), { root: scroller.current, rootMargin: '300px' })
    io.observe(sentinel.current)
    return () => io.disconnect()
  }, [cursor])

  function replace(updated) {
    setItems(prev =>
      prev
        .map(t => (t.id === updated.id ? updated : t))
        .filter(t => !statusFilter || t.status === statusFilter)
        .sort((a, b) => b.task_date.localeCompare(a.task_date) || b.id - a.id),
    )
    onChanged()
  }

  async function changeStatus(task, status) {
    try {
      replace(await api(`/tasks/${task.id}`, { method: 'PATCH', body: { status } }))
    } catch (err) {
      alert(err.message)
    }
  }

  const days = []
  for (const t of items) {
    if (days.at(-1)?.date !== t.task_date) days.push({ date: t.task_date, tasks: [] })
    days.at(-1).tasks.push(t)
  }

  return (
    <div className="scroller" ref={scroller}>
      {days.map(day => (
        <section key={day.date} className="day">
          <h2>
            {dayLabel(day.date)}
            <time dateTime={day.date}>{day.date}</time>
          </h2>
          <ul>
            {day.tasks.map(t => (
              <li key={t.id} className="task">
                <select className={`status-pill ${t.status}`} value={t.status} onChange={e => changeStatus(t, e.target.value)} aria-label="Status">
                  {Object.entries(STATUS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
                <button className="task-body" onClick={() => setEditing(t)}>
                  <span className="task-desc">{t.description}</span>
                  {(t.ticket_no || t.department || t.category) && (
                    <span className="task-meta">
                      {t.ticket_no && <b className="chip">{t.ticket_no}</b>}
                      {t.department && <span>{t.department}</span>}
                      {t.category && <span>{t.category}</span>}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {loading && !items.length && [1, 2, 3, 4].map(i => <div key={i} className="skeleton" />)}
      {!loading && !error && cursor === null && !items.length && (
        <div className="empty">
          <strong>{filters ? 'No tasks match these filters.' : 'No tasks yet.'}</strong>
          <span>{filters ? 'Try a different search or status.' : 'Log your first one on the left.'}</span>
        </div>
      )}
      {error && (
        <div className="empty" role="alert">
          <strong>Couldn’t load tasks.</strong>
          <span>{error}</span>
          <button className="btn" onClick={loadMore}>Try again</button>
        </div>
      )}
      {cursor === null && items.length > 0 && <p className="end">That’s everything.</p>}
      <div ref={sentinel} className="sentinel" aria-hidden="true" />

      {editing && (
        <EditDialog
          task={editing}
          onClose={() => setEditing(null)}
          onSaved={t => { replace(t); setEditing(null) }}
          onDeleted={id => { setItems(prev => prev.filter(t => t.id !== id)); setEditing(null) }}
        />
      )}
    </div>
  )
}

function EditDialog({ task, onClose, onSaved, onDeleted }) {
  const ref = useRef(null)
  useEffect(() => { ref.current.showModal() }, [])

  async function remove() {
    if (!confirm('Delete this task? This cannot be undone.')) return
    try {
      await api(`/tasks/${task.id}`, { method: 'DELETE' })
      onDeleted(task.id)
    } catch (err) {
      alert(err.message)
    }
  }

  return (
    <dialog ref={ref} className="dialog" onClose={onClose} closedby="any" aria-labelledby="edit-title">
      <div className="panel-head">
        <h2 id="edit-title">Edit task</h2>
        <button className="icon-btn" onClick={() => ref.current.close()} aria-label="Close"><Icon name="x" /></button>
      </div>
      <TaskForm
        initial={toForm(task)}
        submitLabel="Save changes"
        onSubmit={async form => onSaved(await api(`/tasks/${task.id}`, { method: 'PATCH', body: form }))}
      >
        <button type="button" className="btn ghost danger" onClick={remove}><Icon name="trash" size={16} /> Delete</button>
      </TaskForm>
    </dialog>
  )
}

function TaskForm({ initial, submitLabel, onSubmit, sticky, children }) {
  const [form, setForm] = useState(initial)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const set = key => e => setForm(f => ({ ...f, [key]: e.target.value }))

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await onSubmit(form)
      // Logging several tasks in a row: keep date, status, department and category.
      if (sticky) setForm(f => ({ ...f, description: '', ticket_no: '' }))
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="task-form" onSubmit={submit}>
      <label className="field">
        <span>Task</span>
        <textarea
          required
          maxLength={1000}
          value={form.description}
          onChange={set('description')}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault()
              e.currentTarget.form.requestSubmit()
            }
          }}
          placeholder="What did you do? e.g. Assisted HRD-JDELACRUZ with colored printing."
        />
      </label>
      <div className="row">
        <label className="field">
          <span>Date</span>
          <input type="date" required value={form.task_date} onChange={set('task_date')} />
        </label>
        <label className="field">
          <span>Status</span>
          <select value={form.status} onChange={set('status')}>
            {Object.entries(STATUS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
      </div>
      <div className="row">
        <label className="field">
          <span>Ticket # <em>optional</em></span>
          <input value={form.ticket_no} maxLength={40} onChange={set('ticket_no')} placeholder="IT-HR-191" autoComplete="off" />
        </label>
        <label className="field">
          <span>Department</span>
          <input list="departments" value={form.department} maxLength={80} onChange={set('department')} placeholder="HR" autoComplete="off" />
        </label>
      </div>
      <label className="field">
        <span>Category <em>report heading</em></span>
        <input list="categories" value={form.category} maxLength={120} onChange={set('category')} placeholder="Technical Support" autoComplete="off" />
      </label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="form-actions">
        {children}
        <button className="btn primary" disabled={busy}>
          {sticky && <Icon name="plus" size={16} />} {busy ? 'Saving…' : submitLabel}
        </button>
      </div>
    </form>
  )
}
