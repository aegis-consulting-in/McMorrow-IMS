-- =============================================================================
-- McMorrow IMS — Sites (plants), Project roles, reminder settings, rebrand
-- Migration 7
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Sites (plant list) — managed in Admin → System Settings
-- -----------------------------------------------------------------------------
create table if not exists public.sites (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  code text unique,
  address text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists sites_set_updated_at on public.sites;
create trigger sites_set_updated_at before update on public.sites
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Project roles — managed in Admin → System Settings
-- -----------------------------------------------------------------------------
create table if not exists public.project_roles (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists project_roles_set_updated_at on public.project_roles;
create trigger project_roles_set_updated_at before update on public.project_roles
  for each row execute function public.set_updated_at();

insert into public.project_roles (name, description, sort_order) values
  ('Project Manager', 'Accountable for delivery of the project', 1),
  ('Project Engineer', 'Technical lead for design and execution', 2),
  ('Site Supervisor', 'Supervises day-to-day work on site', 3),
  ('Quality Officer', 'Inspection, testing and quality records', 4),
  ('HSE Officer', 'Health, safety and environment', 5)
on conflict (name) do nothing;

-- -----------------------------------------------------------------------------
-- Projects: plant location
-- -----------------------------------------------------------------------------
alter table public.projects
  add column if not exists site_id uuid references public.sites (id) on delete set null;
create index if not exists projects_site_idx on public.projects (site_id);

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.sites enable row level security;
alter table public.project_roles enable row level security;

drop policy if exists "sites: read" on public.sites;
create policy "sites: read" on public.sites
  for select to authenticated using (true);
drop policy if exists "sites: manage" on public.sites;
create policy "sites: manage" on public.sites
  for all to authenticated
  using (public.has_permission('admin.settings'))
  with check (public.has_permission('admin.settings'));

drop policy if exists "project_roles: read" on public.project_roles;
create policy "project_roles: read" on public.project_roles
  for select to authenticated using (true);
drop policy if exists "project_roles: manage" on public.project_roles;
create policy "project_roles: manage" on public.project_roles
  for all to authenticated
  using (public.has_permission('admin.settings'))
  with check (public.has_permission('admin.settings'));

grant select, insert, update, delete on public.sites to authenticated, service_role;
grant select, insert, update, delete on public.project_roles to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Reminder settings
--   * reminders.training_due_days  ->  reminders.lead_days (applies to ALL reminders,
--     stored in descending order)
--   * new reminders.from_email (sender address for reminder emails)
-- -----------------------------------------------------------------------------
update public.system_settings s
set key = 'reminders.lead_days',
    value = coalesce(
      (select jsonb_agg(e.v order by (e.v #>> '{}')::int desc) from jsonb_array_elements(s.value) as e(v)),
      '[]'::jsonb
    ),
    description = 'Days before a due date at which reminders are raised (training, equipment, supplier)'
where s.key = 'reminders.training_due_days'
  and jsonb_typeof(s.value) = 'array'
  and not exists (select 1 from public.system_settings x where x.key = 'reminders.lead_days');

delete from public.system_settings where key = 'reminders.training_due_days';

insert into public.system_settings (key, value, description, is_public) values
  ('reminders.lead_days', '[14, 7]', 'Days before a due date at which reminders are raised (training, equipment, supplier)', false),
  ('reminders.from_email', '"no-reply@example.com"', 'Sender (From) address used on reminder emails', false)
on conflict (key) do nothing;

-- -----------------------------------------------------------------------------
-- Rebrand: SkillHub -> McMorrow IMS (only if the name was never customised)
-- -----------------------------------------------------------------------------
update public.system_settings
set value = '"McMorrow IMS"'::jsonb
where key = 'app.name' and value = '"SkillHub"'::jsonb;
