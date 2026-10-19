"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { logAction } from "@/lib/audit-log";
import { ForbiddenError, requireActionUser, requirePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { idSchema } from "@/lib/validation/common";
import {
  projectMemberSchema,
  projectSchema,
  projectTaskSchema,
  removeProjectMemberSchema,
  setTaskStatusSchema,
  updateProjectSchema,
  updateProjectTaskSchema,
  type MilestoneInput,
  type ProjectInput,
} from "@/lib/validation/projects";
import { runAction, type ActionResult } from "./result";

function namedMilestones(milestones: MilestoneInput[]) {
  return milestones.filter((m) => Boolean(m.name));
}

function rollupDates(milestones: MilestoneInput[]) {
  const named = namedMilestones(milestones);
  const starts = named.map((m) => m.startDate).filter((d): d is string => Boolean(d)).sort();
  const ends = named.map((m) => m.endDate).filter((d): d is string => Boolean(d)).sort();
  return {
    start_date: starts[0] ?? null,
    expected_end_date: ends[ends.length - 1] ?? null,
  };
}

function toRow(input: ProjectInput) {
  return {
    code: input.code,
    name: input.name,
    description: input.description ?? null,
    manager_id: input.managerId ?? null,
    site_id: input.siteId,
    ...rollupDates(input.milestones),
    actual_end_date: input.actualEndDate ?? null,
    status: input.status,
    priority: input.priority,
    notes: input.notes ?? null,
  };
}

async function syncMilestones(
  supabase: Awaited<ReturnType<typeof createClient>>,
  projectId: string,
  milestones: MilestoneInput[],
  createdBy?: string,
) {
  const { data: existing, error: loadError } = await supabase.from("project_milestones").select("id").eq("project_id", projectId);
  if (loadError) throw loadError;

  const keep = new Set(milestones.map((m) => m.id).filter((id): id is string => Boolean(id)));
  const toDelete = (existing ?? []).map((r) => r.id).filter((id) => !keep.has(id));
  if (toDelete.length) {
    const { error } = await supabase.from("project_milestones").delete().in("id", toDelete);
    if (error) throw error;
  }

  if (!milestones.length) return;

  const rows = milestones.map((m, index) => ({
    ...(m.id ? { id: m.id } : {}),
    project_id: projectId,
    name: m.name,
    start_date: m.startDate ?? null,
    end_date: m.endDate ?? null,
    status: m.status,
    sort_order: index,
    ...(createdBy && !m.id ? { created_by: createdBy } : {}),
  }));
  const { error } = await supabase.from("project_milestones").upsert(rows);
  if (error) throw error;
}

/**
 * Replace the optional project ↔ asset / supplier links with `ids`. Newly added
 * links must point at an active asset / supplier; existing links are left alone
 * so a project keeps a link to something that was deactivated later.
 */
async function syncAssetLinks(supabase: Awaited<ReturnType<typeof createClient>>, projectId: string, ids: string[], addedBy: string) {
  const unique = [...new Set(ids)];
  const { data: existing, error: loadError } = await supabase.from("project_assets").select("asset_id").eq("project_id", projectId);
  if (loadError) throw loadError;
  const current = new Set((existing ?? []).map((r) => r.asset_id));

  const toRemove = [...current].filter((id) => !unique.includes(id));
  if (toRemove.length) {
    const { error } = await supabase.from("project_assets").delete().eq("project_id", projectId).in("asset_id", toRemove);
    if (error) throw error;
  }

  const toAdd = unique.filter((id) => !current.has(id));
  if (!toAdd.length) return;
  const { data: ok, error } = await supabase.from("maintenance_assets").select("id").in("id", toAdd).eq("is_active", true);
  if (error) throw error;
  if ((ok ?? []).length !== toAdd.length) throw new Error("Only active assets can be mapped to a project.");
  const { error: insertError } = await supabase
    .from("project_assets")
    .insert(toAdd.map((asset_id) => ({ project_id: projectId, asset_id, added_by: addedBy })));
  if (insertError) throw insertError;
}

async function syncSupplierLinks(supabase: Awaited<ReturnType<typeof createClient>>, projectId: string, ids: string[], addedBy: string) {
  const unique = [...new Set(ids)];
  const { data: existing, error: loadError } = await supabase.from("project_suppliers").select("supplier_id").eq("project_id", projectId);
  if (loadError) throw loadError;
  const current = new Set((existing ?? []).map((r) => r.supplier_id));

  const toRemove = [...current].filter((id) => !unique.includes(id));
  if (toRemove.length) {
    const { error } = await supabase.from("project_suppliers").delete().eq("project_id", projectId).in("supplier_id", toRemove);
    if (error) throw error;
  }

  const toAdd = unique.filter((id) => !current.has(id));
  if (!toAdd.length) return;
  const { data: ok, error } = await supabase.from("suppliers").select("id").in("id", toAdd).eq("status", "active").is("deleted_at", null);
  if (error) throw error;
  if ((ok ?? []).length !== toAdd.length) throw new Error("Only active suppliers can be mapped to a project.");
  const { error: insertError } = await supabase
    .from("project_suppliers")
    .insert(toAdd.map((supplier_id) => ({ project_id: projectId, supplier_id, added_by: addedBy })));
  if (insertError) throw insertError;
}

/** Project managers may edit their own project even without project.edit. */
async function getEditAccess(projectId: string) {
  const user = await requireActionUser();
  if (user.can(PERMISSIONS.project.edit)) return { user, canEdit: true };
  const supabase = await createClient();
  const { data } = await supabase.from("projects").select("manager_id").eq("id", projectId).maybeSingle();
  const canEdit = Boolean(data && user.employee && data.manager_id === user.employee.id);
  return { user, canEdit };
}

async function assertCanEditProject(projectId: string) {
  const { user, canEdit } = await getEditAccess(projectId);
  if (!canEdit) throw new ForbiddenError();
  return user;
}

export async function createProjectAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(projectSchema, input, async (data) => {
    const user = await requirePermission(PERMISSIONS.project.create);
    const supabase = await createClient();
    const { data: row, error } = await supabase
      .from("projects")
      .insert({ ...toRow(data), created_by: user.id })
      .select("id")
      .single();
    if (error) throw error;
    await syncMilestones(supabase, row.id, namedMilestones(data.milestones), user.id);
    await syncAssetLinks(supabase, row.id, data.assetIds, user.id);
    await syncSupplierLinks(supabase, row.id, data.supplierIds, user.id);
    await logAction(supabase, "project.created", { type: "project", id: row.id }, { code: data.code });
    revalidatePath("/projects");
    return { id: row.id };
  });
}

export async function updateProjectAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(updateProjectSchema, input, async ({ id, ...data }) => {
    const user = await assertCanEditProject(id);
    const supabase = await createClient();
    const { error } = await supabase.from("projects").update(toRow(data)).eq("id", id);
    if (error) throw error;
    await syncMilestones(supabase, id, namedMilestones(data.milestones));
    await syncAssetLinks(supabase, id, data.assetIds, user.id);
    await syncSupplierLinks(supabase, id, data.supplierIds, user.id);
    await logAction(supabase, "project.updated", { type: "project", id });
    revalidatePath("/projects");
    revalidatePath(`/projects/${id}`);
    return { id };
  });
}

export async function deleteProjectAction(input: unknown): Promise<ActionResult> {
  return runAction(idSchema, input, async ({ id }) => {
    await requirePermission(PERMISSIONS.project.delete);
    const supabase = await createClient();
    const { error } = await supabase.from("projects").update({ deleted_at: new Date().toISOString() }).eq("id", id);
    if (error) throw error;
    await logAction(supabase, "project.deleted", { type: "project", id });
    revalidatePath("/projects");
    return undefined;
  });
}

export async function addProjectMemberAction(input: unknown): Promise<ActionResult> {
  return runAction(projectMemberSchema, input, async ({ projectId, employeeId, roleInProject }) => {
    const user = await assertCanEditProject(projectId);
    const supabase = await createClient();
    const { error } = await supabase.from("project_members").upsert({
      project_id: projectId,
      employee_id: employeeId,
      role_in_project: roleInProject ?? null,
      added_by: user.id,
    });
    if (error) throw error;
    await logAction(supabase, "project.member_added", { type: "project", id: projectId }, { employee_id: employeeId });
    revalidatePath(`/projects/${projectId}`);
    return undefined;
  });
}

export async function removeProjectMemberAction(input: unknown): Promise<ActionResult> {
  return runAction(removeProjectMemberSchema, input, async ({ projectId, employeeId }) => {
    await assertCanEditProject(projectId);
    const supabase = await createClient();
    const { error } = await supabase.from("project_members").delete().match({ project_id: projectId, employee_id: employeeId });
    if (error) throw error;
    await logAction(supabase, "project.member_removed", { type: "project", id: projectId }, { employee_id: employeeId });
    revalidatePath(`/projects/${projectId}`);
    return undefined;
  });
}

// ------------------------------------------------------------------- tasks
export async function createProjectTaskAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(projectTaskSchema, input, async (data) => {
    const user = await assertCanEditProject(data.projectId);
    const supabase = await createClient();

    const { data: milestone, error: milestoneError } = await supabase
      .from("project_milestones")
      .select("id")
      .eq("id", data.milestoneId)
      .eq("project_id", data.projectId)
      .maybeSingle();
    if (milestoneError) throw milestoneError;
    if (!milestone) throw new ForbiddenError("That milestone does not belong to this project.");

    const { data: last } = await supabase
      .from("project_tasks")
      .select("sort_order")
      .eq("milestone_id", data.milestoneId)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: row, error } = await supabase
      .from("project_tasks")
      .insert({
        project_id: data.projectId,
        milestone_id: data.milestoneId,
        title: data.title,
        description: data.description ?? null,
        assignee_id: data.assigneeId ?? null,
        due_date: data.dueDate ?? null,
        status: data.status,
        sort_order: (last?.sort_order ?? -1) + 1,
        created_by: user.id,
      })
      .select("id")
      .single();
    if (error) throw error;
    await logAction(supabase, "project.task_created", { type: "project", id: data.projectId }, {
      task_id: row.id,
      milestone_id: data.milestoneId,
      assignee_id: data.assigneeId ?? null,
    });
    revalidatePath(`/projects/${data.projectId}`);
    return { id: row.id };
  });
}

async function loadTask(supabase: Awaited<ReturnType<typeof createClient>>, id: string) {
  const { data, error } = await supabase.from("project_tasks").select("id, project_id, assignee_id").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) throw new ForbiddenError("Task not found or not accessible.");
  return data;
}

export async function updateProjectTaskAction(input: unknown): Promise<ActionResult> {
  return runAction(updateProjectTaskSchema, input, async ({ id, ...data }) => {
    const supabase = await createClient();
    const task = await loadTask(supabase, id);
    await assertCanEditProject(task.project_id);
    const { error } = await supabase
      .from("project_tasks")
      .update({
        title: data.title,
        description: data.description ?? null,
        assignee_id: data.assigneeId ?? null,
        due_date: data.dueDate ?? null,
        status: data.status,
      })
      .eq("id", id);
    if (error) throw error;
    await logAction(supabase, "project.task_updated", { type: "project", id: task.project_id }, { task_id: id });
    revalidatePath(`/projects/${task.project_id}`);
    return undefined;
  });
}

/** Project editors, or the employee tagged on the task, may change its status. */
export async function setProjectTaskStatusAction(input: unknown): Promise<ActionResult> {
  return runAction(setTaskStatusSchema, input, async ({ id, status }) => {
    const supabase = await createClient();
    const task = await loadTask(supabase, id);
    const { user, canEdit } = await getEditAccess(task.project_id);
    const isAssignee = Boolean(user.employee && task.assignee_id && task.assignee_id === user.employee.id);
    if (!canEdit && !isAssignee) throw new ForbiddenError();
    const { error } = await supabase.from("project_tasks").update({ status }).eq("id", id);
    if (error) throw error;
    await logAction(supabase, "project.task_status", { type: "project", id: task.project_id }, { task_id: id, status });
    revalidatePath(`/projects/${task.project_id}`);
    return undefined;
  });
}

export async function deleteProjectTaskAction(input: unknown): Promise<ActionResult> {
  return runAction(idSchema, input, async ({ id }) => {
    const supabase = await createClient();
    const task = await loadTask(supabase, id);
    await assertCanEditProject(task.project_id);
    const { error } = await supabase.from("project_tasks").delete().eq("id", id);
    if (error) throw error;
    await logAction(supabase, "project.task_deleted", { type: "project", id: task.project_id }, { task_id: id });
    revalidatePath(`/projects/${task.project_id}`);
    return undefined;
  });
}
