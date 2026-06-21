# School Management System

A complete management system for a Ghanaian basic school (KG 1 – JHS 3), built for
**Atwima Kwanwoma Municipality** and designed to run entirely on **free hosting**
(Vercel + Supabase — see [DEPLOYMENT.md](DEPLOYMENT.md)).

## What it does

| Module | Details |
| --- | --- |
| **Students** | Admissions register, search/filter, guardian details, class assignment, status (active/transferred/graduated). |
| **Scores & report cards** | Class score + exam score per subject (each /100, weighted 50/50 like the GES SBA split), automatic grades and remarks, class positions, printable GES-style terminal report cards — one pupil or the whole class at once. |
| **Attendance** | Daily class register (present/late/absent). Term totals appear automatically on report cards. |
| **Fees** | Fee items per term (school-wide or per class), payment recording (cash / mobile money / bank), automatic numbered receipts with amount-in-words, debtors list, per-student statements. |
| **Staff & timetable** | Teacher records and logins, class-teacher and subject assignments, weekly timetable per class (teachers filled in automatically). |
| **Transcripts** | Printable full-history transcript per learner (every year/term with grades, averages and attendance) for completion and transfer cases — from the student's profile. |
| **Analytics** | Interactive charts: per-student trends (term average vs class, subject strengths/weaknesses, attendance) and an admin school dashboard (enrollment, class/subject averages, attendance, fees). |
| **Portals** | Students and parents log in to see results, attendance, fee balance, the class timetable and a printable report card. A parent account can be linked to several children. |
| **Settings** | School profile (appears on report cards/receipts), academic years & terms, current-term switch, login management and password resets. |

## Who can log in

| Role | Can do |
| --- | --- |
| **Admin** | Everything: students, fees, staff, settings, analytics, transcripts, plus all teacher functions. |
| **Teacher** | Only their assigned classes: students (read-only), scores, report cards, Excel score sheets, timetables, per-student analytics. |
| **Class teacher / Form master·mistress** | A teacher set as a class's teacher (Classes page) additionally marks that class's attendance and fills conduct & remarks. |
| **Student / Parent** | Read-only portal for their own (or their children's) results, attendance, fees and timetable. |

## Run it locally (free, no accounts needed)

Requirements: [Node.js](https://nodejs.org) 20 or newer.

```bash
npm install
npm run db:setup     # creates the local SQLite database and seeds demo data
npm run dev          # open http://localhost:3000
```

Demo logins (all seeded):

| Username | Password | Role |
| --- | --- | --- |
| `admin` | `admin123` | Administrator |
| `teacher1` | `teacher123` | Class teacher, Basic 5 |
| `teacher2` | `teacher123` | Class teacher, JHS 1 |
| `student1` | `student123` | Student (JHS 1) |
| `parent1` | `parent123` | Parent of two Basic 5 pupils |

> **Change the admin password before real use** (Settings → Login accounts).

## Everyday workflows

- **Start of year/term:** Settings → add the academic year (terms are created automatically),
  fix the term dates, press **Make current**.
- **Admit pupils:** Students → Admit student (admission numbers are suggested automatically), or
  **Excel Sheets → Bulk admit learners** to upload a whole register at once.
- **Enter scores in Excel:** Excel Sheets → pick class + term → download score sheets (one sheet
  per subject, names pre-filled). Teachers fill 4 class works (total /60, flagged red if over,
  auto-converted to 50%) and the exam /100 (auto-converted to 50%); the final /100 is computed.
  Upload the same file to save everything. Teachers' own subjects are pre-ticked for download.
- **Enter scores online (same as the sheet):** the Scores page shows the four class works per
  pupil; the /60 total (flagged red if exceeded), the 50% conversions, final mark, grade and
  remark are computed live as you type — identical to the Excel sheet. Use whichever you prefer:
  type online, or download/fill/upload the sheet. The four class works round-trip between both.
- **Drafts survive disconnections:** anything typed into the Scores, Attendance, Remarks &
  conduct, or Student/Teacher forms is saved on the device as you go. If the connection drops or
  the tab closes before saving, reopening the page offers to **restore your entries**.
- **No silent overwrites:** every score records who saved it ("Last saved" column on the Scores
  page). If two teachers work on the same subject, a save or upload that would overwrite values
  someone else entered in the meantime is **rejected** with the pupil-by-pupil details (who, when,
  both values) — it only goes through if "Replace newer data" is explicitly confirmed.
- **Attendance (end of term):** Attendance → "Term totals" → pick class & term → enter total
  school days and each pupil's days present (absent and % compute live), or download the Excel
  template, fill it from the register, and upload. Only the class teacher / form master of a class
  can do this. A "Daily register" tab is also available for future day-by-day marking.
- **End of term:** Scores → enter class + exam scores per subject → Report Cards → pick the class →
  **Print all report cards** (each pupil prints on one A4 page).
- **Fees:** Fees → add the term's fee items once → record payments as they come in →
  print the receipt that opens automatically. The debtors table always shows who still owes.
- **New class for new year:** edit each student's class on their profile (Students → student → Class),
  or ask a developer to script a bulk promotion.
- **Portal logins:** on a student's page create a student login and/or a parent login
  (siblings can share one parent account via "link existing parent").
- **Own account:** every user clicks their avatar (bottom of the sidebar; top-right in the
  portal) to change their own name and password — teachers also manage their scanned
  signature there.
- **Backups:** `npm run db:backup` writes every table to `backups/backup-<date>.json`.
  Do this at least once a term and keep a copy on a flash drive or Google Drive.

## Customising for your school

- **School name, motto, head teacher** — Settings page (shows on report cards, receipts, login screen).
- **Logo & signatures** — Settings → "Logo & signatures": upload the school logo (shown on the
  login page, sidebars, report cards and receipts) and the head teacher's scanned signature
  (shown on report cards). Each teacher's signature is uploaded on their Staff page by the admin,
  or by the teacher themselves under **My Signature**. Images are stored in the database, so no
  extra file-storage service is needed on free hosting.
- **Classes & streams** — Classes page: add, rename, reorder or delete classes. Classes are
  seeded as KG 1–2, Basic 1–6 and JHS 1–3. For a two-stream school add e.g. "Basic 5A" and
  "Basic 5B" with the same order number. Classes with scores or attendance history can't be
  deleted (old report cards depend on them) — rename instead.
- **Subjects** — Settings → Subjects: add/remove subjects and tick the stages (KG/Primary/JHS)
  each one is taught at. Subjects with recorded scores can't be deleted; untick all stages to
  retire them. The GES standard-based curriculum is pre-seeded.
- **Additional administrators** — Settings → Login accounts → "Create an additional administrator"
  (e.g. for the head teacher).
- **Grading scales** — Settings → "Grading scales": KG & Primary and JHS each have their own
  fully editable scale (boundaries, grades and remarks). Report cards and the Scores page use
  them immediately.
- **Two heads of school** — Settings → School information: the Headteacher (KG & Primary) and
  the JHS head, whose title is "Headmaster" or "Headmistress". Report cards automatically show
  the right name, title, remarks label and signature for the class's section.
- **Remarks & conduct** — Report Cards → pick a class → "Remarks & conduct": type each pupil's
  conduct, class teacher's remarks and head's remarks. Anything left empty falls back to an
  automatic remark based on the pupil's average.
- **Periods per day / school days** — [lib/format.ts](lib/format.ts) (`PERIODS`, `WEEKDAYS`).
- **Admission number prefix** — `AKW-` in `app/(staff)/students/actions.ts`.

## Tech stack

- **Next.js 16** (App Router, server components + server actions — minimal JavaScript shipped,
  so it stays fast on slow connections and cheap phones)
- **Prisma 6** ORM — **SQLite** locally, **Postgres (Supabase/Neon)** in production
- **Tailwind CSS 4**, no UI framework, A4 print stylesheets for report cards and receipts
- **Font Awesome** icons (tree-shaken SVG via `@fortawesome/react-fontawesome` — only the icons
  used are bundled, no CDN request or webfont download, so it stays light on slow connections)
- Username/password auth with bcrypt + signed HTTP-only session cookies (no email needed —
  practical for parents without email addresses)

## Project layout

```
app/
  login/            sign-in page
  (staff)/          admin & teacher pages (dashboard, students, classes,
                    attendance, scores, reports, fees, staff, timetable, settings)
  portal/           student & parent read-only portal
components/         shared UI (report card, forms, sidebar, print button)
lib/                db client, auth/sessions, grading rules, report builder, fees maths
prisma/             schema + seed data
scripts/backup.ts   JSON backup of every table
```

## Deploying for free

See **[DEPLOYMENT.md](DEPLOYMENT.md)** — step-by-step instructions for Vercel (app hosting)
+ Supabase (database), both on permanently free tiers, no credit card required.
