-- =============================================================================
-- McMorrow IMS — Core schema
-- Migration 1 of 3: extensions, enums, tables, indexes, triggers
-- =============================================================================

create extension if not exists "pgcrypto";
create extension if not exists "citext";

-- -----------------------------------------------------------------------------
-- Enums
-- -----------------------------------------------------------------------------
create type public.assignment_status as enum ('assigned', 'in_progress', 'completed', 'overdue', 'cancelled');
create type public.project_status as enum ('planning', 'active', 'on_hold', 'completed', 'cancelled');
create type public.project_priority as enum ('low', 'medium', 'high', 'critical');
create type public.supplier_status as enum ('active', 'inactive', 'probationary', 'blacklisted');
create type public.maintenance_status as enum ('scheduled', 'due', 'in_progress', 'completed', 'overdue', 'cancelled');
create type public.maintenance_type as enum ('preventive', 'corrective', 'calibration', 'inspection');
create type public.audit_status as enum ('planned', 'in_progress', 'completed', 'closed');
create type public.finding_severity as enum ('observation', 'minor', 'major', 'critical');
create type public.finding_status as enum ('open', 'in_progress', 'closed');
create type public.corrective_action_status as enum ('open', 'in_progress', 'completed', 'verified', 'cancelled');
create type public.document_module as enum ('training', 'project', 'supplier', 'preventive-maintenance', 'audit', 'employee');

-- -----------------------------------------------------------------------------
-- Generic updated_at trigger
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Identity: profiles mirror auth.users
-- -----------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email citext not null unique,
  full_name text,
  avatar_url text,
  is_active boolean not null default true,
  must_change_password boolean not null default false,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = coalesce(public.profiles.full_name, excluded.full_name);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- Master data
-- -----------------------------------------------------------------------------
create table public.departments (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  code text unique,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger departments_set_updated_at before update on public.departments
  for each row execute function public.set_updated_at();

create table public.job_titles (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger job_titles_set_updated_at before update on public.job_titles
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Employees
-- -----------------------------------------------------------------------------
create table public.employees (
  id uuid primary key default gen_random_uuid(),
  employee_code text not null unique,
  -- References profiles (1:1 mirror of auth.users) so PostgREST can embed the login record.
  user_id uuid unique references public.profiles (id) on delete set null,
  first_name text not null,
  last_name text not null,
  email citext not null unique,
  phone text,
  department_id uuid references public.departments (id) on delete set null,
  job_title_id uuid references public.job_titles (id) on delete set null,
  manager_id uuid references public.employees (id) on delete set null,
  is_manager boolean not null default false,
  is_active boolean not null default true,
  joining_date date,
  notes text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint employees_not_own_manager check (manager_id is distinct from id)
);
create index employees_department_idx on public.employees (department_id);
create index employees_manager_idx on public.employees (manager_id);
create index employees_user_idx on public.employees (user_id);
create index employees_active_idx on public.employees (is_active);
create index employees_name_idx on public.employees (lower(first_name), lower(last_name));
create trigger employees_set_updated_at before update on public.employees
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- RBAC
-- -----------------------------------------------------------------------------
create table public.roles (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger roles_set_updated_at before update on public.roles
  for each row execute function public.set_updated_at();

create table public.permissions (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  module text not null,
  action text not null,
  description text,
  created_at timestamptz not null default now()
);
create index permissions_module_idx on public.permissions (module);

create table public.role_permissions (
  role_id uuid not null references public.roles (id) on delete cascade,
  permission_id uuid not null references public.permissions (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (role_id, permission_id)
);

create table public.user_roles (
  user_id uuid not null references public.profiles (id) on delete cascade,
  role_id uuid not null references public.roles (id) on delete cascade,
  assigned_by uuid references auth.users (id) on delete set null,
  assigned_at timestamptz not null default now(),
  primary key (user_id, role_id)
);
create index user_roles_role_idx on public.user_roles (role_id);

-- -----------------------------------------------------------------------------
-- Training configuration + trainings
-- -----------------------------------------------------------------------------
create table public.training_levels (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger training_levels_set_updated_at before update on public.training_levels
  for each row execute function public.set_updated_at();

create table public.training_statuses (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  sort_order integer not null default 0,
  is_default boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger training_statuses_set_updated_at before update on public.training_statuses
  for each row execute function public.set_updated_at();

create table public.trainings (
  id uuid primary key default gen_random_uuid(),
  code text unique,
  name text not null,
  description text,
  level_id uuid references public.training_levels (id) on delete set null,
  status_id uuid references public.training_statuses (id) on delete set null,
  duration_hours numeric(6, 2) check (duration_hours is null or duration_hours >= 0),
  created_by uuid references auth.users (id) on delete set null,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index trainings_level_idx on public.trainings (level_id);
create index trainings_status_idx on public.trainings (status_id);
create index trainings_deleted_idx on public.trainings (deleted_at);
create index trainings_name_idx on public.trainings (lower(name));
create trigger trainings_set_updated_at before update on public.trainings
  for each row execute function public.set_updated_at();

create table public.training_assignments (
  id uuid primary key default gen_random_uuid(),
  training_id uuid not null references public.trainings (id) on delete cascade,
  employee_id uuid not null references public.employees (id) on delete cascade,
  assigned_by uuid references auth.users (id) on delete set null,
  assigned_date date not null default current_date,
  due_date date,
  status public.assignment_status not null default 'assigned',
  completion_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint training_assignments_dates check (due_date is null or due_date >= assigned_date)
);
create index training_assignments_training_idx on public.training_assignments (training_id);
create index training_assignments_employee_idx on public.training_assignments (employee_id);
create index training_assignments_status_idx on public.training_assignments (status);
-- One live assignment per employee/training pair.
create unique index training_assignments_active_unique
  on public.training_assignments (training_id, employee_id)
  where status in ('assigned', 'in_progress', 'overdue');
create trigger training_assignments_set_updated_at before update on public.training_assignments
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Projects
-- -----------------------------------------------------------------------------
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  manager_id uuid references public.employees (id) on delete set null,
  start_date date,
  expected_end_date date,
  actual_end_date date,
  status public.project_status not null default 'planning',
  priority public.project_priority not null default 'medium',
  notes text,
  created_by uuid references auth.users (id) on delete set null,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint projects_dates check (expected_end_date is null or start_date is null or expected_end_date >= start_date)
);
create index projects_manager_idx on public.projects (manager_id);
create index projects_status_idx on public.projects (status);
create index projects_deleted_idx on public.projects (deleted_at);
create trigger projects_set_updated_at before update on public.projects
  for each row execute function public.set_updated_at();

create table public.project_members (
  project_id uuid not null references public.projects (id) on delete cascade,
  employee_id uuid not null references public.employees (id) on delete cascade,
  role_in_project text,
  added_by uuid references auth.users (id) on delete set null,
  added_at timestamptz not null default now(),
  primary key (project_id, employee_id)
);
create index project_members_employee_idx on public.project_members (employee_id);

-- -----------------------------------------------------------------------------
-- Suppliers
-- -----------------------------------------------------------------------------
create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  contact_person text,
  email citext,
  phone text,
  address text,
  category text,
  department_id uuid references public.departments (id) on delete set null,
  service_supplied text,
  status public.supplier_status not null default 'active',
  evaluation_complete boolean not null default false,
  review_due_date date,
  rating numeric(3, 1) check (rating is null or (rating >= 0 and rating <= 5)),
  notes text,
  created_by uuid references auth.users (id) on delete set null,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index suppliers_status_idx on public.suppliers (status);
create index suppliers_category_idx on public.suppliers (category);
create index suppliers_deleted_idx on public.suppliers (deleted_at);
create index suppliers_name_idx on public.suppliers (lower(name));
create trigger suppliers_set_updated_at before update on public.suppliers
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Preventive maintenance
-- -----------------------------------------------------------------------------
create table public.maintenance_assets (
  id uuid primary key default gen_random_uuid(),
  asset_code text not null unique,
  name text not null,
  description text,
  serial_number text,
  manufacturer text,
  location text,
  department_id uuid references public.departments (id) on delete set null,
  purchase_date date,
  is_active boolean not null default true,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index maintenance_assets_department_idx on public.maintenance_assets (department_id);
create trigger maintenance_assets_set_updated_at before update on public.maintenance_assets
  for each row execute function public.set_updated_at();

create table public.maintenance_records (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.maintenance_assets (id) on delete cascade,
  title text not null,
  description text,
  maintenance_type public.maintenance_type not null default 'preventive',
  frequency text,
  scheduled_date date,
  due_date date,
  completed_date date,
  status public.maintenance_status not null default 'scheduled',
  assigned_to uuid references public.employees (id) on delete set null,
  notes text,
  created_by uuid references auth.users (id) on delete set null,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index maintenance_records_asset_idx on public.maintenance_records (asset_id);
create index maintenance_records_assigned_idx on public.maintenance_records (assigned_to);
create index maintenance_records_status_idx on public.maintenance_records (status);
create index maintenance_records_due_idx on public.maintenance_records (due_date);
create index maintenance_records_deleted_idx on public.maintenance_records (deleted_at);
create trigger maintenance_records_set_updated_at before update on public.maintenance_records
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Audits
-- -----------------------------------------------------------------------------
create table public.audits (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  title text not null,
  process_name text,
  department_id uuid references public.departments (id) on delete set null,
  auditor_id uuid references public.employees (id) on delete set null,
  audit_date date,
  status public.audit_status not null default 'planned',
  responsibility text,
  applicable_clauses text,
  inputs text,
  activities text,
  outputs text,
  interactions text,
  summary text,
  notes text,
  created_by uuid references auth.users (id) on delete set null,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index audits_auditor_idx on public.audits (auditor_id);
create index audits_department_idx on public.audits (department_id);
create index audits_status_idx on public.audits (status);
create index audits_deleted_idx on public.audits (deleted_at);
create trigger audits_set_updated_at before update on public.audits
  for each row execute function public.set_updated_at();

create table public.audit_findings (
  id uuid primary key default gen_random_uuid(),
  audit_id uuid not null references public.audits (id) on delete cascade,
  title text not null,
  description text,
  clause text,
  severity public.finding_severity not null default 'minor',
  status public.finding_status not null default 'open',
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index audit_findings_audit_idx on public.audit_findings (audit_id);
create trigger audit_findings_set_updated_at before update on public.audit_findings
  for each row execute function public.set_updated_at();

create table public.corrective_actions (
  id uuid primary key default gen_random_uuid(),
  audit_id uuid not null references public.audits (id) on delete cascade,
  finding_id uuid references public.audit_findings (id) on delete cascade,
  description text not null,
  owner_id uuid references public.employees (id) on delete set null,
  due_date date,
  completed_date date,
  status public.corrective_action_status not null default 'open',
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index corrective_actions_audit_idx on public.corrective_actions (audit_id);
create index corrective_actions_finding_idx on public.corrective_actions (finding_id);
create index corrective_actions_owner_idx on public.corrective_actions (owner_id);
create trigger corrective_actions_set_updated_at before update on public.corrective_actions
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Documents (metadata for objects in the private "documents" bucket)
-- Storage path convention: {module}/{entity_id}/{uuid}-{file_name}
-- -----------------------------------------------------------------------------
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  file_name text not null,
  storage_path text not null unique,
  bucket text not null default 'documents',
  file_size bigint not null check (file_size >= 0),
  mime_type text not null,
  module public.document_module not null,
  entity_type text not null,
  entity_id uuid not null,
  description text,
  uploaded_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- The path must agree with the module/entity so storage policies and row policies cannot drift apart.
  constraint documents_path_matches_entity
    check (storage_path like (module::text || '/' || entity_id::text || '/%'))
);
create index documents_entity_idx on public.documents (module, entity_id);
create index documents_uploaded_by_idx on public.documents (uploaded_by);
create index documents_created_idx on public.documents (created_at desc);
create trigger documents_set_updated_at before update on public.documents
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- System settings + audit log
-- -----------------------------------------------------------------------------
create table public.system_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  description text,
  is_public boolean not null default false,
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users (id) on delete set null,
  actor_email text,
  action text not null,
  entity_type text,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_logs_created_idx on public.audit_logs (created_at desc);
create index audit_logs_actor_idx on public.audit_logs (actor_id);
create index audit_logs_entity_idx on public.audit_logs (entity_type, entity_id);
create index audit_logs_action_idx on public.audit_logs (action);
