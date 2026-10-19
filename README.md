# McMorrow IMS

Internal Quality Management System: training, employees, projects, suppliers, preventive maintenance, audits, documents and administration.

Stack: Next.js (App Router), TypeScript, Supabase (Auth, Postgres, Storage, RLS), Tailwind CSS, shadcn/ui, Lucide, React Hook Form, Zod.

This is not a frontend-only demo. CRUD, authentication, authorization and file access run against Supabase. Without a configured project the app shows `/setup` instead of crashing.

## Quick start

```bash
npm install
cp .env.example .env.local
```

Fill in the three Supabase keys (see **[docs/SUPABASE_SETUP.md](docs/SUPABASE_SETUP.md)** — do this after you create a Supabase account). Then:

```bash
npm run dev          # http://localhost:3000
```

Until `.env.local` is filled in, every route redirects to `/setup` with the same steps.

Production build:

```bash
npm run build
npm start
npx eslint .
```

## Demo users

After you run migrations, `supabase/seed.sql` and `npm run seed`:

| Email | Role | Password |
| --- | --- | --- |
| `admin@mcmorrow-ims.local` | Admin | `McMorrowIMS123!` |
| `manager@mcmorrow-ims.local` | Manager | `McMorrowIMS123!` |
| `employee@mcmorrow-ims.local` | Employee | `McMorrowIMS123!` |
| `auditor@mcmorrow-ims.local` | Quality & Compliance | `McMorrowIMS123!` |
| `training@mcmorrow-ims.local` | Finance & Administration | `McMorrowIMS123!` |
| `projects@mcmorrow-ims.local` | Construction Management | `McMorrowIMS123!` |
| `suppliers@mcmorrow-ims.local` | Finance & Administration | `McMorrowIMS123!` |
| `maintenance@mcmorrow-ims.local` | Finance & Administration | `McMorrowIMS123!` |

Override the password with `SEED_DEMO_PASSWORD` in `.env.local` before seeding.

Priya (`employee@…`) reports to James (`manager@…`) so team training views have data.

## Routes

| Path | Module |
| --- | --- |
| `/` | Home: module buttons + document folders (authorised files only) |
| `/training` | Training hub |
| `/training/employees`, `/employees` | Employee directory |
| `/training/catalogue`, `/training/new`, `/training/[id]` | Catalogue and courses |
| `/training/assign`, `/training/my`, `/training/team` | Assignments |
| `/projects`, `/suppliers`, `/maintenance`, `/audits` | Remaining modules |
| `/documents` | Document library (module → record → files) |
| `/admin` | Users, roles & permissions, departments, job titles, training config, documents, audit logs, settings (reminders, sites/plant list, project roles) |
| `/profile`, `/profile/change-password` | Account |
| `/login`, `/forgot-password`, `/reset-password` | Auth |

## Architecture

```
app/(app)/          signed-in pages (layout + header)
app/(auth)/         login / password flows
app/api/documents/  signed-URL download (session + RLS + documents.download)
lib/auth/           session, permission keys, page/action guards
lib/actions/        server actions (Zod → RLS-backed mutations)
lib/data/           server queries (same RLS client)
lib/documents/      storage paths, signed uploads
supabase/migrations SQL schema, RLS, storage policies
supabase/seed.sql   permissions, roles, departments, job titles, settings
scripts/seed.ts     Auth users + demo business records
```

Authorization is permission-keyed (`training.view`, `admin.users`, …), not `if (user.isAdmin)`. Roles and grants are editable in Admin Settings. The UI hides controls the user cannot use; **server actions and RLS still reject unauthorized calls**.

Documents live in a **private** Storage bucket (`documents`). Paths look like `training/{id}/…`. Browsers never receive a public URL — only a short-lived signed URL from `/api/documents/[id]/download` after the document row is visible under RLS.

The service role key is used only on the server for Auth Admin APIs (create user, reset password, delete user). It is never sent to the browser.

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Next.js development server |
| `npm run build` / `npm start` | Production |
| `npm run seed` | Create demo Auth users and sample records |
| `npm run db:types` | Regenerate `lib/types/database.ts` from a linked project (optional) |

## Environment

See `.env.example`. Required:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server only)
- `NEXT_PUBLIC_SITE_URL` (used in password-reset email redirects)

Full setup, including SQL, Storage and Auth URL configuration, is in **[docs/SUPABASE_SETUP.md](docs/SUPABASE_SETUP.md)**.
