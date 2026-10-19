-- =============================================================================
-- McMorrow IMS — Master data seed (idempotent)
--
-- Run AFTER the migrations. This seeds everything that does not depend on an
-- auth user: permissions, roles, role→permission grants, departments, job
-- titles, training configuration and system settings.
--
-- Demo users, employees and business records are created by `npm run seed`
-- (scripts/seed.ts) because auth users must be created through the Auth API.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Permissions
-- -----------------------------------------------------------------------------
insert into public.permissions (key, module, action, description) values
  ('training.view',   'training', 'view',   'View the training catalogue and training details'),
  ('training.create', 'training', 'create', 'Create new trainings'),
  ('training.edit',   'training', 'edit',   'Edit trainings and upload training documents'),
  ('training.delete', 'training', 'delete', 'Archive or delete trainings'),
  ('training.assign', 'training', 'assign', 'Assign trainings to any employee and manage all assignments'),
  ('training.team',   'training', 'team',   'View and manage trainings for direct and indirect reports'),

  ('employee.view',   'employee', 'view',   'View all employee records'),
  ('employee.create', 'employee', 'create', 'Create employees'),
  ('employee.edit',   'employee', 'edit',   'Edit employees, activate/deactivate'),
  ('employee.delete', 'employee', 'delete', 'Delete employees'),

  ('project.view',    'project', 'view',    'View all projects'),
  ('project.create',  'project', 'create',  'Create projects'),
  ('project.edit',    'project', 'edit',    'Edit any project and manage members'),
  ('project.delete',  'project', 'delete',  'Delete projects'),

  ('supplier.view',   'supplier', 'view',   'View suppliers'),
  ('supplier.create', 'supplier', 'create', 'Create suppliers'),
  ('supplier.edit',   'supplier', 'edit',   'Edit suppliers'),
  ('supplier.delete', 'supplier', 'delete', 'Delete or deactivate suppliers'),

  ('maintenance.view',   'maintenance', 'view',   'View assets and maintenance records'),
  ('maintenance.create', 'maintenance', 'create', 'Create assets and maintenance records'),
  ('maintenance.edit',   'maintenance', 'edit',   'Edit assets and maintenance records'),
  ('maintenance.delete', 'maintenance', 'delete', 'Delete assets and maintenance records'),

  ('audit.view',   'audit', 'view',   'View audits, findings and corrective actions'),
  ('audit.create', 'audit', 'create', 'Create audits'),
  ('audit.edit',   'audit', 'edit',   'Edit audits, findings and corrective actions'),
  ('audit.delete', 'audit', 'delete', 'Delete audits'),

  ('documents.view',     'documents', 'view',     'Browse documents for entities the user can access'),
  ('documents.upload',   'documents', 'upload',   'Upload documents to accessible entities'),
  ('documents.download', 'documents', 'download', 'Download / open documents'),
  ('documents.delete',   'documents', 'delete',   'Delete documents'),

  ('admin.users',       'admin', 'users',       'Manage users and their roles'),
  ('admin.roles',       'admin', 'roles',       'Manage roles and role permissions'),
  ('admin.permissions', 'admin', 'permissions', 'View the permission matrix'),
  ('admin.settings',    'admin', 'settings',    'Manage departments, job titles, training configuration and system settings'),
  ('admin.documents',   'admin', 'documents',   'Access the admin document manager'),
  ('admin.audit_logs',  'admin', 'audit_logs',  'View the audit log')
on conflict (key) do update
  set module = excluded.module,
      action = excluded.action,
      description = excluded.description;

-- -----------------------------------------------------------------------------
-- Roles
-- -----------------------------------------------------------------------------
insert into public.roles (name, description, is_system) values
  ('Admin',                       'Managing director / full access to every module and system administration', true),
  ('Manager',                     'People manager: sees their team, their team''s trainings and shared documents', true),
  ('Employee',                    'Standard employee: own trainings and own documents', true),
  ('Finance & Administration',    'Owns HR, supplier approvals, maintenance/calibration and document control', false),
  ('Construction Management',     'Owns project management and subcontractor control', false),
  ('Quality & Compliance',        'Owns internal audit, findings and CAPA', false)
on conflict (name) do update
  set description = excluded.description,
      is_system = excluded.is_system;

-- -----------------------------------------------------------------------------
-- Role → permission grants
-- -----------------------------------------------------------------------------
create or replace function pg_temp.grant_permissions(p_role text, p_keys text[])
returns void
language plpgsql
as $$
begin
  insert into public.role_permissions (role_id, permission_id)
  select r.id, p.id
  from public.roles r
  join public.permissions p on p.key = any (p_keys)
  where r.name = p_role
  on conflict do nothing;
end;
$$;

-- Admin gets everything.
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r cross join public.permissions p where r.name = 'Admin'
on conflict do nothing;

select pg_temp.grant_permissions('Employee', array[
  'documents.view', 'documents.download'
]);

select pg_temp.grant_permissions('Manager', array[
  'training.view', 'training.team',
  'project.view',
  'maintenance.view',
  'documents.view', 'documents.upload', 'documents.download'
]);

select pg_temp.grant_permissions('Quality & Compliance', array[
  'audit.view', 'audit.create', 'audit.edit',
  'employee.view',
  'documents.view', 'documents.upload', 'documents.download'
]);

select pg_temp.grant_permissions('Finance & Administration', array[
  'training.view', 'training.create', 'training.edit', 'training.delete', 'training.assign', 'training.team',
  'employee.view', 'employee.create', 'employee.edit', 'employee.delete',
  'supplier.view', 'supplier.create', 'supplier.edit', 'supplier.delete',
  'maintenance.view', 'maintenance.create', 'maintenance.edit', 'maintenance.delete',
  'documents.view', 'documents.upload', 'documents.download', 'documents.delete'
]);

select pg_temp.grant_permissions('Construction Management', array[
  'project.view', 'project.create', 'project.edit', 'project.delete',
  'supplier.view',
  'employee.view',
  'documents.view', 'documents.upload', 'documents.download', 'documents.delete'
]);

-- -----------------------------------------------------------------------------
-- Departments and job titles
-- -----------------------------------------------------------------------------
insert into public.departments (name, code, description) values
  ('Finance & Business Administration', 'FBA', 'HR, purchasing, asset management and document control'),
  ('Commercial & Sales', 'COM', 'RFT/RFQ, project proposals and fee agreements'),
  ('Construction Management', 'CON', 'Project management and subcontractor control'),
  ('Quality & Compliance', 'QC', 'Internal audit and CAPA'),
  ('Human Resources',   'HR',  'People operations, onboarding and training compliance'),
  ('Quality Assurance', 'QA',  'Quality system ownership, audits and CAPA'),
  ('Production',        'PRD', 'Manufacturing and line operations'),
  ('Engineering',       'ENG', 'Equipment, maintenance and facilities'),
  ('Operations',        'OPS', 'Planning, logistics and operations management'),
  ('Procurement',       'PRC', 'Supplier selection and purchasing'),
  ('Information Technology', 'IT', 'Systems and infrastructure')
on conflict (name) do update set code = excluded.code, description = excluded.description;

insert into public.job_titles (name) values
  ('Managing Director'),
  ('Finance & Administration Manager'),
  ('HR Manager'),
  ('HR Executive'),
  ('Quality Manager'),
  ('QA Engineer'),
  ('Production Supervisor'),
  ('Line Operator'),
  ('Maintenance Engineer'),
  ('Maintenance Technician'),
  ('Project Manager'),
  ('Construction Manager'),
  ('Business Analyst'),
  ('Procurement Lead'),
  ('Internal Auditor'),
  ('Systems Administrator')
on conflict (name) do nothing;

-- -----------------------------------------------------------------------------
-- Training configuration
-- -----------------------------------------------------------------------------
insert into public.training_levels (name, sort_order) values
  ('Beginner', 1),
  ('Intermediate', 2),
  ('Advanced', 3)
on conflict (name) do update set sort_order = excluded.sort_order;

insert into public.training_statuses (name, sort_order, is_default) values
  ('Draft', 1, false),
  ('Active', 2, true),
  ('Inactive', 3, false),
  ('Completed', 4, false),
  ('Archived', 5, false)
on conflict (name) do update set sort_order = excluded.sort_order, is_default = excluded.is_default;

-- -----------------------------------------------------------------------------
-- System settings
-- -----------------------------------------------------------------------------
insert into public.system_settings (key, value, description, is_public) values
  ('app.name', '"McMorrow IMS"', 'Application display name', true),
  ('app.organisation', '"Northwind Labs"', 'Organisation name shown in headers and exports', true),
  ('reminders.equipment_email', '"maintenance@example.com"', 'Mailbox that receives preventive maintenance reminders', false),
  ('reminders.supplier_email', '"procurement@example.com"', 'Mailbox that receives supplier review reminders', false),
  ('reminders.from_email', '"no-reply@example.com"', 'Sender (From) address used on reminder emails', false),
  ('reminders.lead_days', '[14, 7]', 'Days before a due date at which reminders are raised (training, equipment, supplier)', false),
  ('documents.max_file_size_mb', '25', 'Maximum upload size per file (must not exceed the bucket limit)', true),
  ('documents.allowed_extensions', '["pdf","doc","docx","xls","xlsx","ppt","pptx","txt","csv","png","jpg","jpeg","webp","gif"]', 'File extensions accepted by the upload component', true)
on conflict (key) do update
  set description = excluded.description,
      is_public = excluded.is_public;
