import { AlignmentType, Document, LevelFormat, Packer, Paragraph, TextRun } from 'docx'

const DAY_MS = 86_400_000
const longDate = new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
const monthName = new Intl.DateTimeFormat('en-US', { month: 'long', timeZone: 'UTC' })
const and = new Intl.ListFormat('en', { type: 'conjunction' })
const utc = iso => new Date(`${iso}T00:00:00Z`)
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`
const ordinal = n => n + (['th', 'st', 'nd', 'rd'][n] ?? 'th') // weeks of a month are 1–6

export const spanDays = (from, to) => (utc(to) - utc(from)) / DAY_MS + 1

// "October 26–30, 2026" within a month, "October 30 – November 3, 2026" across months.
export function dateCovered(from, to) {
  const a = utc(from), b = utc(to)
  const sameMonth = a.getUTCFullYear() === b.getUTCFullYear() && a.getUTCMonth() === b.getUTCMonth()
  return longDate.formatRange(a, b).replace(/\s–\s/, sameMonth ? '–' : ' – ')
}

// Weekly reports keep the team's file naming, e.g. "October 5th Weekly Task Report.docx"
// (weeks start on Monday; week 1 is the one containing the 1st).
function fileName(from, to, weekly) {
  if (!weekly) return `Task Report ${from} to ${to}.docx`
  const d = utc(from)
  const offset = (new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).getUTCDay() + 6) % 7
  return `${monthName.format(d)} ${ordinal(Math.ceil((d.getUTCDate() + offset) / 7))} Weekly Task Report.docx`
}

// rows: done tasks in the range, ordered by task_date, id.
export function buildReport(rows, from, to) {
  const weekly = utc(from).getUTCDay() === 1 && spanDays(from, to) <= 7
  const covered = dateCovered(from, to)
  const days = []
  const departments = new Map()
  const categories = new Map()
  let tickets = 0

  for (const t of rows) {
    let day = days.at(-1)
    if (day?.date !== t.task_date) days.push((day = { date: t.task_date, label: longDate.format(utc(t.task_date)), groups: [] }))
    const category = t.category || 'General Support'
    let group = day.groups.find(g => g.category === category)
    if (!group) day.groups.push((group = { category, lines: [] }))
    group.lines.push(t.ticket_no ? `Resolved ${t.ticket_no}: ${t.description}` : t.description)
    if (t.ticket_no) tickets++
    if (t.department) departments.set(t.department, (departments.get(t.department) ?? 0) + 1)
    categories.set(category, (categories.get(category) ?? 0) + 1)
  }

  const mostFirst = map => [...map].sort((a, b) => b[1] - a[1]).map(([name]) => name)
  const units = mostFirst(departments)
  const period = weekly ? `the week of ${covered}` : `the period of ${covered}`
  const summary = rows.length
    ? `During ${period}, ${units.length ? `supported ${and.format(units)} ${units.length === 1 ? 'unit' : 'units'}, completing` : 'completed'} ` +
      `${plural(rows.length, 'task')}${tickets ? ` including ${plural(tickets, 'resolved ticket')}` : ''}. ` +
      `Major accomplishments included ${and.format(mostFirst(categories).slice(0, 5))}.`
    : `No completed tasks were recorded for ${period}.`

  return {
    from,
    to,
    title: weekly ? 'Weekly Task Report' : 'Task Report',
    dateCovered: covered,
    filename: fileName(from, to, weekly),
    summary,
    total: rows.length,
    days,
  }
}

// Mirrors the reference report: Arial, A4, justified, bold headings at 11/18/16/12 pt, bullets at 12 pt.
const para = (text = '', size = 11, bold = false, extra = {}) =>
  new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    ...extra,
    children: text ? [new TextRun({ text, size: size * 2, bold, font: 'Arial' })] : [],
  })

export function reportDocx(report, summary = report.summary) {
  const children = [
    para(report.title, 11, true),
    para(`Date Covered: ${report.dateCovered}`, 11, true),
    para(),
    para('Summary of Activities', 11, true),
    para(),
    ...summary.split('\n').map(s => s.trim()).filter(Boolean).map(s => para(s)),
    para(),
    para('Detailed Accomplishments', 18, true),
    para(),
  ]
  if (!report.days.length) children.push(para('No completed tasks in this period.', 12))
  for (const day of report.days) {
    children.push(para(), para(day.label, 16, true))
    for (const group of day.groups) {
      children.push(para(`${group.category}:`, 12, true))
      for (const line of group.lines) children.push(para(line, 12, false, { numbering: { reference: 'bullet', level: 0 } }))
    }
  }

  const doc = new Document({
    creator: 'NNO Task Management',
    title: report.title,
    styles: { default: { document: { run: { font: 'Arial', size: 22 } } } },
    numbering: {
      config: [{
        reference: 'bullet',
        levels: [{
          level: 0,
          format: LevelFormat.BULLET,
          text: '',
          alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } }, run: { font: 'Symbol', size: 20 } },
        }],
      }],
    },
    sections: [{
      properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1440, right: 1800, bottom: 1440, left: 1800 } } },
      children,
    }],
  })
  return Packer.toBuffer(doc)
}
