-- =============================================================================
-- McMorrow IMS — Authorization helpers + Row Level Security
-- Migration 2 of 3
--
-- Every helper is SECURITY DEFINER so it can read the RBAC tables without being
-- subject to the very policies it is evaluating (which would otherwise recurse).
-- All helpers are STABLE so Postgres can cache them within a statement.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Permission helpers
-- -----------------------------------------------------------------------------
create or replace function public.has_permission(p_key text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.role_permissions rp on rp.role_id = ur.role_id
    join public.permissions p on p.id = rp.permission_id
    join public.profiles pr on pr.id = ur.user_id
    where ur.user_id = auth.uid()
      and pr.is_active
      and p.key = p_key
  );
$$;

create or replace function public.has_any_permission(p_keys text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.role_permissions rp on rp.role_id = ur.role_id
    join public.permissions p on p.id = rp.permission_id
    join public.profiles pr on pr.id = ur.user_id
    where ur.user_id = auth.uid()
      and pr.is_active
      and p.key = any (p_keys)
  );
$$;

create or replace function public.get_my_permissions()
returns setof text
language sql
stable
security definer
set search_path = public
as $$
  select distinct p.key
  from public.user_roles ur
  join public.role_permissions rp on rp.role_id = ur.role_id
  join public.permissions p on p.id = rp.permission_id
  join public.profiles pr on pr.id = ur.user_id
  where ur.user_id = auth.uid()
    and pr.is_active;
$$;

create or replace function public.current_employee_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select e.id from public.employees e where e.user_id = auth.uid() limit 1;
$$;

-- True when the current user manages p_employee_id directly or through the reporting chain.
create or replace function public.is_manager_of(p_employee_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  with recursive chain as (
    select e.id, e.manager_id, 1 as depth
    from public.employees e
    where e.id = p_employee_id
    union all
    select e.id, e.manager_id, chain.depth + 1
    from public.employees e
    join chain on e.id = chain.manager_id
    where chain.depth < 10
  )
  select exists (
    select 1
    from chain
    where chain.manager_id is not null
      and chain.manager_id = public.current_employee_id()
  );
$$;

-- -----------------------------------------------------------------------------
-- Entity-level access: the single source of truth used by both table RLS and
-- storage policies. A document is visible iff its owning entity is visible.
-- -----------------------------------------------------------------------------
create or replace function public.can_access_entity(p_module text, p_entity_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  me uuid := public.current_employee_id();
begin
  if auth.uid() is null then
    return false;
  end if;

  case p_module
    when 'training' then
      return public.has_permission('training.view')
        or exists (
          select 1 from public.training_assignments ta
          where ta.training_id = p_entity_id and ta.employee_id = me
        );

    when 'project' then
      return public.has_permission('project.view')
        or exists (select 1 from public.projects p where p.id = p_entity_id and p.manager_id = me)
        or exists (select 1 from public.project_members pm where pm.project_id = p_entity_id and pm.employee_id = me);

    when 'supplier' then
      return public.has_permission('supplier.view');

    when 'preventive-maintenance' then
      return public.has_permission('maintenance.view')
        or exists (select 1 from public.maintenance_records mr where mr.id = p_entity_id and mr.assigned_to = me);

    when 'audit' then
      return public.has_permission('audit.view')
        or exists (select 1 from public.audits a where a.id = p_entity_id and a.auditor_id = me);

    when 'employee' then
      return p_entity_id = me
        or public.is_manager_of(p_entity_id)
        or public.has_permission('employee.view');

    else
      return false;
  end case;
end;
$$;

-- Parses "{module}/{entity_id}/..." and delegates to can_access_entity.
create or replace function public.can_access_document_path(p_path text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_module text := split_part(p_path, '/', 1);
  v_entity text := split_part(p_path, '/', 2);
  v_entity_id uuid;
begin
  if v_module = '' or v_entity = '' then
    return false;
  end if;
  begin
    v_entity_id := v_entity::uuid;
  exception when others then
    return false;
  end;
  return public.can_access_entity(v_module, v_entity_id);
end;
$$;

-- -----------------------------------------------------------------------------
-- Audit log writer (bypasses RLS on audit_logs; actor is always the caller)
-- -----------------------------------------------------------------------------
create or replace function public.log_action(
  p_action text,
  p_entity_type text default null,
  p_entity_id text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.audit_logs (actor_id, actor_email, action, entity_type, entity_id, metadata)
  select auth.uid(), pr.email, p_action, p_entity_type, p_entity_id, coalesce(p_metadata, '{}'::jsonb)
  from (select 1) x
  left join public.profiles pr on pr.id = auth.uid();
end;
$$;

-- Marks live assignments whose due date has passed as overdue. Safe to call often.
create or replace function public.refresh_overdue_assignments()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  affected integer;
begin
  update public.training_assignments
  set status = 'overdue'
  where status in ('assigned', 'in_progress')
    and due_date is not null
    and due_date < current_date;
  get diagnostics affected = row_count;

  update public.maintenance_records
  set status = 'overdue'
  where status in ('scheduled', 'due')
    and due_date is not null
    and due_date < current_date
    and deleted_at is null;

  return affected;
end;
$$;

grant execute on function public.has_permission(text) to authenticated;
grant execute on function public.has_any_permission(text[]) to authenticated;
grant execute on function public.get_my_permissions() to authenticated;
grant execute on function public.current_employee_id() to authenticated;
grant execute on function public.is_manager_of(uuid) to authenticated;
grant execute on function public.can_access_entity(text, uuid) to authenticated;
grant execute on function public.can_access_document_path(text) to authenticated;
grant execute on function public.log_action(text, text, text, jsonb) to authenticated;
grant execute on function public.refresh_overdue_assignments() to authenticated;

-- =============================================================================
-- Row Level Security
-- =============================================================================
alter table public.profiles enable row level security;
alter table public.departments enable row level security;
alter table public.job_titles enable row level security;
alter table public.employees enable row level security;
alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.user_roles enable row level security;
alter table public.training_levels enable row level security;
alter table public.training_statuses enable row level security;
alter table public.trainings enable row level security;
alter table public.training_assignments enable row level security;
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.suppliers enable row level security;
alter table public.maintenance_assets enable row level security;
alter table public.maintenance_records enable row level security;
alter table public.audits enable row level security;
alter table public.audit_findings enable row level security;
alter table public.corrective_actions enable row level security;
alter table public.documents enable row level security;
alter table public.system_settings enable row level security;
alter table public.audit_logs enable row level security;

-- ---------------------------------------------------------------- profiles ---
create policy "profiles: read own, HR, or admin" on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.has_any_permission(array['employee.view', 'admin.users']));

create policy "profiles: update own name" on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "profiles: admin update" on public.profiles
  for update to authenticated
  using (public.has_permission('admin.users'))
  with check (public.has_permission('admin.users'));

-- ------------------------------------------------- departments / job titles ---
create policy "departments: read" on public.departments
  for select to authenticated using (true);
create policy "departments: manage" on public.departments
  for all to authenticated
  using (public.has_permission('admin.settings'))
  with check (public.has_permission('admin.settings'));

create policy "job_titles: read" on public.job_titles
  for select to authenticated using (true);
create policy "job_titles: manage" on public.job_titles
  for all to authenticated
  using (public.has_permission('admin.settings'))
  with check (public.has_permission('admin.settings'));

-- --------------------------------------------------------------- employees ---
create policy "employees: read own, team, or HR" on public.employees
  for select to authenticated
  using (
    user_id = auth.uid()
    or public.is_manager_of(id)
    or public.has_permission('employee.view')
  );
create policy "employees: create" on public.employees
  for insert to authenticated
  with check (public.has_permission('employee.create'));
create policy "employees: edit" on public.employees
  for update to authenticated
  using (public.has_permission('employee.edit'))
  with check (public.has_permission('employee.edit'));
create policy "employees: delete" on public.employees
  for delete to authenticated
  using (public.has_permission('employee.delete'));

-- -------------------------------------------------------------------- RBAC ---
create policy "roles: read" on public.roles
  for select to authenticated using (true);
create policy "roles: manage" on public.roles
  for all to authenticated
  using (public.has_permission('admin.roles'))
  with check (public.has_permission('admin.roles'));

create policy "permissions: read" on public.permissions
  for select to authenticated using (true);
create policy "permissions: manage" on public.permissions
  for all to authenticated
  using (public.has_permission('admin.permissions'))
  with check (public.has_permission('admin.permissions'));

create policy "role_permissions: read" on public.role_permissions
  for select to authenticated using (true);
create policy "role_permissions: manage" on public.role_permissions
  for all to authenticated
  using (public.has_permission('admin.roles'))
  with check (public.has_permission('admin.roles'));

create policy "user_roles: read own or admin" on public.user_roles
  for select to authenticated
  using (user_id = auth.uid() or public.has_any_permission(array['admin.users', 'employee.view']));
create policy "user_roles: manage" on public.user_roles
  for all to authenticated
  using (public.has_permission('admin.users'))
  with check (public.has_permission('admin.users'));

-- ---------------------------------------------------- training configuration ---
create policy "training_levels: read" on public.training_levels
  for select to authenticated using (true);
create policy "training_levels: manage" on public.training_levels
  for all to authenticated
  using (public.has_permission('admin.settings'))
  with check (public.has_permission('admin.settings'));

create policy "training_statuses: read" on public.training_statuses
  for select to authenticated using (true);
create policy "training_statuses: manage" on public.training_statuses
  for all to authenticated
  using (public.has_permission('admin.settings'))
  with check (public.has_permission('admin.settings'));

-- --------------------------------------------------------------- trainings ---
create policy "trainings: read" on public.trainings
  for select to authenticated
  using (public.can_access_entity('training', id));
create policy "trainings: create" on public.trainings
  for insert to authenticated
  with check (public.has_permission('training.create'));
create policy "trainings: edit" on public.trainings
  for update to authenticated
  using (public.has_permission('training.edit'))
  with check (public.has_permission('training.edit'));
create policy "trainings: delete" on public.trainings
  for delete to authenticated
  using (public.has_permission('training.delete'));

-- ---------------------------------------------------- training assignments ---
create policy "training_assignments: read own, team, or assigner" on public.training_assignments
  for select to authenticated
  using (
    employee_id = public.current_employee_id()
    or (public.has_permission('training.team') and public.is_manager_of(employee_id))
    or public.has_permission('training.assign')
  );
create policy "training_assignments: assign" on public.training_assignments
  for insert to authenticated
  with check (
    public.has_permission('training.assign')
    or (public.has_permission('training.team') and public.is_manager_of(employee_id))
  );
create policy "training_assignments: update own progress, team, or assigner" on public.training_assignments
  for update to authenticated
  using (
    employee_id = public.current_employee_id()
    or (public.has_permission('training.team') and public.is_manager_of(employee_id))
    or public.has_permission('training.assign')
  )
  with check (
    employee_id = public.current_employee_id()
    or (public.has_permission('training.team') and public.is_manager_of(employee_id))
    or public.has_permission('training.assign')
  );
create policy "training_assignments: delete" on public.training_assignments
  for delete to authenticated
  using (public.has_permission('training.assign'));

-- ---------------------------------------------------------------- projects ---
create policy "projects: read" on public.projects
  for select to authenticated
  using (public.can_access_entity('project', id));
create policy "projects: create" on public.projects
  for insert to authenticated
  with check (public.has_permission('project.create'));
create policy "projects: edit" on public.projects
  for update to authenticated
  using (public.has_permission('project.edit') or manager_id = public.current_employee_id())
  with check (public.has_permission('project.edit') or manager_id = public.current_employee_id());
create policy "projects: delete" on public.projects
  for delete to authenticated
  using (public.has_permission('project.delete'));

create policy "project_members: read" on public.project_members
  for select to authenticated
  using (public.can_access_entity('project', project_id));
create policy "project_members: manage" on public.project_members
  for all to authenticated
  using (
    public.has_permission('project.edit')
    or exists (select 1 from public.projects p where p.id = project_id and p.manager_id = public.current_employee_id())
  )
  with check (
    public.has_permission('project.edit')
    or exists (select 1 from public.projects p where p.id = project_id and p.manager_id = public.current_employee_id())
  );

-- --------------------------------------------------------------- suppliers ---
create policy "suppliers: read" on public.suppliers
  for select to authenticated using (public.has_permission('supplier.view'));
create policy "suppliers: create" on public.suppliers
  for insert to authenticated with check (public.has_permission('supplier.create'));
create policy "suppliers: edit" on public.suppliers
  for update to authenticated
  using (public.has_permission('supplier.edit'))
  with check (public.has_permission('supplier.edit'));
create policy "suppliers: delete" on public.suppliers
  for delete to authenticated using (public.has_permission('supplier.delete'));

-- ------------------------------------------------------------- maintenance ---
create policy "maintenance_assets: read" on public.maintenance_assets
  for select to authenticated
  using (
    public.has_permission('maintenance.view')
    or exists (select 1 from public.maintenance_records mr where mr.asset_id = id and mr.assigned_to = public.current_employee_id())
  );
create policy "maintenance_assets: create" on public.maintenance_assets
  for insert to authenticated with check (public.has_permission('maintenance.create'));
create policy "maintenance_assets: edit" on public.maintenance_assets
  for update to authenticated
  using (public.has_permission('maintenance.edit'))
  with check (public.has_permission('maintenance.edit'));
create policy "maintenance_assets: delete" on public.maintenance_assets
  for delete to authenticated using (public.has_permission('maintenance.delete'));

create policy "maintenance_records: read" on public.maintenance_records
  for select to authenticated
  using (public.can_access_entity('preventive-maintenance', id));
create policy "maintenance_records: create" on public.maintenance_records
  for insert to authenticated with check (public.has_permission('maintenance.create'));
create policy "maintenance_records: edit" on public.maintenance_records
  for update to authenticated
  using (public.has_permission('maintenance.edit') or assigned_to = public.current_employee_id())
  with check (public.has_permission('maintenance.edit') or assigned_to = public.current_employee_id());
create policy "maintenance_records: delete" on public.maintenance_records
  for delete to authenticated using (public.has_permission('maintenance.delete'));

-- ------------------------------------------------------------------ audits ---
create policy "audits: read" on public.audits
  for select to authenticated
  using (public.can_access_entity('audit', id));
create policy "audits: create" on public.audits
  for insert to authenticated with check (public.has_permission('audit.create'));
create policy "audits: edit" on public.audits
  for update to authenticated
  using (public.has_permission('audit.edit') or auditor_id = public.current_employee_id())
  with check (public.has_permission('audit.edit') or auditor_id = public.current_employee_id());
create policy "audits: delete" on public.audits
  for delete to authenticated using (public.has_permission('audit.delete'));

create policy "audit_findings: read" on public.audit_findings
  for select to authenticated using (public.can_access_entity('audit', audit_id));
create policy "audit_findings: manage" on public.audit_findings
  for all to authenticated
  using (
    public.has_permission('audit.edit')
    or exists (select 1 from public.audits a where a.id = audit_id and a.auditor_id = public.current_employee_id())
  )
  with check (
    public.has_permission('audit.edit')
    or exists (select 1 from public.audits a where a.id = audit_id and a.auditor_id = public.current_employee_id())
  );

create policy "corrective_actions: read" on public.corrective_actions
  for select to authenticated
  using (public.can_access_entity('audit', audit_id) or owner_id = public.current_employee_id());
create policy "corrective_actions: manage" on public.corrective_actions
  for all to authenticated
  using (
    public.has_permission('audit.edit')
    or owner_id = public.current_employee_id()
    or exists (select 1 from public.audits a where a.id = audit_id and a.auditor_id = public.current_employee_id())
  )
  with check (
    public.has_permission('audit.edit')
    or owner_id = public.current_employee_id()
    or exists (select 1 from public.audits a where a.id = audit_id and a.auditor_id = public.current_employee_id())
  );

-- --------------------------------------------------------------- documents ---
-- Visibility requires the generic documents.view permission AND access to the
-- owning entity. Admins hold every permission so they see everything.
create policy "documents: read" on public.documents
  for select to authenticated
  using (
    public.has_permission('documents.view')
    and public.can_access_entity(module::text, entity_id)
  );
create policy "documents: upload" on public.documents
  for insert to authenticated
  with check (
    public.has_permission('documents.upload')
    and public.can_access_entity(module::text, entity_id)
    and uploaded_by = auth.uid()
  );
create policy "documents: edit metadata" on public.documents
  for update to authenticated
  using (
    public.has_permission('documents.upload')
    and public.can_access_entity(module::text, entity_id)
  )
  with check (
    public.has_permission('documents.upload')
    and public.can_access_entity(module::text, entity_id)
  );
create policy "documents: delete" on public.documents
  for delete to authenticated
  using (
    public.has_permission('documents.delete')
    and public.can_access_entity(module::text, entity_id)
  );

-- --------------------------------------------------------- system settings ---
create policy "system_settings: read" on public.system_settings
  for select to authenticated
  using (is_public or public.has_permission('admin.settings'));
create policy "system_settings: manage" on public.system_settings
  for all to authenticated
  using (public.has_permission('admin.settings'))
  with check (public.has_permission('admin.settings'));

-- -------------------------------------------------------------- audit logs ---
-- Writes only happen through log_action(); nobody gets a direct insert policy.
create policy "audit_logs: read" on public.audit_logs
  for select to authenticated
  using (public.has_permission('admin.audit_logs'));
