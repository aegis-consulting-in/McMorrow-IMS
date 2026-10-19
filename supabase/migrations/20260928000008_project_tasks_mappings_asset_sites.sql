-- =============================================================================
-- McMorrow IMS — Milestone tasks, project ↔ asset/supplier mapping,
-- asset sites, milestone-level documents
-- Migration 8
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Helpers
-- -----------------------------------------------------------------------------
-- True when the caller may edit the project (project.edit or the project's manager).
create or replace function public.can_edit_project(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
    and (
      public.has_permission('project.edit')
      or exists (
        select 1 from public.projects p
        where p.id = p_project_id
          and p.manager_id is not null
          and p.manager_id = public.current_employee_id()
      )
    );
$$;

-- True when the caller manages at least one live project (used to let managers pick assets/suppliers).
create or replace function public.manages_any_project()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
    and exists (
      select 1 from public.projects p
      where p.manager_id is not null
        and p.manager_id = public.current_employee_id()
        and p.deleted_at is null
    );
$$;

grant execute on function public.can_edit_project(uuid) to authenticated;
grant execute on function public.manages_any_project() to authenticated;

-- -----------------------------------------------------------------------------
-- Assets belong to a site (Site List)
-- -----------------------------------------------------------------------------
alter table public.maintenance_assets
  add column if not exists site_id uuid references public.sites (id) on delete set null;
create index if not exists maintenance_assets_site_idx on public.maintenance_assets (site_id);

-- -----------------------------------------------------------------------------
-- Milestone tasks
-- -----------------------------------------------------------------------------
do $$ begin
  create type public.task_status as enum ('open', 'in_progress', 'completed', 'cancelled');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.project_tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  milestone_id uuid not null references public.project_milestones (id) on delete cascade,
  title text not null,
  description text,
  assignee_id uuid references public.employees (id) on delete set null,
  status public.task_status not null default 'open',
  due_date date,
  sort_order integer not null default 0,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists project_tasks_milestone_idx on public.project_tasks (milestone_id, sort_order);
create index if not exists project_tasks_project_idx on public.project_tasks (project_id);
create index if not exists project_tasks_assignee_idx on public.project_tasks (assignee_id);

drop trigger if exists project_tasks_set_updated_at on public.project_tasks;
create trigger project_tasks_set_updated_at before update on public.project_tasks
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Project ↔ asset / supplier mapping (both optional)
-- -----------------------------------------------------------------------------
create table if not exists public.project_assets (
  project_id uuid not null references public.projects (id) on delete cascade,
  asset_id uuid not null references public.maintenance_assets (id) on delete cascade,
  added_by uuid references auth.users (id) on delete set null,
  added_at timestamptz not null default now(),
  primary key (project_id, asset_id)
);
create index if not exists project_assets_asset_idx on public.project_assets (asset_id);

create table if not exists public.project_suppliers (
  project_id uuid not null references public.projects (id) on delete cascade,
  supplier_id uuid not null references public.suppliers (id) on delete cascade,
  added_by uuid references auth.users (id) on delete set null,
  added_at timestamptz not null default now(),
  primary key (project_id, supplier_id)
);
create index if not exists project_suppliers_supplier_idx on public.project_suppliers (supplier_id);

-- -----------------------------------------------------------------------------
-- Documents: optional milestone folder (files stay on the project entity)
--   storage path: project/{project_id}/milestones/{milestone_id}/{uuid}-{file}
-- Deleting a milestone keeps its files; they fall back to the project root.
-- -----------------------------------------------------------------------------
alter table public.documents
  add column if not exists milestone_id uuid references public.project_milestones (id) on delete set null;
create index if not exists documents_milestone_idx on public.documents (milestone_id);

do $$ begin
  alter table public.documents
    add constraint documents_milestone_only_for_projects
    check (milestone_id is null or module = 'project');
exception
  when duplicate_object then null;
end $$;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.project_tasks enable row level security;
alter table public.project_assets enable row level security;
alter table public.project_suppliers enable row level security;

-- Tasks
drop policy if exists "project_tasks: read" on public.project_tasks;
create policy "project_tasks: read" on public.project_tasks
  for select to authenticated
  using (public.can_access_entity('project', project_id));

drop policy if exists "project_tasks: manage" on public.project_tasks;
create policy "project_tasks: manage" on public.project_tasks
  for all to authenticated
  using (public.can_edit_project(project_id))
  with check (public.can_edit_project(project_id));

-- The tagged employee may move their own task along.
drop policy if exists "project_tasks: assignee update" on public.project_tasks;
create policy "project_tasks: assignee update" on public.project_tasks
  for update to authenticated
  using (assignee_id is not null and assignee_id = public.current_employee_id() and public.can_access_entity('project', project_id))
  with check (assignee_id is not null and assignee_id = public.current_employee_id() and public.can_access_entity('project', project_id));

-- Mappings
drop policy if exists "project_assets: read" on public.project_assets;
create policy "project_assets: read" on public.project_assets
  for select to authenticated
  using (public.can_access_entity('project', project_id));
drop policy if exists "project_assets: manage" on public.project_assets;
create policy "project_assets: manage" on public.project_assets
  for all to authenticated
  using (public.can_edit_project(project_id))
  with check (public.can_edit_project(project_id));
drop policy if exists "project_assets: create with project" on public.project_assets;
create policy "project_assets: create with project" on public.project_assets
  for insert to authenticated
  with check (
    public.has_permission('project.create')
    and exists (select 1 from public.projects p where p.id = project_id and p.created_by = auth.uid())
  );

drop policy if exists "project_suppliers: read" on public.project_suppliers;
create policy "project_suppliers: read" on public.project_suppliers
  for select to authenticated
  using (public.can_access_entity('project', project_id));
drop policy if exists "project_suppliers: manage" on public.project_suppliers;
create policy "project_suppliers: manage" on public.project_suppliers
  for all to authenticated
  using (public.can_edit_project(project_id))
  with check (public.can_edit_project(project_id));
drop policy if exists "project_suppliers: create with project" on public.project_suppliers;
create policy "project_suppliers: create with project" on public.project_suppliers
  for insert to authenticated
  with check (
    public.has_permission('project.create')
    and exists (select 1 from public.projects p where p.id = project_id and p.created_by = auth.uid())
  );

-- Project people can see the assets / suppliers they pick or that are mapped to
-- their projects, even without maintenance.view / supplier.view.
drop policy if exists "maintenance_assets: read for projects" on public.maintenance_assets;
create policy "maintenance_assets: read for projects" on public.maintenance_assets
  for select to authenticated
  using (
    public.has_any_permission(array['project.create', 'project.edit'])
    or public.manages_any_project()
    or exists (
      select 1 from public.project_assets pa
      where pa.asset_id = maintenance_assets.id and public.can_access_entity('project', pa.project_id)
    )
  );

drop policy if exists "suppliers: read for projects" on public.suppliers;
create policy "suppliers: read for projects" on public.suppliers
  for select to authenticated
  using (
    public.has_any_permission(array['project.create', 'project.edit'])
    or public.manages_any_project()
    or exists (
      select 1 from public.project_suppliers ps
      where ps.supplier_id = suppliers.id and public.can_access_entity('project', ps.project_id)
    )
  );

grant select, insert, update, delete on public.project_tasks to authenticated, service_role;
grant select, insert, update, delete on public.project_assets to authenticated, service_role;
grant select, insert, update, delete on public.project_suppliers to authenticated, service_role;
grant usage on type public.task_status to authenticated, service_role;
