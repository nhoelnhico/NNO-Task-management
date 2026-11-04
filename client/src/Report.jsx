import { useEffect, useState } from 'react'
import { addDays, api, Icon, workWeek } from './lib.jsx'

// The edited summary is kept per date range in this browser so a refresh doesn't lose it.
const savedSummary = {
  get: key => { try { return localStorage.getItem(key) } catch { return null } },
  set: (key, value) => { try { value === null ? localStorage.removeItem(key) : localStorage.setItem(key, value) } catch {} },
}

export default function Report() {
  // The range lives in the URL (/report?from=…&to=…) so any report can be bookmarked or shared as a link.
  const [range, setRange] = useState(() => {
    const p = new URLSearchParams(location.search)
    const week = workWeek()
    return { from: p.get('from') || week.from, to: p.get('to') || week.to }
  })
  const [report, setReport] = useState(null)
  const [summary, setSummary] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const key = `summary:${range.from}:${range.to}`

  useEffect(() => {
    if (!range.from || !range.to) return
    const query = `from=${range.from}&to=${range.to}`
    history.replaceState(null, '', `/report?${query}`)
    let alive = true
    setError('')
    api(`/report?${query}`).then(
      r => { if (alive) { setReport(r); setSummary(savedSummary.get(key) ?? r.summary) } },
      err => { if (alive) { setReport(null); setError(err.message) } },
    )
    return () => { alive = false }
  }, [range.from, range.to])

  const shift = weeks => setRange(r => ({ from: addDays(r.from, weeks * 7), to: addDays(r.to, weeks * 7) }))
  const edited = report && summary !== report.summary

  function editSummary(value) {
    setSummary(value)
    savedSummary.set(key, value === report?.summary ? null : value)
  }

  async function download() {
    setBusy(true)
    setError('')
    try {
      const blob = await api('/report/docx', { method: 'POST', body: { ...range, summary } })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = report.filename
      a.click()
      setTimeout(() => URL.revokeObjectURL(a.href), 1000)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(location.href)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      prompt('Copy this link:', location.href)
    }
  }

  return (
    <div className="report-layout">
      <aside className="panel glass report-controls" aria-labelledby="report-title">
        <div className="panel-head">
          <h1 id="report-title">Report</h1>
          {report && <span className="hint">{report.total} done</span>}
        </div>

        <div className="week-nav">
          <button className="icon-btn" onClick={() => shift(-1)} aria-label="Previous week"><Icon name="left" /></button>
          <button className="btn ghost" onClick={() => setRange(workWeek())}>This week</button>
          <button className="icon-btn" onClick={() => shift(1)} aria-label="Next week"><Icon name="right" /></button>
        </div>

        <div className="row">
          <label className="field">
            <span>From</span>
            <input type="date" value={range.from} max={range.to} onChange={e => setRange(r => ({ ...r, from: e.target.value }))} />
          </label>
          <label className="field">
            <span>To</span>
            <input type="date" value={range.to} min={range.from} onChange={e => setRange(r => ({ ...r, to: e.target.value }))} />
          </label>
        </div>

        <div className="field">
          <div className="field-head">
            <label htmlFor="summary">Summary of activities</label>
            {edited && <button className="link-btn" onClick={() => editSummary(report.summary)}>Reset to draft</button>}
          </div>
          <textarea id="summary" className="summary-input" value={summary} maxLength={5000} onChange={e => editSummary(e.target.value)} disabled={!report} />
          <span className="hint">Drafted from the week’s tasks. Edit freely — it’s saved in this browser.</span>
        </div>

        {error && <p className="form-error" role="alert">{error}</p>}

        <div className="actions">
          <button className="btn primary" onClick={download} disabled={!report || busy}>
            <Icon name="download" size={16} /> {busy ? 'Preparing…' : 'Download Word (.docx)'}
          </button>
          <div className="row">
            <button className="btn ghost" onClick={() => print()} disabled={!report}><Icon name="print" size={16} /> Print / PDF</button>
            <button className="btn ghost" onClick={copyLink}><Icon name="link" size={16} /> {copied ? 'Copied' : 'Copy link'}</button>
          </div>
        </div>
        <p className="hint">Only tasks marked <b>Done</b> are included, grouped by date and category.</p>
      </aside>

      <section className="paper-wrap" aria-label="Report preview">
        {report ? (
          <article className="paper">
            <p className="b">{report.title}</p>
            <p className="b gap">Date Covered: {report.dateCovered}</p>
            <p className="b gap">Summary of Activities</p>
            {summary.split('\n').filter(s => s.trim()).map((s, i) => <p key={i}>{s}</p>)}
            <h2>Detailed Accomplishments</h2>
            {!report.days.length && <p className="muted">No completed tasks in this period.</p>}
            {report.days.map(day => (
              <section key={day.date}>
                <h3>{day.label}</h3>
                {day.groups.map(g => (
                  <div key={g.category}>
                    <h4>{g.category}:</h4>
                    <ul>{g.lines.map((line, i) => <li key={i}>{line}</li>)}</ul>
                  </div>
                ))}
              </section>
            ))}
          </article>
        ) : (
          !error && <div className="paper skeleton-paper" aria-busy="true" />
        )}
      </section>
    </div>
  )
}
