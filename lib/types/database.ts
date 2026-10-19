/**
 * Database types for the McMorrow IMS schema.
 *
 * Hand-maintained to mirror supabase/migrations/*.sql. Once a Supabase project
 * exists you can regenerate this file from the live schema with:
 *
 *   npm run db:types
 *
 * (see package.json → uses `supabase gen types typescript`). Keep the exported
 * aliases at the bottom of this file when regenerating.
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type Timestamps = { created_at: string; updated_at: string };
type Rel = {
  foreignKeyName: string;
  columns: string[];
  isOneToOne?: boolean;
  referencedRelation: string;
  referencedColumns: string[];
};

export type AssignmentStatus = "assigned" | "in_progress" | "completed" | "overdue" | "cancelled";
export type ProjectStatus = "planning" | "active" | "on_hold" | "completed" | "cancelled";
export type ProjectPriority = "low" | "medium" | "high" | "critical";
export type SupplierStatus = "active" | "inactive" | "probationary" | "blacklisted";
export type MaintenanceStatus = "scheduled" | "due" | "in_progress" | "completed" | "overdue" | "cancelled";
export type MaintenanceType = "preventive" | "corrective" | "calibration" | "inspection";
export type MaintenanceSource = "internal" | "external";
export type AuditStatus = "planned" | "in_progress" | "completed" | "closed";
export type AuditType = "internal" | "external";
export type MilestoneStatus = "planned" | "in_progress" | "completed" | "cancelled";
export type TaskStatus = "open" | "in_progress" | "completed" | "cancelled";
export type FindingSeverity = "observation" | "minor" | "major" | "critical";
export type FindingStatus = "open" | "in_progress" | "closed";
export type CorrectiveActionStatus = "open" | "in_progress" | "completed" | "verified" | "cancelled";
export type DocumentModule = "training" | "project" | "supplier" | "preventive-maintenance" | "audit" | "employee";

// ---------------------------------------------------------------------------
// Row shapes
// ---------------------------------------------------------------------------
export type ProfileRow = Timestamps & {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  is_active: boolean;
  must_change_password: boolean;
  last_login_at: string | null;
};

export type DepartmentRow = Timestamps & {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  is_active: boolean;
};

export type JobTitleRow = Timestamps & {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
};

export type EmployeeRow = Timestamps & {
  id: string;
  employee_code: string;
  user_id: string | null;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  department_id: string | null;
  job_title_id: string | null;
  manager_id: string | null;
  is_manager: boolean;
  is_active: boolean;
  joining_date: string | null;
  notes: string | null;
  created_by: string | null;
};

export type RoleRow = Timestamps & {
  id: string;
  name: string;
  description: string | null;
  is_system: boolean;
};

export type PermissionRow = {
  id: string;
  key: string;
  module: string;
  action: string;
  description: string | null;
  created_at: string;
};

export type RolePermissionRow = { role_id: string; permission_id: string; created_at: string };
export type UserRoleRow = { user_id: string; role_id: string; assigned_by: string | null; assigned_at: string };

export type TrainingLevelRow = Timestamps & { id: string; name: string; sort_order: number; is_active: boolean };
export type TrainingStatusRow = Timestamps & {
  id: string;
  name: string;
  sort_order: number;
  is_default: boolean;
  is_active: boolean;
};

export type TrainingRow = Timestamps & {
  id: string;
  code: string | null;
  name: string;
  description: string | null;
  level_id: string | null;
  status_id: string | null;
  duration_hours: number | null;
  created_by: string | null;
  deleted_at: string | null;
};

export type TrainingAssignmentRow = Timestamps & {
  id: string;
  training_id: string;
  employee_id: string;
  assigned_by: string | null;
  assigned_date: string;
  due_date: string | null;
  status: AssignmentStatus;
  completion_date: string | null;
  notes: string | null;
};

export type SiteRow = Timestamps & {
  id: string;
  name: string;
  code: string | null;
  address: string | null;
  is_active: boolean;
};

export type ProjectRoleRow = Timestamps & {
  id: string;
  name: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
};

export type ProjectRow = Timestamps & {
  id: string;
  code: string;
  name: string;
  description: string | null;
  manager_id: string | null;
  site_id: string | null;
  start_date: string | null;
  expected_end_date: string | null;
  actual_end_date: string | null;
  status: ProjectStatus;
  priority: ProjectPriority;
  notes: string | null;
  created_by: string | null;
  deleted_at: string | null;
};

export type ProjectMemberRow = {
  project_id: string;
  employee_id: string;
  role_in_project: string | null;
  added_by: string | null;
  added_at: string;
};

export type ProjectMilestoneRow = Timestamps & {
  id: string;
  project_id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  status: MilestoneStatus;
  sort_order: number;
  created_by: string | null;
};

export type ProjectTaskRow = Timestamps & {
  id: string;
  project_id: string;
  milestone_id: string;
  title: string;
  description: string | null;
  assignee_id: string | null;
  status: TaskStatus;
  due_date: string | null;
  sort_order: number;
  created_by: string | null;
};

export type ProjectAssetRow = { project_id: string; asset_id: string; added_by: string | null; added_at: string };
export type ProjectSupplierRow = { project_id: string; supplier_id: string; added_by: string | null; added_at: string };

export type SupplierRow = Timestamps & {
  id: string;
  code: string;
  name: string;
  contact_person: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  category: string | null;
  department_id: string | null;
  service_supplied: string | null;
  status: SupplierStatus;
  evaluation_complete: boolean;
  review_due_date: string | null;
  rating: number | null;
  notes: string | null;
  created_by: string | null;
  deleted_at: string | null;
};

export type MaintenanceAssetRow = Timestamps & {
  id: string;
  asset_code: string;
  name: string;
  description: string | null;
  serial_number: string | null;
  manufacturer: string | null;
  location: string | null;
  department_id: string | null;
  site_id: string | null;
  purchase_date: string | null;
  is_active: boolean;
  created_by: string | null;
};

export type MaintenanceRecordRow = Timestamps & {
  id: string;
  asset_id: string;
  title: string;
  description: string | null;
  maintenance_type: MaintenanceType;
  source: MaintenanceSource;
  frequency: string | null;
  scheduled_date: string | null;
  due_date: string | null;
  completed_date: string | null;
  status: MaintenanceStatus;
  assigned_to: string | null;
  notes: string | null;
  created_by: string | null;
  deleted_at: string | null;
};

export type AuditRow = Timestamps & {
  id: string;
  code: string;
  title: string;
  process_name: string | null;
  department_id: string | null;
  auditor_id: string | null;
  audit_date: string | null;
  audit_type: AuditType;
  status: AuditStatus;
  responsibility: string | null;
  applicable_clauses: string | null;
  inputs: string | null;
  activities: string | null;
  outputs: string | null;
  interactions: string | null;
  summary: string | null;
  notes: string | null;
  created_by: string | null;
  deleted_at: string | null;
};

export type AuditFindingRow = Timestamps & {
  id: string;
  audit_id: string;
  title: string;
  description: string | null;
  clause: string | null;
  severity: FindingSeverity;
  status: FindingStatus;
  created_by: string | null;
};

export type CorrectiveActionRow = Timestamps & {
  id: string;
  audit_id: string;
  finding_id: string | null;
  description: string;
  owner_id: string | null;
  due_date: string | null;
  completed_date: string | null;
  status: CorrectiveActionStatus;
  created_by: string | null;
};

export type DocumentRow = Timestamps & {
  id: string;
  file_name: string;
  storage_path: string;
  bucket: string;
  file_size: number;
  mime_type: string;
  module: DocumentModule;
  entity_type: string;
  entity_id: string;
  /** Project documents only: the milestone subfolder, or null for the project root. */
  milestone_id: string | null;
  description: string | null;
  uploaded_by: string | null;
};

export type SystemSettingRow = {
  key: string;
  value: Json;
  description: string | null;
  is_public: boolean;
  updated_by: string | null;
  updated_at: string;
};

export type AuditLogRow = {
  id: number;
  actor_id: string | null;
  actor_email: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  metadata: Json;
  created_at: string;
};

// ---------------------------------------------------------------------------
// Insert / Update helpers: every column optional except those we mark required.
// ---------------------------------------------------------------------------
type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
type Table<Row, Insert, Relationships extends Rel[] = []> = {
  Row: Row;
  Insert: Insert;
  Update: Partial<Insert>;
  Relationships: Relationships;
};

type Generated = "id" | "created_at" | "updated_at";

export type Database = {
  public: {
    Tables: {
      profiles: Table<
        ProfileRow,
        Optional<ProfileRow, "created_at" | "updated_at" | "full_name" | "avatar_url" | "is_active" | "must_change_password" | "last_login_at">
      >;
      departments: Table<DepartmentRow, Optional<DepartmentRow, Generated | "code" | "description" | "is_active">>;
      job_titles: Table<JobTitleRow, Optional<JobTitleRow, Generated | "description" | "is_active">>;
      sites: Table<SiteRow, Optional<SiteRow, Generated | "code" | "address" | "is_active">>;
      project_roles: Table<ProjectRoleRow, Optional<ProjectRoleRow, Generated | "description" | "sort_order" | "is_active">>;
      employees: Table<
        EmployeeRow,
        Optional<
          EmployeeRow,
          | Generated
          | "user_id"
          | "phone"
          | "department_id"
          | "job_title_id"
          | "manager_id"
          | "is_manager"
          | "is_active"
          | "joining_date"
          | "notes"
          | "created_by"
        >,
        [
          { foreignKeyName: "employees_department_id_fkey"; columns: ["department_id"]; isOneToOne: false; referencedRelation: "departments"; referencedColumns: ["id"] },
          { foreignKeyName: "employees_job_title_id_fkey"; columns: ["job_title_id"]; isOneToOne: false; referencedRelation: "job_titles"; referencedColumns: ["id"] },
          { foreignKeyName: "employees_manager_id_fkey"; columns: ["manager_id"]; isOneToOne: false; referencedRelation: "employees"; referencedColumns: ["id"] },
          { foreignKeyName: "employees_user_id_fkey"; columns: ["user_id"]; isOneToOne: true; referencedRelation: "profiles"; referencedColumns: ["id"] },
        ]
      >;
      roles: Table<RoleRow, Optional<RoleRow, Generated | "description" | "is_system">>;
      permissions: Table<PermissionRow, Optional<PermissionRow, "id" | "created_at" | "description">>;
      role_permissions: Table<
        RolePermissionRow,
        Optional<RolePermissionRow, "created_at">,
        [
          { foreignKeyName: "role_permissions_role_id_fkey"; columns: ["role_id"]; isOneToOne: false; referencedRelation: "roles"; referencedColumns: ["id"] },
          { foreignKeyName: "role_permissions_permission_id_fkey"; columns: ["permission_id"]; isOneToOne: false; referencedRelation: "permissions"; referencedColumns: ["id"] },
        ]
      >;
      user_roles: Table<
        UserRoleRow,
        Optional<UserRoleRow, "assigned_by" | "assigned_at">,
        [
          { foreignKeyName: "user_roles_role_id_fkey"; columns: ["role_id"]; isOneToOne: false; referencedRelation: "roles"; referencedColumns: ["id"] },
          { foreignKeyName: "user_roles_user_id_fkey"; columns: ["user_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
        ]
      >;
      training_levels: Table<TrainingLevelRow, Optional<TrainingLevelRow, Generated | "sort_order" | "is_active">>;
      training_statuses: Table<
        TrainingStatusRow,
        Optional<TrainingStatusRow, Generated | "sort_order" | "is_default" | "is_active">
      >;
      trainings: Table<
        TrainingRow,
        Optional<
          TrainingRow,
          Generated | "code" | "description" | "level_id" | "status_id" | "duration_hours" | "created_by" | "deleted_at"
        >,
        [
          { foreignKeyName: "trainings_level_id_fkey"; columns: ["level_id"]; isOneToOne: false; referencedRelation: "training_levels"; referencedColumns: ["id"] },
          { foreignKeyName: "trainings_status_id_fkey"; columns: ["status_id"]; isOneToOne: false; referencedRelation: "training_statuses"; referencedColumns: ["id"] },
        ]
      >;
      training_assignments: Table<
        TrainingAssignmentRow,
        Optional<
          TrainingAssignmentRow,
          Generated | "assigned_by" | "assigned_date" | "due_date" | "status" | "completion_date" | "notes"
        >,
        [
          { foreignKeyName: "training_assignments_training_id_fkey"; columns: ["training_id"]; isOneToOne: false; referencedRelation: "trainings"; referencedColumns: ["id"] },
          { foreignKeyName: "training_assignments_employee_id_fkey"; columns: ["employee_id"]; isOneToOne: false; referencedRelation: "employees"; referencedColumns: ["id"] },
        ]
      >;
      projects: Table<
        ProjectRow,
        Optional<
          ProjectRow,
          | Generated
          | "description"
          | "manager_id"
          | "site_id"
          | "start_date"
          | "expected_end_date"
          | "actual_end_date"
          | "status"
          | "priority"
          | "notes"
          | "created_by"
          | "deleted_at"
        >,
        [
          { foreignKeyName: "projects_manager_id_fkey"; columns: ["manager_id"]; isOneToOne: false; referencedRelation: "employees"; referencedColumns: ["id"] },
          { foreignKeyName: "projects_site_id_fkey"; columns: ["site_id"]; isOneToOne: false; referencedRelation: "sites"; referencedColumns: ["id"] },
          { foreignKeyName: "project_milestones_project_id_fkey"; columns: ["id"]; isOneToOne: false; referencedRelation: "project_milestones"; referencedColumns: ["project_id"] },
        ]
      >;
      project_members: Table<
        ProjectMemberRow,
        Optional<ProjectMemberRow, "role_in_project" | "added_by" | "added_at">,
        [
          { foreignKeyName: "project_members_project_id_fkey"; columns: ["project_id"]; isOneToOne: false; referencedRelation: "projects"; referencedColumns: ["id"] },
          { foreignKeyName: "project_members_employee_id_fkey"; columns: ["employee_id"]; isOneToOne: false; referencedRelation: "employees"; referencedColumns: ["id"] },
        ]
      >;
      project_milestones: Table<
        ProjectMilestoneRow,
        Optional<ProjectMilestoneRow, Generated | "start_date" | "end_date" | "status" | "sort_order" | "created_by">,
        [{ foreignKeyName: "project_milestones_project_id_fkey"; columns: ["project_id"]; isOneToOne: false; referencedRelation: "projects"; referencedColumns: ["id"] }]
      >;
      project_tasks: Table<
        ProjectTaskRow,
        Optional<ProjectTaskRow, Generated | "description" | "assignee_id" | "status" | "due_date" | "sort_order" | "created_by">,
        [
          { foreignKeyName: "project_tasks_project_id_fkey"; columns: ["project_id"]; isOneToOne: false; referencedRelation: "projects"; referencedColumns: ["id"] },
          { foreignKeyName: "project_tasks_milestone_id_fkey"; columns: ["milestone_id"]; isOneToOne: false; referencedRelation: "project_milestones"; referencedColumns: ["id"] },
          { foreignKeyName: "project_tasks_assignee_id_fkey"; columns: ["assignee_id"]; isOneToOne: false; referencedRelation: "employees"; referencedColumns: ["id"] },
        ]
      >;
      project_assets: Table<
        ProjectAssetRow,
        Optional<ProjectAssetRow, "added_by" | "added_at">,
        [
          { foreignKeyName: "project_assets_project_id_fkey"; columns: ["project_id"]; isOneToOne: false; referencedRelation: "projects"; referencedColumns: ["id"] },
          { foreignKeyName: "project_assets_asset_id_fkey"; columns: ["asset_id"]; isOneToOne: false; referencedRelation: "maintenance_assets"; referencedColumns: ["id"] },
        ]
      >;
      project_suppliers: Table<
        ProjectSupplierRow,
        Optional<ProjectSupplierRow, "added_by" | "added_at">,
        [
          { foreignKeyName: "project_suppliers_project_id_fkey"; columns: ["project_id"]; isOneToOne: false; referencedRelation: "projects"; referencedColumns: ["id"] },
          { foreignKeyName: "project_suppliers_supplier_id_fkey"; columns: ["supplier_id"]; isOneToOne: false; referencedRelation: "suppliers"; referencedColumns: ["id"] },
        ]
      >;
      suppliers: Table<
        SupplierRow,
        Optional<
          SupplierRow,
          | Generated
          | "contact_person"
          | "email"
          | "phone"
          | "address"
          | "category"
          | "department_id"
          | "service_supplied"
          | "status"
          | "evaluation_complete"
          | "review_due_date"
          | "rating"
          | "notes"
          | "created_by"
          | "deleted_at"
        >,
        [
          { foreignKeyName: "suppliers_department_id_fkey"; columns: ["department_id"]; isOneToOne: false; referencedRelation: "departments"; referencedColumns: ["id"] },
        ]
      >;
      maintenance_assets: Table<
        MaintenanceAssetRow,
        Optional<
          MaintenanceAssetRow,
          | Generated
          | "description"
          | "serial_number"
          | "manufacturer"
          | "location"
          | "department_id"
          | "site_id"
          | "purchase_date"
          | "is_active"
          | "created_by"
        >,
        [
          { foreignKeyName: "maintenance_assets_department_id_fkey"; columns: ["department_id"]; isOneToOne: false; referencedRelation: "departments"; referencedColumns: ["id"] },
          { foreignKeyName: "maintenance_assets_site_id_fkey"; columns: ["site_id"]; isOneToOne: false; referencedRelation: "sites"; referencedColumns: ["id"] },
        ]
      >;
      maintenance_records: Table<
        MaintenanceRecordRow,
        Optional<
          MaintenanceRecordRow,
          | Generated
          | "description"
          | "maintenance_type"
          | "source"
          | "frequency"
          | "scheduled_date"
          | "due_date"
          | "completed_date"
          | "status"
          | "assigned_to"
          | "notes"
          | "created_by"
          | "deleted_at"
        >,
        [
          { foreignKeyName: "maintenance_records_asset_id_fkey"; columns: ["asset_id"]; isOneToOne: false; referencedRelation: "maintenance_assets"; referencedColumns: ["id"] },
          { foreignKeyName: "maintenance_records_assigned_to_fkey"; columns: ["assigned_to"]; isOneToOne: false; referencedRelation: "employees"; referencedColumns: ["id"] },
        ]
      >;
      audits: Table<
        AuditRow,
        Optional<
          AuditRow,
          | Generated
          | "process_name"
          | "department_id"
          | "auditor_id"
          | "audit_date"
          | "audit_type"
          | "status"
          | "responsibility"
          | "applicable_clauses"
          | "inputs"
          | "activities"
          | "outputs"
          | "interactions"
          | "summary"
          | "notes"
          | "created_by"
          | "deleted_at"
        >,
        [
          { foreignKeyName: "audits_department_id_fkey"; columns: ["department_id"]; isOneToOne: false; referencedRelation: "departments"; referencedColumns: ["id"] },
          { foreignKeyName: "audits_auditor_id_fkey"; columns: ["auditor_id"]; isOneToOne: false; referencedRelation: "employees"; referencedColumns: ["id"] },
        ]
      >;
      audit_findings: Table<
        AuditFindingRow,
        Optional<AuditFindingRow, Generated | "description" | "clause" | "severity" | "status" | "created_by">,
        [
          { foreignKeyName: "audit_findings_audit_id_fkey"; columns: ["audit_id"]; isOneToOne: false; referencedRelation: "audits"; referencedColumns: ["id"] },
        ]
      >;
      corrective_actions: Table<
        CorrectiveActionRow,
        Optional<
          CorrectiveActionRow,
          Generated | "finding_id" | "owner_id" | "due_date" | "completed_date" | "status" | "created_by"
        >,
        [
          { foreignKeyName: "corrective_actions_audit_id_fkey"; columns: ["audit_id"]; isOneToOne: false; referencedRelation: "audits"; referencedColumns: ["id"] },
          { foreignKeyName: "corrective_actions_finding_id_fkey"; columns: ["finding_id"]; isOneToOne: false; referencedRelation: "audit_findings"; referencedColumns: ["id"] },
          { foreignKeyName: "corrective_actions_owner_id_fkey"; columns: ["owner_id"]; isOneToOne: false; referencedRelation: "employees"; referencedColumns: ["id"] },
        ]
      >;
      documents: Table<
        DocumentRow,
        Optional<DocumentRow, Generated | "bucket" | "milestone_id" | "description" | "uploaded_by">,
        [
          { foreignKeyName: "documents_uploaded_by_fkey"; columns: ["uploaded_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
        ]
      >;
      system_settings: Table<
        SystemSettingRow,
        Optional<SystemSettingRow, "value" | "description" | "is_public" | "updated_by" | "updated_at">
      >;
      audit_logs: Table<
        AuditLogRow,
        Optional<AuditLogRow, "id" | "actor_id" | "actor_email" | "entity_type" | "entity_id" | "metadata" | "created_at">
      >;
    };
    Views: Record<string, never>;
    Functions: {
      has_permission: { Args: { p_key: string }; Returns: boolean };
      has_any_permission: { Args: { p_keys: string[] }; Returns: boolean };
      get_my_permissions: { Args: Record<string, never>; Returns: string[] };
      current_employee_id: { Args: Record<string, never>; Returns: string | null };
      is_manager_of: { Args: { p_employee_id: string }; Returns: boolean };
      can_access_entity: { Args: { p_module: string; p_entity_id: string }; Returns: boolean };
      can_access_document_path: { Args: { p_path: string }; Returns: boolean };
      log_action: {
        Args: { p_action: string; p_entity_type?: string | null; p_entity_id?: string | null; p_metadata?: Json };
        Returns: undefined;
      };
      refresh_overdue_assignments: { Args: Record<string, never>; Returns: number };
    };
    Enums: {
      assignment_status: AssignmentStatus;
      project_status: ProjectStatus;
      project_priority: ProjectPriority;
      supplier_status: SupplierStatus;
      maintenance_status: MaintenanceStatus;
      maintenance_type: MaintenanceType;
      maintenance_source: MaintenanceSource;
      audit_status: AuditStatus;
      audit_type: AuditType;
      milestone_status: MilestoneStatus;
      task_status: TaskStatus;
      finding_severity: FindingSeverity;
      finding_status: FindingStatus;
      corrective_action_status: CorrectiveActionStatus;
      document_module: DocumentModule;
    };
    CompositeTypes: Record<string, never>;
  };
};

export type Tables<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Row"];
export type TablesInsert<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Update"];
