/**
 * Demo data seed. Creates Auth users (via the Admin API) plus employees,
 * trainings, projects, suppliers, maintenance records and audits.
 *
 * Requires .env.local with NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
 * Run AFTER migrations and supabase/seed.sql:
 *
 *   npm run seed
 *
 * Idempotent: re-running updates existing demo users rather than duplicating them.
 */
import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";

loadEnvConfig(process.cwd());

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DEMO_PASSWORD = process.env.SEED_DEMO_PASSWORD ?? "McMorrowIMS123!";

if (!URL || !SERVICE) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const admin = createClient(URL, SERVICE, { auth: { autoRefreshToken: false, persistSession: false } });

type IdMap = Record<string, string>;

async function must(label: string, result: { data: { id: string } | null; error: { message: string } | null }): Promise<{ id: string }> {
  if (result.error || result.data == null) {
    throw new Error(`${label}: ${result.error?.message ?? "no data"}`);
  }
  return result.data;
}

async function upsertUser(email: string, fullName: string): Promise<string> {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: DEMO_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (data.user) {
    await admin.from("profiles").update({ full_name: fullName, is_active: true, must_change_password: false }).eq("id", data.user.id);
    return data.user.id;
  }
  if (!error || !/already|registered|exists/i.test(error.message)) {
    throw new Error(`createUser ${email}: ${error?.message ?? "unknown error"}`);
  }
  const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  const existing = list.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (!existing) throw new Error(`User ${email} already exists but could not be looked up.`);
  await admin.auth.admin.updateUserById(existing.id, { password: DEMO_PASSWORD, user_metadata: { full_name: fullName } });
  await admin.from("profiles").update({ full_name: fullName, is_active: true, must_change_password: false }).eq("id", existing.id);
  return existing.id;
}

async function mapBy<T extends { id: string; name: string }>(table: string): Promise<IdMap> {
  const { data, error } = await admin.from(table).select("id, name");
  if (error) throw error;
  return Object.fromEntries((data as T[]).map((r) => [r.name, r.id]));
}

async function assignRole(userId: string, roleId: string) {
  await admin.from("user_roles").delete().eq("user_id", userId).eq("role_id", roleId);
  const { error } = await admin.from("user_roles").insert({ user_id: userId, role_id: roleId });
  if (error && error.code !== "23505") throw error;
}

async function upsertEmployee(row: Record<string, unknown> & { employee_code: string }): Promise<string> {
  const { data, error } = await admin.from("employees").upsert(row, { onConflict: "employee_code" }).select("id").single();
  if (error) throw new Error(`employee ${row.employee_code}: ${error.message}`);
  return data.id;
}

async function insertAssignment(
  trainingId: string,
  employeeId: string,
  assignedBy: string,
  assignedDate: string,
  dueDate: string,
  status: "assigned" | "in_progress" | "overdue",
  notes: string | null,
) {
  const { data: existing } = await admin
    .from("training_assignments")
    .select("id")
    .eq("training_id", trainingId)
    .eq("employee_id", employeeId)
    .in("status", ["assigned", "in_progress", "overdue"])
    .maybeSingle();
  if (existing) return;
  const { error } = await admin.from("training_assignments").insert({
    training_id: trainingId,
    employee_id: employeeId,
    assigned_by: assignedBy,
    assigned_date: assignedDate,
    due_date: dueDate,
    status,
    notes,
  });
  if (error) throw new Error(`assignment: ${error.message}`);
}

async function seed() {
  console.log("Seeding McMorrow IMS demo data…");

  const departments = await mapBy("departments");
  const titles = await mapBy("job_titles");
  const roles = await mapBy("roles");
  const levels = await mapBy("training_levels");
  const statuses = await mapBy("training_statuses");

  const users = {
    admin: await upsertUser("admin@mcmorrow-ims.local", "Aisha Rahman"),
    manager: await upsertUser("manager@mcmorrow-ims.local", "James Okonkwo"),
    employee: await upsertUser("employee@mcmorrow-ims.local", "Priya Nair"),
    auditor: await upsertUser("auditor@mcmorrow-ims.local", "Elena Rossi"),
    training: await upsertUser("training@mcmorrow-ims.local", "Tom Becker"),
    projects: await upsertUser("projects@mcmorrow-ims.local", "Sofia Alvarez"),
    suppliers: await upsertUser("suppliers@mcmorrow-ims.local", "Chen Wei"),
    maintenance: await upsertUser("maintenance@mcmorrow-ims.local", "Noah Patel"),
  };

  await assignRole(users.admin, roles.Admin);
  await assignRole(users.manager, roles.Manager);
  await assignRole(users.employee, roles.Employee);
  await assignRole(users.auditor, roles["Quality & Compliance"]);
  await assignRole(users.training, roles["Finance & Administration"]);
  await assignRole(users.projects, roles["Construction Management"]);
  await assignRole(users.suppliers, roles["Finance & Administration"]);
  await assignRole(users.maintenance, roles["Finance & Administration"]);

  const emp: Record<string, string> = {};
  emp.admin = await upsertEmployee({
    employee_code: "EMP-001",
    user_id: users.admin,
    first_name: "Aisha",
    last_name: "Rahman",
    email: "admin@mcmorrow-ims.local",
    phone: "+1 555 0101",
    department_id: departments["Human Resources"],
    job_title_id: titles["HR Manager"],
    is_manager: true,
    joining_date: "2018-03-12",
  });
  emp.manager = await upsertEmployee({
    employee_code: "EMP-002",
    user_id: users.manager,
    first_name: "James",
    last_name: "Okonkwo",
    email: "manager@mcmorrow-ims.local",
    phone: "+1 555 0102",
    department_id: departments.Production,
    job_title_id: titles["Production Supervisor"],
    is_manager: true,
    joining_date: "2019-06-01",
  });

  emp.training = await upsertEmployee({
    employee_code: "EMP-003",
    user_id: users.training,
    first_name: "Tom",
    last_name: "Becker",
    email: "training@mcmorrow-ims.local",
    department_id: departments["Human Resources"],
    job_title_id: titles["HR Executive"],
    manager_id: emp.admin,
    is_manager: true,
    joining_date: "2020-01-15",
  });
  emp.employee = await upsertEmployee({
    employee_code: "EMP-004",
    user_id: users.employee,
    first_name: "Priya",
    last_name: "Nair",
    email: "employee@mcmorrow-ims.local",
    department_id: departments.Production,
    job_title_id: titles["Line Operator"],
    manager_id: emp.manager,
    is_manager: false,
    joining_date: "2022-09-01",
  });
  emp.auditor = await upsertEmployee({
    employee_code: "EMP-005",
    user_id: users.auditor,
    first_name: "Elena",
    last_name: "Rossi",
    email: "auditor@mcmorrow-ims.local",
    department_id: departments["Quality Assurance"],
    job_title_id: titles["Internal Auditor"],
    manager_id: emp.admin,
    is_manager: false,
    joining_date: "2021-04-20",
  });
  emp.projects = await upsertEmployee({
    employee_code: "EMP-006",
    user_id: users.projects,
    first_name: "Sofia",
    last_name: "Alvarez",
    email: "projects@mcmorrow-ims.local",
    department_id: departments.Operations,
    job_title_id: titles["Project Manager"],
    manager_id: emp.admin,
    is_manager: true,
    joining_date: "2019-11-11",
  });
  emp.suppliers = await upsertEmployee({
    employee_code: "EMP-007",
    user_id: users.suppliers,
    first_name: "Chen",
    last_name: "Wei",
    email: "suppliers@mcmorrow-ims.local",
    department_id: departments.Procurement,
    job_title_id: titles["Procurement Lead"],
    manager_id: emp.admin,
    is_manager: false,
    joining_date: "2020-08-03",
  });
  emp.maintenance = await upsertEmployee({
    employee_code: "EMP-008",
    user_id: users.maintenance,
    first_name: "Noah",
    last_name: "Patel",
    email: "maintenance@mcmorrow-ims.local",
    department_id: departments.Engineering,
    job_title_id: titles["Maintenance Engineer"],
    manager_id: emp.admin,
    is_manager: true,
    joining_date: "2017-02-14",
  });
  emp.operator = await upsertEmployee({
    employee_code: "EMP-009",
    first_name: "Luis",
    last_name: "Garcia",
    email: "luis.garcia@mcmorrow-ims.local",
    department_id: departments.Production,
    job_title_id: titles["Line Operator"],
    manager_id: emp.manager,
    is_manager: false,
    joining_date: "2023-01-09",
  });

  const fire = await must(
    "training fire",
    await admin
      .from("trainings")
      .upsert(
        {
          code: "TRN-FS-01",
          name: "Fire Safety Training",
          description: "Evacuation routes, extinguisher types and assembly points.",
          level_id: levels.Beginner,
          status_id: statuses.Active,
          duration_hours: 2,
          created_by: users.training,
        },
        { onConflict: "code" },
      )
      .select("id")
      .single(),
  );
  const gmp = await must(
    "training gmp",
    await admin
      .from("trainings")
      .upsert(
        {
          code: "TRN-GMP-02",
          name: "Good Manufacturing Practice",
          description: "Hygiene, documentation and line clearance for production staff.",
          level_id: levels.Intermediate,
          status_id: statuses.Active,
          duration_hours: 8,
          created_by: users.training,
        },
        { onConflict: "code" },
      )
      .select("id")
      .single(),
  );

  await insertAssignment(fire.id, emp.employee, users.training, "2026-09-01", "2026-09-30", "in_progress", "Complete before the next fire drill.");
  await insertAssignment(gmp.id, emp.employee, users.manager, "2026-08-15", "2026-09-15", "overdue", null);
  await insertAssignment(fire.id, emp.operator, users.manager, "2026-09-10", "2026-10-10", "assigned", null);

  const project = await must(
    "project",
    await admin
      .from("projects")
      .upsert(
        {
          code: "PRJ-ALPHA",
          name: "Line 3 Upgrade",
          description: "Replace the filling line PLC and revalidate the process.",
          manager_id: emp.projects,
          start_date: "2026-07-01",
          expected_end_date: "2026-12-15",
          status: "active",
          priority: "high",
          created_by: users.projects,
        },
        { onConflict: "code" },
      )
      .select("id")
      .single(),
  );
  await admin.from("project_members").upsert(
    [
      { project_id: project.id, employee_id: emp.projects, role_in_project: "Project manager", added_by: users.projects },
      { project_id: project.id, employee_id: emp.maintenance, role_in_project: "Engineering lead", added_by: users.projects },
      { project_id: project.id, employee_id: emp.manager, role_in_project: "Production owner", added_by: users.projects },
    ],
    { onConflict: "project_id,employee_id" },
  );

  const existingMilestones = await admin.from("project_milestones").select("id").eq("project_id", project.id).limit(1);
  if (!existingMilestones.data?.length) {
    await admin.from("project_milestones").insert([
      {
        project_id: project.id,
        name: "PLC replacement",
        start_date: "2026-07-01",
        end_date: "2026-09-30",
        status: "in_progress",
        sort_order: 0,
        created_by: users.projects,
      },
      {
        project_id: project.id,
        name: "Process revalidation",
        start_date: "2026-10-01",
        end_date: "2026-12-15",
        status: "planned",
        sort_order: 1,
        created_by: users.projects,
      },
    ]);
  }

  await admin.from("suppliers").upsert(
    {
      code: "SUP-ACME",
      name: "Acme Calibration Ltd",
      contact_person: "Rita Shah",
      email: "rita@acme-cal.example",
      phone: "+1 555 0199",
      address: "14 Industrial Way, Springfield",
      category: "Calibration",
      department_id: departments.Engineering,
      service_supplied: "Instrument calibration and certificates",
      status: "active",
      evaluation_complete: true,
      review_due_date: "2026-11-30",
      rating: 4,
      created_by: users.suppliers,
    },
    { onConflict: "code" },
  );

  const asset = await must(
    "asset",
    await admin
      .from("maintenance_assets")
      .upsert(
        {
          asset_code: "AST-FILL-01",
          name: "Filling machine FM-200",
          description: "Rotary filler on Line 3",
          serial_number: "FM200-8831",
          manufacturer: "NordFill",
          location: "Production hall A",
          department_id: departments.Production,
          purchase_date: "2021-05-18",
          created_by: users.maintenance,
        },
        { onConflict: "asset_code" },
      )
      .select("id")
      .single(),
  );

  const existingRecord = await admin.from("maintenance_records").select("id").eq("asset_id", asset.id).eq("title", "Quarterly calibration").maybeSingle();
  if (!existingRecord.data) {
    await admin.from("maintenance_records").insert({
      asset_id: asset.id,
      title: "Quarterly calibration",
      description: "Verify fill volume and torque settings.",
      maintenance_type: "calibration",
      source: "internal",
      frequency: "quarterly",
      scheduled_date: "2026-09-01",
      due_date: "2026-09-30",
      status: "due",
      assigned_to: emp.maintenance,
      created_by: users.maintenance,
    });
  }

  const audit = await must(
    "audit",
    await admin
      .from("audits")
      .upsert(
        {
          code: "AUD-QMS-26Q3",
          title: "Q3 Internal QMS Audit",
          process_name: "Production and training records",
          department_id: departments.Production,
          auditor_id: emp.auditor,
          audit_date: "2026-09-18",
          audit_type: "internal",
          status: "in_progress",
          responsibility: "Production Supervisor",
          applicable_clauses: "ISO 9001 7.2, 8.5.1",
          summary: "Focus on competence records and line clearance.",
          created_by: users.auditor,
        },
        { onConflict: "code" },
      )
      .select("id")
      .single(),
  );
  const existingFinding = await admin.from("audit_findings").select("id").eq("audit_id", audit.id).eq("title", "Training records incomplete").maybeSingle();
  if (!existingFinding.data) {
    const { data: finding } = await admin
      .from("audit_findings")
      .insert({
        audit_id: audit.id,
        title: "Training records incomplete",
        description: "Two operators on Line 3 have no current GMP assignment.",
        clause: "7.2",
        severity: "minor",
        status: "open",
        created_by: users.auditor,
      })
      .select("id")
      .single();
    if (finding) {
      await admin.from("corrective_actions").insert({
        audit_id: audit.id,
        finding_id: finding.id,
        description: "Assign GMP training to the two operators and attach evidence.",
        owner_id: emp.manager,
        due_date: "2026-10-15",
        status: "open",
        created_by: users.auditor,
      });
    }
  }

  console.log(`
Demo users (password: ${DEMO_PASSWORD})
  admin@mcmorrow-ims.local          Admin (Managing Director)
  manager@mcmorrow-ims.local        Manager (Production Supervisor)
  employee@mcmorrow-ims.local       Employee (reports to James)
  auditor@mcmorrow-ims.local        Quality & Compliance
  training@mcmorrow-ims.local       Finance & Administration
  projects@mcmorrow-ims.local       Construction Management
  suppliers@mcmorrow-ims.local      Finance & Administration
  maintenance@mcmorrow-ims.local    Finance & Administration
`);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
