"use server";

import { revalidatePath, updateTag } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { logAction } from "@/lib/audit-log";
import { ForbiddenError, requirePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { idSchema } from "@/lib/validation/common";
import {
  adminResetPasswordSchema,
  createUserSchema,
  departmentSchema,
  jobTitleSchema,
  projectRoleSchema,
  roleSchema,
  setRolePermissionsSchema,
  setUserActiveSchema,
  setUserRolesSchema,
  siteSchema,
  systemSettingsSchema,
  updateDepartmentSchema,
  updateJobTitleSchema,
  updateProjectRoleSchema,
  updateRoleSchema,
  updateSiteSchema,
} from "@/lib/validation/admin";
import { trainingConfigItemSchema } from "@/lib/validation/training";
import { runAction, type ActionResult } from "./result";

// ---------------------------------------------------------------------- users
/**
 * Creates an auth user (service role — the only way to create a user with a
 * known password), then assigns roles and optionally links an employee.
 * The actor must hold admin.users; the service-role client never leaves this
 * function.
 */
export async function createUserAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(createUserSchema, input, async (data) => {
    const actor = await requirePermission(PERMISSIONS.admin.users);
    const admin = createAdminClient();

    const { data: created, error } = await admin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.fullName },
    });
    if (error || !created.user) throw new Error(error?.message ?? "Failed to create user.");
    const userId = created.user.id;

    // The on_auth_user_created trigger created the profile row; set the flag.
    await admin.from("profiles").update({ must_change_password: data.mustChangePassword, full_name: data.fullName }).eq("id", userId);

    const supabase = await createClient();
    const { error: rolesError } = await supabase
      .from("user_roles")
      .insert(data.roleIds.map((roleId) => ({ user_id: userId, role_id: roleId, assigned_by: actor.id })));
    if (rolesError) throw rolesError;

    if (data.employeeId) {
      const { error: linkError } = await supabase.from("employees").update({ user_id: userId }).eq("id", data.employeeId);
      if (linkError) throw linkError;
    }

    await logAction(supabase, "admin.user_created", { type: "user", id: userId }, {
      email: data.email,
      role_ids: data.roleIds,
      employee_id: data.employeeId || null,
    });
    revalidatePath("/admin/users");
    revalidatePath("/employees");
    return { id: userId };
  });
}

export async function setUserRolesAction(input: unknown): Promise<ActionResult> {
  return runAction(setUserRolesSchema, input, async ({ userId, roleIds }) => {
    const actor = await requirePermission(PERMISSIONS.admin.users);
    if (userId === actor.id) {
      // Prevent an admin from locking themselves out by dropping their admin role.
      const { data: adminRole } = await (await createClient()).from("roles").select("id").eq("name", "Admin").maybeSingle();
      if (adminRole && actor.roles.some((r) => r.id === adminRole.id) && !roleIds.includes(adminRole.id)) {
        throw new ForbiddenError("You cannot remove your own Admin role.");
      }
    }
    const supabase = await createClient();
    const { error: delError } = await supabase.from("user_roles").delete().eq("user_id", userId);
    if (delError) throw delError;
    if (roleIds.length) {
      const { error } = await supabase
        .from("user_roles")
        .insert(roleIds.map((roleId) => ({ user_id: userId, role_id: roleId, assigned_by: actor.id })));
      if (error) throw error;
    }
    await logAction(supabase, "admin.user_roles_set", { type: "user", id: userId }, { role_ids: roleIds });
    revalidatePath("/admin/users");
    revalidatePath(`/admin/users/${userId}`);
    return undefined;
  });
}

export async function setUserActiveAction(input: unknown): Promise<ActionResult> {
  return runAction(setUserActiveSchema, input, async ({ userId, isActive }) => {
    const actor = await requirePermission(PERMISSIONS.admin.users);
    if (userId === actor.id && !isActive) throw new ForbiddenError("You cannot deactivate your own account.");
    const supabase = await createClient();
    const { error } = await supabase.from("profiles").update({ is_active: isActive }).eq("id", userId);
    if (error) throw error;
    if (!isActive) {
      // Revoke sessions so the deactivated user is signed out everywhere.
      const admin = createAdminClient();
      await admin.auth.admin.signOut(userId, "global").catch(() => undefined);
    }
    await logAction(supabase, isActive ? "admin.user_activated" : "admin.user_deactivated", { type: "user", id: userId });
    revalidatePath("/admin/users");
    revalidatePath(`/admin/users/${userId}`);
    return undefined;
  });
}

export async function adminResetPasswordAction(input: unknown): Promise<ActionResult> {
  return runAction(adminResetPasswordSchema, input, async ({ userId, newPassword }) => {
    await requirePermission(PERMISSIONS.admin.users);
    const admin = createAdminClient();
    const { error } = await admin.auth.admin.updateUserById(userId, { password: newPassword });
    if (error) throw new Error(error.message);
    await admin.from("profiles").update({ must_change_password: true }).eq("id", userId);
    const supabase = await createClient();
    await logAction(supabase, "admin.password_reset", { type: "user", id: userId });
    return undefined;
  });
}

export async function deleteUserAction(input: unknown): Promise<ActionResult> {
  return runAction(idSchema, input, async ({ id }) => {
    const actor = await requirePermission(PERMISSIONS.admin.users);
    if (id === actor.id) throw new ForbiddenError("You cannot delete your own account.");
    const supabase = await createClient();
    const { data: profile } = await supabase.from("profiles").select("email").eq("id", id).maybeSingle();
    const admin = createAdminClient();
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) throw new Error(error.message);
    await logAction(supabase, "admin.user_deleted", { type: "user", id }, { email: profile?.email ?? null });
    revalidatePath("/admin/users");
    return undefined;
  });
}

// ---------------------------------------------------------------------- roles
export async function createRoleAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(roleSchema, input, async (data) => {
    await requirePermission(PERMISSIONS.admin.roles);
    const supabase = await createClient();
    const { data: row, error } = await supabase
      .from("roles")
      .insert({ name: data.name, description: data.description ?? null })
      .select("id")
      .single();
    if (error) throw error;
    await logAction(supabase, "admin.role_created", { type: "role", id: row.id }, { name: data.name });
    revalidatePath("/admin/roles");
    return { id: row.id };
  });
}

export async function updateRoleAction(input: unknown): Promise<ActionResult> {
  return runAction(updateRoleSchema, input, async ({ id, ...data }) => {
    await requirePermission(PERMISSIONS.admin.roles);
    const supabase = await createClient();
    const { data: existing } = await supabase.from("roles").select("is_system, name").eq("id", id).maybeSingle();
    if (existing?.is_system && existing.name !== data.name) throw new ForbiddenError("System roles cannot be renamed.");
    const { error } = await supabase.from("roles").update({ name: data.name, description: data.description ?? null }).eq("id", id);
    if (error) throw error;
    await logAction(supabase, "admin.role_updated", { type: "role", id });
    revalidatePath("/admin/roles");
    return undefined;
  });
}

export async function deleteRoleAction(input: unknown): Promise<ActionResult> {
  return runAction(idSchema, input, async ({ id }) => {
    await requirePermission(PERMISSIONS.admin.roles);
    const supabase = await createClient();
    const { data: existing } = await supabase.from("roles").select("is_system, name").eq("id", id).maybeSingle();
    if (existing?.is_system) throw new ForbiddenError("System roles cannot be deleted.");
    const { error } = await supabase.from("roles").delete().eq("id", id);
    if (error) throw error;
    await logAction(supabase, "admin.role_deleted", { type: "role", id }, { name: existing?.name ?? null });
    revalidatePath("/admin/roles");
    return undefined;
  });
}

export async function setRolePermissionsAction(input: unknown): Promise<ActionResult> {
  return runAction(setRolePermissionsSchema, input, async ({ roleId, permissionIds }) => {
    await requirePermission(PERMISSIONS.admin.roles);
    const supabase = await createClient();
    const { data: role } = await supabase.from("roles").select("name, is_system").eq("id", roleId).maybeSingle();
    if (role?.name === "Admin") throw new ForbiddenError("The Admin role always holds every permission.");

    const { error: delError } = await supabase.from("role_permissions").delete().eq("role_id", roleId);
    if (delError) throw delError;
    if (permissionIds.length) {
      const { error } = await supabase
        .from("role_permissions")
        .insert(permissionIds.map((permissionId) => ({ role_id: roleId, permission_id: permissionId })));
      if (error) throw error;
    }
    await logAction(supabase, "admin.role_permissions_set", { type: "role", id: roleId }, { count: permissionIds.length });
    revalidatePath("/admin/roles");
    return undefined;
  });
}

// ------------------------------------------------------------- master data
export async function createDepartmentAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(departmentSchema, input, async (data) => {
    await requirePermission(PERMISSIONS.admin.settings);
    const supabase = await createClient();
    const { data: row, error } = await supabase
      .from("departments")
      .insert({ name: data.name, code: data.code ?? null, description: data.description ?? null, is_active: data.isActive })
      .select("id")
      .single();
    if (error) throw error;
    await logAction(supabase, "admin.department_created", { type: "department", id: row.id }, { name: data.name });
    revalidatePath("/admin/departments");
    return { id: row.id };
  });
}

export async function updateDepartmentAction(input: unknown): Promise<ActionResult> {
  return runAction(updateDepartmentSchema, input, async ({ id, ...data }) => {
    await requirePermission(PERMISSIONS.admin.settings);
    const supabase = await createClient();
    const { error } = await supabase
      .from("departments")
      .update({ name: data.name, code: data.code ?? null, description: data.description ?? null, is_active: data.isActive })
      .eq("id", id);
    if (error) throw error;
    await logAction(supabase, "admin.department_updated", { type: "department", id });
    revalidatePath("/admin/departments");
    return undefined;
  });
}

export async function deleteDepartmentAction(input: unknown): Promise<ActionResult> {
  return runAction(idSchema, input, async ({ id }) => {
    await requirePermission(PERMISSIONS.admin.settings);
    const supabase = await createClient();
    const { error } = await supabase.from("departments").delete().eq("id", id);
    if (error) throw error;
    await logAction(supabase, "admin.department_deleted", { type: "department", id });
    revalidatePath("/admin/departments");
    return undefined;
  });
}

export async function createJobTitleAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(jobTitleSchema, input, async (data) => {
    await requirePermission(PERMISSIONS.admin.settings);
    const supabase = await createClient();
    const { data: row, error } = await supabase
      .from("job_titles")
      .insert({ name: data.name, description: data.description ?? null, is_active: data.isActive })
      .select("id")
      .single();
    if (error) throw error;
    await logAction(supabase, "admin.job_title_created", { type: "job_title", id: row.id }, { name: data.name });
    revalidatePath("/admin/job-titles");
    return { id: row.id };
  });
}

export async function updateJobTitleAction(input: unknown): Promise<ActionResult> {
  return runAction(updateJobTitleSchema, input, async ({ id, ...data }) => {
    await requirePermission(PERMISSIONS.admin.settings);
    const supabase = await createClient();
    const { error } = await supabase
      .from("job_titles")
      .update({ name: data.name, description: data.description ?? null, is_active: data.isActive })
      .eq("id", id);
    if (error) throw error;
    await logAction(supabase, "admin.job_title_updated", { type: "job_title", id });
    revalidatePath("/admin/job-titles");
    return undefined;
  });
}

export async function deleteJobTitleAction(input: unknown): Promise<ActionResult> {
  return runAction(idSchema, input, async ({ id }) => {
    await requirePermission(PERMISSIONS.admin.settings);
    const supabase = await createClient();
    const { error } = await supabase.from("job_titles").delete().eq("id", id);
    if (error) throw error;
    await logAction(supabase, "admin.job_title_deleted", { type: "job_title", id });
    revalidatePath("/admin/job-titles");
    return undefined;
  });
}

// ------------------------------------------------------------------ sites
export async function createSiteAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(siteSchema, input, async (data) => {
    await requirePermission(PERMISSIONS.admin.settings);
    const supabase = await createClient();
    const { data: row, error } = await supabase
      .from("sites")
      .insert({ name: data.name, code: data.code ?? null, address: data.address ?? null, is_active: data.isActive })
      .select("id")
      .single();
    if (error) throw error;
    await logAction(supabase, "admin.site_created", { type: "site", id: row.id }, { name: data.name });
    revalidatePath("/admin/settings");
    return { id: row.id };
  });
}

export async function updateSiteAction(input: unknown): Promise<ActionResult> {
  return runAction(updateSiteSchema, input, async ({ id, ...data }) => {
    await requirePermission(PERMISSIONS.admin.settings);
    const supabase = await createClient();
    const { error } = await supabase
      .from("sites")
      .update({ name: data.name, code: data.code ?? null, address: data.address ?? null, is_active: data.isActive })
      .eq("id", id);
    if (error) throw error;
    await logAction(supabase, "admin.site_updated", { type: "site", id });
    revalidatePath("/admin/settings");
    return undefined;
  });
}

export async function deleteSiteAction(input: unknown): Promise<ActionResult> {
  return runAction(idSchema, input, async ({ id }) => {
    await requirePermission(PERMISSIONS.admin.settings);
    const supabase = await createClient();
    const { error } = await supabase.from("sites").delete().eq("id", id);
    if (error) throw error;
    await logAction(supabase, "admin.site_deleted", { type: "site", id });
    revalidatePath("/admin/settings");
    return undefined;
  });
}

// ------------------------------------------------------------ project roles
export async function createProjectRoleAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(projectRoleSchema, input, async (data) => {
    await requirePermission(PERMISSIONS.admin.settings);
    const supabase = await createClient();
    const { data: row, error } = await supabase
      .from("project_roles")
      .insert({ name: data.name, description: data.description ?? null, sort_order: data.sortOrder, is_active: data.isActive })
      .select("id")
      .single();
    if (error) throw error;
    await logAction(supabase, "admin.project_role_created", { type: "project_role", id: row.id }, { name: data.name });
    revalidatePath("/admin/settings");
    return { id: row.id };
  });
}

export async function updateProjectRoleAction(input: unknown): Promise<ActionResult> {
  return runAction(updateProjectRoleSchema, input, async ({ id, ...data }) => {
    await requirePermission(PERMISSIONS.admin.settings);
    const supabase = await createClient();
    const { error } = await supabase
      .from("project_roles")
      .update({ name: data.name, description: data.description ?? null, sort_order: data.sortOrder, is_active: data.isActive })
      .eq("id", id);
    if (error) throw error;
    await logAction(supabase, "admin.project_role_updated", { type: "project_role", id });
    revalidatePath("/admin/settings");
    return undefined;
  });
}

export async function deleteProjectRoleAction(input: unknown): Promise<ActionResult> {
  return runAction(idSchema, input, async ({ id }) => {
    await requirePermission(PERMISSIONS.admin.settings);
    const supabase = await createClient();
    const { error } = await supabase.from("project_roles").delete().eq("id", id);
    if (error) throw error;
    await logAction(supabase, "admin.project_role_deleted", { type: "project_role", id });
    revalidatePath("/admin/settings");
    return undefined;
  });
}

// ------------------------------------------------------- training config
type ConfigTable = "training_levels" | "training_statuses";

export async function upsertTrainingConfigAction(table: ConfigTable, input: unknown): Promise<ActionResult<{ id: string }>> {
  if (table !== "training_levels" && table !== "training_statuses") return { ok: false, error: "Invalid table." };
  return runAction(trainingConfigItemSchema, input, async (data) => {
    await requirePermission(PERMISSIONS.admin.settings);
    const supabase = await createClient();
    const base = { name: data.name, sort_order: data.sortOrder, is_active: data.isActive };
    let id = data.id;

    if (table === "training_statuses") {
      const payload = { ...base, is_default: Boolean(data.isDefault) };
      if (payload.is_default) {
        // Only one default status.
        await supabase.from("training_statuses").update({ is_default: false }).neq("id", id ?? "00000000-0000-0000-0000-000000000000");
      }
      if (id) {
        const { error } = await supabase.from("training_statuses").update(payload).eq("id", id);
        if (error) throw error;
      } else {
        const { data: row, error } = await supabase.from("training_statuses").insert(payload).select("id").single();
        if (error) throw error;
        id = row.id;
      }
    } else if (id) {
      const { error } = await supabase.from("training_levels").update(base).eq("id", id);
      if (error) throw error;
    } else {
      const { data: row, error } = await supabase.from("training_levels").insert(base).select("id").single();
      if (error) throw error;
      id = row.id;
    }
    await logAction(supabase, `admin.${table}_saved`, { type: table, id }, { name: data.name });
    revalidatePath("/admin/training-config");
    return { id };
  });
}

export async function deleteTrainingConfigAction(table: ConfigTable, input: unknown): Promise<ActionResult> {
  if (table !== "training_levels" && table !== "training_statuses") return { ok: false, error: "Invalid table." };
  return runAction(idSchema, input, async ({ id }) => {
    await requirePermission(PERMISSIONS.admin.settings);
    const supabase = await createClient();
    const { error } = await supabase.from(table).delete().eq("id", id);
    if (error) throw error;
    await logAction(supabase, `admin.${table}_deleted`, { type: table, id });
    revalidatePath("/admin/training-config");
    return undefined;
  });
}

// --------------------------------------------------------------- settings
export async function saveSystemSettingsAction(input: unknown): Promise<ActionResult> {
  return runAction(systemSettingsSchema, input, async (data) => {
    const actor = await requirePermission(PERMISSIONS.admin.settings);
    const supabase = await createClient();
    // Lead days apply to every reminder; store unique values, largest first.
    const leadDays = [
      ...new Set(
        data.reminderLeadDays
          .split(",")
          .map((x) => Number(x.trim()))
          .filter((n) => Number.isFinite(n)),
      ),
    ].sort((a, b) => b - a);
    const rows = [
      { key: "app.name", value: data.appName, is_public: true },
      { key: "app.organisation", value: data.organisation, is_public: true },
      { key: "reminders.from_email", value: data.reminderFromEmail, is_public: false },
      { key: "reminders.equipment_email", value: data.equipmentReminderEmail, is_public: false },
      { key: "reminders.supplier_email", value: data.supplierReminderEmail, is_public: false },
      { key: "reminders.lead_days", value: leadDays, is_public: false },
    ].map((r) => ({ ...r, updated_by: actor.id, updated_at: new Date().toISOString() }));

    const { error } = await supabase.from("system_settings").upsert(rows, { onConflict: "key" });
    if (error) throw error;
    await logAction(supabase, "admin.settings_saved", { type: "system_settings", id: null }, { keys: rows.map((r) => r.key) });
    updateTag("system-settings");
    revalidatePath("/", "layout");
    return undefined;
  });
}
