import test from 'node:test'
import assert from 'node:assert/strict'
import { buildReport, dateCovered } from './report.js'

test('weekly report follows the reference layout', () => {
  const rows = [
    { task_date: '2026-10-26', ticket_no: 'IT-HR-191', department: 'HR', category: 'HR & Employee Onboarding Support', description: 'Assisted HRD-JDOE with colored printing.' },
    { task_date: '2026-10-26', ticket_no: null, department: 'Sales', category: 'Technical Support', description: 'Assisted SLD-JDOE with an Excel file issue.' },
    { task_date: '2026-10-26', ticket_no: 'IT-HR-193', department: 'HR', category: 'HR & Employee Onboarding Support', description: 'Created Bitrix account for new hire.' },
    { task_date: '2026-10-27', ticket_no: null, department: null, category: null, description: 'Configured BA tablet.' },
  ]
  const r = buildReport(rows, '2026-10-26', '2026-10-30')

  assert.equal(r.title, 'Weekly Task Report')
  assert.equal(r.dateCovered, 'October 26–30, 2026')
  assert.equal(r.filename, 'October 5th Weekly Task Report.docx')
  assert.deepEqual(r.days.map(d => d.label), ['October 26, 2026', 'October 27, 2026'])
  assert.deepEqual(r.days[0].groups.map(g => [g.category, g.lines.length]), [['HR & Employee Onboarding Support', 2], ['Technical Support', 1]])
  assert.equal(r.days[0].groups[0].lines[0], 'Resolved IT-HR-191: Assisted HRD-JDOE with colored printing.')
  assert.equal(r.days[1].groups[0].category, 'General Support')
  assert.match(r.summary, /^During the week of October 26–30, 2026, supported HR and Sales units, completing 4 tasks including 2 resolved tickets\./)

  assert.equal(dateCovered('2026-10-30', '2026-11-03'), 'October 30 – November 3, 2026')
  assert.equal(buildReport([], '2026-10-01', '2026-10-31').filename, 'Task Report 2026-10-01 to 2026-10-31.docx')
})
