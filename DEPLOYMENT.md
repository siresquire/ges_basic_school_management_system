# Free deployment guide (Vercel + Supabase)

Total cost: **GH₵ 0 / month**. No credit card is required for any step.

| Piece | Service | Free tier |
| --- | --- | --- |
| Web app | [Vercel](https://vercel.com) (Hobby plan) | Far more than a single school needs |
| Database | [Supabase](https://supabase.com) (Free plan) | 500 MB Postgres — years of data for a basic school |
| Code hosting | [GitHub](https://github.com) | Free private repository |

> **Alternative database:** [Neon](https://neon.tech) free tier also works with the exact same
> steps (it never pauses your project; Supabase pauses after ~1 week without visitors — see
> "Good to know" below).

---

## Step 1 — Put the code on GitHub

1. Create a free account at github.com and create a **new private repository**
   (e.g. `school-management-system`). Do not add a README.
2. In this project folder run:

```bash
git add -A
git commit -m "School management system"
git remote add origin https://github.com/YOUR_USERNAME/school-management-system.git
git push -u origin main
```

(The `.gitignore` already keeps secrets — `.env` — and the local database out of git.)

## Step 2 — Create the free Supabase database

1. Sign up at supabase.com (you can use your GitHub account).
2. **New project** → name it (e.g. `school-sms`), choose a strong **database password**
   (save it!), pick the region closest to Ghana (**West EU / London or Frankfurt**) → Create.
3. When it finishes, click **Connect** (top bar). You need **two** connection strings:
   - **Transaction pooler** (port `6543`) → this becomes `DATABASE_URL`.
     Add `?pgbouncer=true&connection_limit=1` at the end.
   - **Session pooler** (port `5432`) → this becomes `DIRECT_URL`.
   - In both, replace `[YOUR-PASSWORD]` with the database password from step 2.

Example (yours will have different host/user values):

```
DATABASE_URL="postgresql://postgres.abcd1234:MyPassword@aws-0-eu-west-2.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1"
DIRECT_URL="postgresql://postgres.abcd1234:MyPassword@aws-0-eu-west-2.pooler.supabase.com:5432/postgres"
```

## Step 3 — Switch Prisma from SQLite to Postgres

In [prisma/schema.prisma](prisma/schema.prisma) change the datasource block to:

```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}
```

That is the **only code change needed** — the schema deliberately avoids anything
SQLite- or Postgres-specific.

## Step 4 — Create the tables and first data

Temporarily point your local `.env` at Supabase (keep a copy of the old lines):

```
DATABASE_URL="...the 6543 pooler string..."
DIRECT_URL="...the 5432 string..."
```

Then run:

```bash
npx prisma db push     # creates all tables in Supabase
npm run db:seed        # seeds classes, subjects, terms and the admin login
```

When it prints the demo logins, the database is ready.
(You can now restore your `.env` to the SQLite lines for local development —
or keep developing against Supabase, either works.)

## Step 5 — Deploy on Vercel

1. Sign up at vercel.com **with your GitHub account**.
2. **Add New → Project** → Import your `school-management-system` repository.
3. Before clicking Deploy, open **Environment Variables** and add these three:

| Name | Value |
| --- | --- |
| `DATABASE_URL` | the 6543 pooler string (with `?pgbouncer=true&connection_limit=1`) |
| `DIRECT_URL` | the 5432 string |
| `AUTH_SECRET` | a long random string — generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |

4. Click **Deploy**. After ~2 minutes you get a free address like
   `https://school-management-system-xyz.vercel.app`.

## Step 6 — First-day checklist on the live site

1. Log in as `admin` / `admin123`.
2. **Settings → Login accounts → reset the admin password immediately.**
3. Settings → School information → real school name, address, phone, motto, head teacher.
4. Settings → check term dates and the current term.
5. Delete/ignore demo people, or re-seed without them: remove the demo blocks from
   `prisma/seed.ts` before running Step 4 if you want a completely clean start.
6. Add teachers (Staff), admit students (Students), set the term's fee items (Fees).
7. Bookmark the address on the school's computer/phones; share student/parent logins.

---

## Good to know about the free tiers

- **Supabase pauses free projects after ~7 days with no traffic** (e.g. long vacation).
  Nothing is lost — log into supabase.com and click **Restore** (takes a minute).
  If that bothers you, use **Neon** instead: its free tier never pauses
  (same steps; Neon's dashboard also gives a pooled and a direct connection string).
- **Vercel Hobby** sleeps nothing and is plenty fast for dozens of simultaneous users.
- **Backups:** run `npm run db:backup` (with `.env` pointing at Supabase) once a term and
  keep the JSON file on a flash drive / Google Drive. Supabase free does not keep
  long-term backups for you.
- **Custom domain** (optional, the only thing that costs money): you can attach e.g.
  `portal.yourschool.edu.gh` in Vercel → Settings → Domains. The free
  `*.vercel.app` address works fine otherwise.

## Updating the app later

Push to GitHub — Vercel redeploys automatically:

```bash
git add -A
git commit -m "Describe your change"
git push
```

If you changed `prisma/schema.prisma`, also run `npx prisma db push` once
(with `.env` pointing at Supabase) before pushing.
