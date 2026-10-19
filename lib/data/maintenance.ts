import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { PaginationInput } from "@/lib/validation/common";

export const ASSET_SELECT = `*, department:departments(id, name), site:sites(id, name)` as const;
export const RECORD_SELECT = `
  *,
  asset:maintenance_assets(id, asset_code, name, location),
  assignee:employees!assigned_to(id, first_name, last_name)
` as const;

export async function listAssets(filters: PaginationInput & { departmentId?: string; siteId?: string; status?: "active" | "inactive" | "all" }) {
  const supabase = await createClient();
  const from = (filters.page - 1) * filters.pageSize;
  const to = from + filters.pageSize - 1;

  let q = supabase.from("maintenance_assets").select(ASSET_SELECT, { count: "exact" });
  if (filters.q) {
    const term = `%${filters.q.replace(/[%_]/g, "")}%`;
    q = q.or(`name.ilike.${term},asset_code.ilike.${term},serial_number.ilike.${term},location.ilike.${term}`);
  }
  if (filters.departmentId) q = q.eq("department_id", filters.departmentId);
  if (filters.siteId) q = q.eq("site_id", filters.siteId);
  if (filters.status === "inactive") q = q.eq("is_active", false);
  else if (filters.status !== "all") q = q.eq("is_active", true);

  const sortCol = ({ name: "name", code: "asset_code", location: "location" } as Record<string, string>)[filters.sort ?? "name"] ?? "name";
  q = q.order(sortCol, { ascending: filters.dir !== "desc" }).range(from, to);

  const { data, error, count } = await q;
  if (error) throw error;
  return { rows: data, total: count ?? 0 };
}

export async function getAsset(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("maintenance_assets").select(ASSET_SELECT).eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function listMaintenanceRecords(
  filters: PaginationInput & { assetId?: string; status?: string; type?: string; source?: string },
) {
  const supabase = await createClient();
  const from = (filters.page - 1) * filters.pageSize;
  const to = from + filters.pageSize - 1;

  let q = supabase.from("maintenance_records").select(RECORD_SELECT, { count: "exact" }).is("deleted_at", null);
  if (filters.q) {
    const term = `%${filters.q.replace(/[%_]/g, "")}%`;
    q = q.or(`title.ilike.${term},description.ilike.${term}`);
  }
  if (filters.assetId) q = q.eq("asset_id", filters.assetId);
  if (filters.status) q = q.eq("status", filters.status as never);
  if (filters.type) q = q.eq("maintenance_type", filters.type as never);
  if (filters.source) q = q.eq("source", filters.source as never);

  const sortCol = ({ due: "due_date", title: "title", status: "status", scheduled: "scheduled_date" } as Record<string, string>)[
    filters.sort ?? "due"
  ] ?? "due_date";
  q = q.order(sortCol, { ascending: filters.dir !== "desc", nullsFirst: false }).range(from, to);

  const { data, error, count } = await q;
  if (error) throw error;
  return { rows: data, total: count ?? 0 };
}

export async function getMaintenanceRecord(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("maintenance_records")
    .select(RECORD_SELECT)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getAssetOptions() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("maintenance_assets")
    .select("id, asset_code, name")
    .eq("is_active", true)
    .order("name");
  if (error) throw error;
  return data;
}

export async function getMaintenanceStats() {
  const supabase = await createClient();
  const [assets, open, overdue, completed] = await Promise.all([
    supabase.from("maintenance_assets").select("id", { count: "exact", head: true }).eq("is_active", true),
    supabase
      .from("maintenance_records")
      .select("id", { count: "exact", head: true })
      .is("deleted_at", null)
      .in("status", ["scheduled", "due", "in_progress"]),
    supabase.from("maintenance_records").select("id", { count: "exact", head: true }).is("deleted_at", null).eq("status", "overdue"),
    supabase.from("maintenance_records").select("id", { count: "exact", head: true }).is("deleted_at", null).eq("status", "completed"),
  ]);
  return { assets: assets.count ?? 0, open: open.count ?? 0, overdue: overdue.count ?? 0, completed: completed.count ?? 0 };
}
