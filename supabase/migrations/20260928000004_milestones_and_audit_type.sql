-- =============================================================================
-- McMorrow IMS — Project milestones + audit type
-- Migration 4 of 4
-- =============================================================================

do $$ begin
  create type public.audit_type as enum ('internal', 'external');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.milestone_status as enum ('planned', 'in_progress', 'completed', 'cancelled');
exception
  when duplicate_object then null;
end $$;

alter table public.audits
  add column if not exists audit_type public.audit_type not null default 'internal';

create index if not exists audits_type_idx on public.audits (audit_type);

create table if not exists public.project_milestones (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  name text not null,
  start_date date,
  end_date date,
  status public.milestone_status not null default 'planned',
  sort_order integer not null default 0,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint project_milestones_dates check (end_date is null or start_date is null or end_date >= start_date)
);
create index if not exists project_milestones_project_idx on public.project_milestones (project_id, sort_order);

drop trigger if exists project_milestones_set_updated_at on public.project_milestones;
create trigger project_milestones_set_updated_at before update on public.project_milestones
  for each row execute function public.set_updated_at();

-- Existing projects already have timeline dates on the project row; copy them
-- into a first milestone so start/end sit against the milestone going forward.
insert into public.project_milestones (project_id, name, start_date, end_date, status, sort_order)
select
  p.id,
  'Project timeline',
  p.start_date,
  p.expected_end_date,
  case when p.status = 'completed' then 'completed'::public.milestone_status else 'planned'::public.milestone_status end,
  0
from public.projects p
where p.deleted_at is null
  and (p.start_date is not null or p.expected_end_date is not null)
  and not exists (
    select 1 from public.project_milestones m where m.project_id = p.id
  );

alter table public.project_milestones enable row level security;

drop policy if exists "project_milestones: read" on public.project_milestones;
create policy "project_milestones: read" on public.project_milestones
  for select to authenticated
  using (public.can_access_entity('project', project_id));

drop policy if exists "project_milestones: manage" on public.project_milestones;
create policy "project_milestones: manage" on public.project_milestones
  for all to authenticated
  using (
    public.has_permission('project.edit')
    or exists (select 1 from public.projects p where p.id = project_id and p.manager_id = public.current_employee_id())
  )
  with check (
    public.has_permission('project.edit')
    or exists (select 1 from public.projects p where p.id = project_id and p.manager_id = public.current_employee_id())
  );

drop policy if exists "project_milestones: create with project" on public.project_milestones;
create policy "project_milestones: create with project" on public.project_milestones
  for insert to authenticated
  with check (
    public.has_permission('project.create')
    and exists (select 1 from public.projects p where p.id = project_id and p.created_by = auth.uid())
  );

grant select, insert, update, delete on public.project_milestones to authenticated, service_role;
grant usage on type public.audit_type to authenticated, service_role;
grant usage on type public.milestone_status to authenticated, service_role;
