import "server-only";

import { createClient } from "@/lib/supabase/server";
import { many } from "@/lib/data/helpers";
import type { PaginationInput } from "@/lib/validation/common";

export const PROJECT_LIST_SELECT = `
  *,
  manager:employees!manager_id(id, first_name, last_name, email),
  site:sites!site_id(id, name, code)
` as const;

export const PROJECT_SELECT = `
  ${PROJECT_LIST_SELECT},
  milestones:project_milestones(id, name, start_date, end_date, status, sort_order)
` as const;

export type ProjectListFilters = PaginationInput & { status?: string; priority?: string };

export async function listProjects(filters: ProjectListFilters) {
  const supabase = await createClient();
  const from = (filters.page - 1) * filters.pageSize;
  const to = from + filters.pageSize - 1;

  let q = supabase.from("projects").select(PROJECT_LIST_SELECT, { count: "exact" }).is("deleted_at", null);
  if (filters.q) {
    const term = `%${filters.q.replace(/[%_]/g, "")}%`;
    q = q.or(`name.ilike.${term},code.ilike.${term},description.ilike.${term}`);
  }
  if (filters.status) q = q.eq("status", filters.status as never);
  if (filters.priority) q = q.eq("priority", filters.priority as never);

  const sortCol = ({ name: "name", code: "code", start: "start_date", status: "status", priority: "priority" } as Record<string, string>)[
    filters.sort ?? "name"
  ] ?? "name";
  q = q.order(sortCol, { ascending: filters.dir !== "desc" }).range(from, to);

  const { data, error, count } = await q;
  if (error) throw error;
  return { rows: data, total: count ?? 0 };
}

/** Timeline view: same filters, milestones included, no pagination (capped). */
export async function listGanttProjects(filters: Omit<ProjectListFilters, "page" | "pageSize">) {
  const supabase = await createClient();
  let q = supabase.from("projects").select(PROJECT_SELECT).is("deleted_at", null);
  if (filters.q) {
    const term = `%${filters.q.replace(/[%_]/g, "")}%`;
    q = q.or(`name.ilike.${term},code.ilike.${term},description.ilike.${term}`);
  }
  if (filters.status) q = q.eq("status", filters.status as never);
  if (filters.priority) q = q.eq("priority", filters.priority as never);

  const sortCol = ({ name: "name", code: "code", start: "start_date", status: "status", priority: "priority" } as Record<string, string>)[
    filters.sort ?? "start"
  ] ?? "start_date";
  q = q.order(sortCol, { ascending: filters.dir !== "desc", nullsFirst: false }).limit(80);

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map((row) => ({
    ...row,
    milestones: many(row.milestones).sort((a, b) => a.sort_order - b.sort_order),
  }));
}

export async function getProject(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .select(PROJECT_SELECT)
    .eq("id", id)
    .is("deleted_at", null)
    .order("sort_order", { referencedTable: "project_milestones", ascending: true })
    .maybeSingle();
  if (error) throw error;
  if (!data) return data;
  const milestones = many(data.milestones).sort((a, b) => a.sort_order - b.sort_order);
  return { ...data, milestones };
}

export async function getProjectMembers(projectId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("project_members")
    .select(`*, employee:employees(id, employee_code, first_name, last_name, email, job_title:job_titles(name))`)
    .eq("project_id", projectId)
    .order("added_at");
  if (error) throw error;
  return data;
}

export async function getProjectStats() {
  const supabase = await createClient();
  const [total, active, completed] = await Promise.all([
    supabase.from("projects").select("id", { count: "exact", head: true }).is("deleted_at", null),
    supabase.from("projects").select("id", { count: "exact", head: true }).is("deleted_at", null).eq("status", "active"),
    supabase.from("projects").select("id", { count: "exact", head: true }).is("deleted_at", null).eq("status", "completed"),
  ]);
  return { total: total.count ?? 0, active: active.count ?? 0, completed: completed.count ?? 0 };
}
