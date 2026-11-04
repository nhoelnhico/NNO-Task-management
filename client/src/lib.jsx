// Shared helpers: API calls, local-date math, icons.

export async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(`/api${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || `Request failed (${res.status})`)
  if (res.status === 204) return null
  return res.headers.get('content-type')?.includes('json') ? res.json() : res.blob()
}

export const STATUS = { todo: 'To do', in_progress: 'In progress', done: 'Done' }

// Dates are plain YYYY-MM-DD strings in the user's local time zone.
export const isoDate = (d = new Date()) => d.toLocaleDateString('en-CA')
const local = iso => new Date(`${iso}T00:00:00`)

export function addDays(iso, n) {
  const d = local(iso)
  d.setDate(d.getDate() + n)
  return isoDate(d)
}

// Monday–Friday of the week containing `iso`.
export function workWeek(iso = isoDate()) {
  const from = addDays(iso, -((local(iso).getDay() + 6) % 7))
  return { from, to: addDays(from, 4) }
}

const shortDay = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
const shortDayYear = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })

export function dayLabel(iso) {
  const today = isoDate()
  if (iso === today) return 'Today'
  if (iso === addDays(today, -1)) return 'Yesterday'
  if (iso === addDays(today, 1)) return 'Tomorrow'
  return (iso.slice(0, 4) === today.slice(0, 4) ? shortDay : shortDayYear).format(local(iso))
}

const PATHS = {
  search: 'M11 4a7 7 0 1 0 0 14a7 7 0 1 0 0-14z M20 20l-4-4',
  sun: 'M12 8a4 4 0 1 0 0 8a4 4 0 1 0 0-8z M12 2v2 M12 20v2 M4.9 4.9l1.4 1.4 M17.7 17.7l1.4 1.4 M2 12h2 M20 12h2 M4.9 19.1l1.4-1.4 M17.7 6.3l1.4-1.4',
  moon: 'M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z',
  left: 'M15 18l-6-6 6-6',
  right: 'M9 18l6-6-6-6',
  download: 'M12 4v11 M7 10l5 5 5-5 M5 20h14',
  print: 'M7 9V4h10v5 M7 17H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2 M7 14h10v6H7z',
  link: 'M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1 M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1',
  plus: 'M12 5v14 M5 12h14',
  x: 'M18 6L6 18 M6 6l12 12',
  trash: 'M4 7h16 M9 7V4h6v3 M6 7l1 13h10l1-13',
}

export const Icon = ({ name, size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={PATHS[name]} />
  </svg>
)
