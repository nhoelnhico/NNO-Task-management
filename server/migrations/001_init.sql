CREATE TABLE tasks (
  id          INTEGER PRIMARY KEY,
  task_date   TEXT    NOT NULL,                       -- YYYY-MM-DD, the day the work belongs to
  status      TEXT    NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'done')),
  ticket_no   TEXT,                                   -- e.g. IT-HR-191, stored uppercase
  department  TEXT,                                   -- unit supported, used in the report summary
  category    TEXT,                                   -- report heading, e.g. "Technical Support"
  description TEXT    NOT NULL CHECK (length(description) BETWEEN 1 AND 1000),
  created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
) STRICT;

-- Task list: newest first, optional "on or before" date, keyset cursor on (task_date, id).
CREATE INDEX tasks_date_id ON tasks (task_date, id);
-- Status tabs and the report (status = 'done' AND task_date BETWEEN ...).
CREATE INDEX tasks_status_date_id ON tasks (status, task_date, id);
-- A ticket is logged once; untracked tasks (no ticket) are unlimited.
CREATE UNIQUE INDEX tasks_ticket_no ON tasks (ticket_no) WHERE ticket_no IS NOT NULL;
