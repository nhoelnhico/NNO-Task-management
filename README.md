# NNO Task Management

Log daily IT support tasks, track them by status, and generate the **Weekly Task Report** (Word .docx) for any week or custom date range.

## Stack

| Layer | Choice | Version |
|---|---|---|
| Runtime | Node.js | ≥ 22.13 (developed on 26.12.1) |
| API | Express | 5.3.0 |
| Database | SQLite via built-in `node:sqlite` (no install) | 3.54.0 (bundled with Node 26) |
| Front end | React | 19.3.1 |
| Build / dev server | Vite + @vitejs/plugin-react | 8.3.5 / 6.2.1 |
| Word export | docx | 9.15.2 |
| Package manager | npm | 11.19.1 |

## Prerequisites

```bash
node --version    # need >= 22.13 (node:sqlite is built in from there)
npm --version
git --version
```

Nothing else: no database server to install. The database is one file, `data/tasks.db`.

## Installation

1. Clone and enter the project:
   ```bash
   git clone <repo-url> NNO-Task-management
   cd NNO-Task-management
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. (Optional) copy the example config. Defaults work without it:
   ```bash
   cp .env.example .env
   ```
4. Start the dev server:
   ```bash
   npm run dev
   ```

**It worked if** the terminal prints `Applied migration 001_init.sql` (first run only), then `NNO Task Management running at http://127.0.0.1:4000`, and that URL opens the Tasks page.

## Configuration

`.env` is gitignored. Never commit it. `.env.example` is the committed template.

| Variable | Purpose | Required | Example |
|---|---|---|---|
| `PORT` | Port the app listens on | no (default `4000`) | `4000` |
| `HOST` | Network interface. `127.0.0.1` = this PC only; `0.0.0.0` = whole LAN | no (default `127.0.0.1`) | `127.0.0.1` |
| `DB_PATH` | SQLite file, relative to the project folder or absolute | no (default `data/tasks.db`) | `data/tasks.db` |

> There is no login yet. Keep `HOST=127.0.0.1` unless everyone on the network is allowed to edit tasks.

## Running the system

| | Command | URL |
|---|---|---|
| Development | `npm run dev` | http://127.0.0.1:4000 |
| Production | `npm run build` then `npm start` | http://127.0.0.1:4000 |
| Tests | `npm test` | — |

- **Dev** runs Vite inside the Express server: one process, one port. React changes hot-reload. **Server changes (`server/*`) need a restart** (Ctrl+C, `npm run dev`). Don't add `node --watch`: on Windows it also watches Vite's temp files and restarts forever.
- **Production** serves the built files from `dist/`. Run `npm run build` again after any change in `client/`.

## Using it

- **Tasks page**: type what you did and press **Enter**. Date, status, department and category stay filled in, so logging a run of tasks is fast. Click a task to edit or delete it. Change a task's status with the coloured pill.
- **The list** scrolls inside its own panel and loads 50 tasks at a time as you scroll. Filter with search (matches task, ticket, department, category), the status tabs, or **Up to** (show tasks on or before a date).
- **Report page**: pick a week with ‹ › or **This week**, or set any From/To range. Only **Done** tasks are included, grouped by date and then by category, in the same layout as the original Word report.
  - The summary paragraph is drafted automatically. Edit it freely; edits are kept in that browser for that date range.
  - **Download Word (.docx)** saves e.g. `October 5th Weekly Task Report.docx`. **Print / PDF** uses the browser's print dialog.
  - The page URL holds the range (`/report?from=2026-10-26&to=2026-10-30`). Bookmark it or use **Copy link** to share that exact report.
- Ticketed tasks appear as `Resolved IT-HR-191: <task>`. Ticket numbers are stored uppercase and can only be logged once.

## Database & migrations

The tool is a tiny built-in runner (`server/db.js`): SQL files in `server/migrations/`, applied in number order, tracked by `PRAGMA user_version` inside the database file.

1. **Create the database from empty**: start the app (`npm run dev` or `npm start`). It creates `data/tasks.db` and applies every migration.
2. **Apply pending migrations**: they apply automatically on every start, or run them alone:
   ```bash
   npm run migrate
   ```
3. **Create a new migration**: add `server/migrations/NNN_short_name.sql` using the next number (`002_add_priority.sql`). Each file runs in a transaction; if it fails, nothing from that file is kept.
4. **Roll back**: not supported. Write a new forward migration that undoes the change, and back up first (below).

**Back up** (safe while the app is running):
```bash
node -e "new (require('node:sqlite').DatabaseSync)('data/tasks.db').exec(\"VACUUM INTO 'tasks-backup.db'\")"
```

This writes one self-contained file, `tasks-backup.db`. Don't back up by copying `data/tasks.db` on its own: recent changes may still be in `data/tasks.db-wal`, and a copy of just the main file can be missing them or empty.

**Move to the main PC**: clone, `npm install`, `npm run build`, create `.env`. To bring existing tasks across, run the backup command above on the dev PC, copy `tasks-backup.db` to the main PC as `data/tasks.db`, then `npm start`. Pending migrations apply on first start.

## How to modify common things

**Add a field to tasks** (e.g. priority)
1. Create `server/migrations/002_add_priority.sql`: `ALTER TABLE tasks ADD COLUMN priority TEXT;`
2. In `server/index.js`: add it to `FIELDS`, `LABELS`, `COLUMNS` and the `insertTask` statement
3. Add the input to `TaskForm` and `toForm` in `client/src/Tasks.jsx`
4. Restart the server, which applies the migration, then add a row to the Migration log below

**Change the report wording or Word formatting**
- Text, grouping and the auto summary: `buildReport` in `server/report.js`
- Fonts, sizes, page size and bullets: `reportDocx` in `server/report.js`
- On-screen preview: `client/src/Report.jsx` and the `.paper` styles in `client/src/styles.css`
- Run `npm test` afterwards. `server/report.test.js` checks the layout rules.

**Change the department suggestions**: `DEPARTMENTS` in `client/src/Tasks.jsx`. Previously used departments and categories are suggested automatically.

**Change what "a week" means** (currently Monday–Friday): `workWeek` in `client/src/lib.jsx`.

**Change colours or theme**: the tokens at the top of `client/src/styles.css`. Each one is `light-dark(<light>, <dark>)`.

**Add an API endpoint**: add a route in `server/index.js` before the `app.use('/api', …404)` line. Validate input there and throw `fail(status, message)` for user errors.

## Project structure

```
client/                 React front end (Vite root)
  index.html
  src/                  App shell, Tasks page, Report page, helpers, styles
server/
  index.js              Express app: API routes, validation, dev/prod serving
  db.js                 SQLite connection + migration runner
  report.js             Report model + Word (.docx) export
  report.test.js        Layout check (npm test)
  migrations/           Numbered .sql schema files
data/                   SQLite database (gitignored, created on first run)
dist/                   Production build (gitignored, from npm run build)
reference/              Sample of the original Word report
```

## Troubleshooting

| You see | Cause | Fix |
|---|---|---|
| `Error: listen EADDRINUSE: address already in use 127.0.0.1:4000` | The app (or something else) is already on port 4000 | Close the other terminal, or set `PORT=4001` in `.env` |
| `ENOENT: no such file or directory … dist\index.html` after `npm start` | Production build not made yet | `npm run build`, then `npm start` |
| `No such built-in module: node:sqlite` | Node.js older than 22.13 | Install current Node LTS |
| Server keeps printing `Restarting 'server/index.js'` | `--watch` added to the dev script (Windows) | Remove it and restart manually after server edits |
| Other PCs can't open the app | `HOST` is `127.0.0.1` (this PC only) | Set `HOST=0.0.0.0`, but add login first (no auth yet) |
| "That ticket number is already logged on another task." | Ticket numbers are unique | Search the ticket number to find the existing task |

## Changelog

### 2026-11-04
- Initial release: task log with quick add, inline status, edit/delete dialog, search, status and date filters, and an infinite-scrolling task list
- Weekly / custom-range report with an editable summary, Word (.docx) export matching the reference layout, print to PDF, and shareable report links
- Light and dark theme
- New database `data/tasks.db` with migration `001_init.sql`. **Requires migration** (automatic on first start)
- New optional env vars `PORT`, `HOST`, `DB_PATH`. **See `.env.example`**

## Migration log

| # | Date | File | What it changed | Applied on dev | Applied on main |
|---|---|---|---|---|---|
| 001 | 2026-11-04 | `001_init.sql` | Created `tasks` table; indexes on `(task_date, id)`, `(status, task_date, id)`; unique `ticket_no` | ✅ | ⬜ |
