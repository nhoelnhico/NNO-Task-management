import { useEffect, useState } from 'react'
import { Icon } from './lib.jsx'
import Tasks from './Tasks.jsx'
import Report from './Report.jsx'

export default function App() {
  const [path, setPath] = useState(location.pathname)

  useEffect(() => {
    const sync = () => setPath(location.pathname)
    addEventListener('popstate', sync)
    return () => removeEventListener('popstate', sync)
  }, [])

  // Real links (so middle-click and "copy link" work) that navigate in-app on a plain click.
  function go(e) {
    if (e.button || e.metaKey || e.ctrlKey || e.shiftKey) return
    e.preventDefault()
    history.pushState(null, '', e.currentTarget.href)
    setPath(location.pathname)
  }

  const page = path.startsWith('/report') ? 'report' : 'tasks'

  return (
    <>
      <header className="topbar glass">
        <a href="/" className="brand" onClick={go}>
          <span className="brand-mark" aria-hidden="true" />
          NNO Tasks
        </a>
        <nav className="nav" aria-label="Main">
          <a href="/" onClick={go} aria-current={page === 'tasks' ? 'page' : undefined}>Tasks</a>
          <a href="/report" onClick={go} aria-current={page === 'report' ? 'page' : undefined}>Report</a>
        </nav>
        <ThemeToggle />
      </header>
      <main>{page === 'report' ? <Report /> : <Tasks />}</main>
    </>
  )
}

function ThemeToggle() {
  const [theme, setTheme] = useState(
    () => document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'),
  )
  function toggle() {
    const next = theme === 'dark' ? 'light' : 'dark'
    document.documentElement.dataset.theme = next
    try { localStorage.setItem('theme', next) } catch {}
    setTheme(next)
  }
  return (
    <button className="icon-btn" onClick={toggle} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>
      <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
    </button>
  )
}
