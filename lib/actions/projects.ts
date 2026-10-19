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
  removeProjectMemberSchema,
  updateProjectSchema,
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

/** Project managers may edit their own project even without project.edit. */
async function assertCanEditProject(projectId: string) {
  const user = await requireActionUser();
  if (user.can(PERMISSIONS.project.edit)) return user;
  const supabase = await createClient();
  const { data } = await supabase.from("projects").select("manager_id").eq("id", projectId).maybeSingle();
  if (!data || !user.employee || data.manager_id !== user.employee.id) throw new ForbiddenError();
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
    await logAction(supabase, "project.created", { type: "project", id: row.id }, { code: data.code });
    revalidatePath("/projects");
    return { id: row.id };
  });
}

export async function updateProjectAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(updateProjectSchema, input, async ({ id, ...data }) => {
    await assertCanEditProject(id);
    const supabase = await createClient();
    const { error } = await supabase.from("projects").update(toRow(data)).eq("id", id);
    if (error) throw error;
    await syncMilestones(supabase, id, namedMilestones(data.milestones));
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
