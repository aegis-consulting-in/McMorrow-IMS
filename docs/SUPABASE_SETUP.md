# Supabase setup for McMorrow IMS

You can create the Supabase project whenever you are ready. The application will not talk to a live database until `.env.local` is filled in; until then it only shows the `/setup` page.

This document is the full checklist: project, SQL, Storage, Auth URLs, environment variables, and demo data.

---

## 1. Create a project

1. Open [https://supabase.com/dashboard](https://supabase.com/dashboard) and sign in.
2. **New project**.
3. Choose an organisation, a name (for example `mcmorrow-ims`), a strong database password (save it), and a region close to you.
4. Wait until the project is healthy.

---

## 2. Copy API keys

In the dashboard: **Project Settings → API**.

| App variable | Dashboard name | Where it may be used |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL | Browser and server |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `anon` `public` key | Browser and server (RLS applies) |
| `SUPABASE_SERVICE_ROLE_KEY` | `service_role` key | **Server only** — never commit, never expose to the client |

In the repo:

```bash
cp .env.example .env.local
```

Paste the three values. Set `NEXT_PUBLIC_SITE_URL=http://localhost:3000` for local development.

Restart `npm run dev` after saving `.env.local`.

---

## 3. Apply the schema (SQL)

The schema, functions, RLS policies and storage policies are in:

| File | What it does |
| --- | --- |
| `supabase/migrations/20260928000001_schema.sql` | Tables, indexes, triggers, enums |
| `supabase/migrations/20260928000002_functions_rls.sql` | Permission helpers and Row Level Security |
| `supabase/migrations/20260928000003_storage.sql` | Private `documents` bucket and storage policies |
| `supabase/migrations/20260928000004_milestones_and_audit_type.sql` | Project milestones and audit Internal/External type |
| `supabase/migrations/20260928000005_maintenance_source.sql` | Preventive maintenance Internal/External source |
| `supabase/migrations/20260928000006_rbac_org_roles.sql` | Org-chart roles (Finance & Admin, Construction, Quality) |
| `supabase/migrations/20260928000007_sites_project_roles_reminders.sql` | Sites (plant list), project roles, project plant location, reminder lead days and From email |
| `supabase/seed.sql` | Permissions, roles, role grants, departments, job titles, training levels/status, system settings |

### Option A — SQL editor (no CLI)

1. Dashboard → **SQL Editor**.
2. Paste and **Run** `20260928000001_schema.sql`.
3. Paste and **Run** `20260928000002_functions_rls.sql`.
4. Paste and **Run** `20260928000003_storage.sql`.
5. Paste and **Run** `20260928000004_milestones_and_audit_type.sql`.
6. Paste and **Run** `20260928000005_maintenance_source.sql`.
7. Paste and **Run** `20260928000006_rbac_org_roles.sql`.
8. Paste and **Run** `20260928000007_sites_project_roles_reminders.sql`.
9. Paste and **Run** `supabase/seed.sql`.

Run them in that order. If a statement says a type or table already exists, you can ignore that run or start from a fresh project.

### Option B — Supabase CLI

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

Then load master data:

```bash
npx supabase db query --file supabase/seed.sql
```

(or paste `supabase/seed.sql` in the SQL editor).

The project ref is in the dashboard URL: `https://supabase.com/dashboard/project/<ref>`.

---

## 4. Storage

Migration 3 creates a **private** bucket named `documents` (25 MB, restricted MIME types).

Confirm in **Storage**:

- Bucket `documents` exists.
- **Public** is off.

Application paths:

```
training/{training_id}/…
project/{project_id}/…
supplier/{supplier_id}/…
preventive-maintenance/{maintenance_id}/…
audit/{audit_id}/…
employee/{employee_id}/…
```

Downloads always go through `/api/documents/[id]/download`, which:

1. Requires a signed-in session.
2. Requires the `documents.download` permission.
3. Loads the row with the caller’s RLS-backed client (hidden rows → 404).
4. Issues a ~60 second signed URL and redirects.

There is no public URL for these files.

---

## 5. Authentication URLs

Dashboard → **Authentication → URL Configuration**:

- **Site URL:** `http://localhost:3000` (and later your production origin).
- **Redirect URLs** include:
  - `http://localhost:3000/auth/callback`
  - `http://localhost:3000/reset-password`
  - `https://<your-domain>/auth/callback`
  - `https://<your-domain>/reset-password`

Password reset emails from the app use `NEXT_PUBLIC_SITE_URL`.

Confirm **Authentication → Providers → Email** is enabled. Disable “Confirm email” for the first demo if you want seed users to sign in immediately (`scripts/seed.ts` already sets `email_confirm: true`).

---

## 6. Seed demo users and sample records

Master data (roles, permissions, departments) comes from `supabase/seed.sql`. **Auth users cannot be inserted as plain SQL**; they are created by:

```bash
npm run seed
```

That script needs `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. It creates the accounts listed in the README (default password `McMorrowIMS123!`) plus sample trainings, assignments, a project, a supplier, a maintenance job and an audit.

Re-running the seed updates those demo users rather than creating duplicates.

---

## 7. Confirm it works

```bash
npm run dev
```

1. Open `http://localhost:3000` — you should get `/login`, not `/setup`.
2. Sign in as `admin@mcmorrow-ims.local`.
3. Home shows the six modules and four document folders.
4. Open **Admin Settings → Roles & Permissions** and confirm permissions.
5. Upload a PDF on a training detail page, then open it from **HR Documents**.
6. Sign in as `employee@mcmorrow-ims.local` and confirm **My Trainings** only, no Admin module.

If login fails with “Invalid login credentials”, the seed has not run or the email provider is misconfigured.

If uploads fail, re-check that migration 3 ran and the bucket is private (not missing).

---

## 8. Production notes

- Set `NEXT_PUBLIC_SITE_URL` to the HTTPS origin.
- Add that origin to Auth redirect URLs.
- Keep `SUPABASE_SERVICE_ROLE_KEY` only in the hosting provider’s **server** environment (Vercel: Environment Variables, not `NEXT_PUBLIC_`).
- Do not turn the `documents` bucket public.
- Rotate the database password and service role key if they were ever pasted into chat, tickets or screenshots.

Optional: regenerate TypeScript types after schema changes:

```bash
npx supabase gen types typescript --project-id <ref> > lib/types/database.ts
```

Keep the exported aliases at the bottom of `lib/types/database.ts` if you overwrite that file.
