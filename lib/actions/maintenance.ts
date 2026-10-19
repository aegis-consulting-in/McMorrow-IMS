"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { logAction } from "@/lib/audit-log";
import { ForbiddenError, requireActionUser, requirePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { idSchema } from "@/lib/validation/common";
import {
  assetSchema,
  maintenanceRecordSchema,
  updateAssetSchema,
  updateMaintenanceRecordSchema,
  type AssetInput,
  type MaintenanceRecordInput,
} from "@/lib/validation/maintenance";
import { runAction, type ActionResult } from "./result";

function assetToRow(input: AssetInput) {
  return {
    asset_code: input.assetCode,
    name: input.name,
    description: input.description ?? null,
    serial_number: input.serialNumber ?? null,
    manufacturer: input.manufacturer ?? null,
    location: input.location ?? null,
    department_id: input.departmentId ?? null,
    site_id: input.siteId ?? null,
    purchase_date: input.purchaseDate ?? null,
    is_active: input.isActive,
  };
}

function recordToRow(input: MaintenanceRecordInput) {
  return {
    asset_id: input.assetId,
    title: input.title,
    description: input.description ?? null,
    maintenance_type: input.maintenanceType,
    source: input.source,
    frequency: input.frequency ?? null,
    scheduled_date: input.scheduledDate ?? null,
    due_date: input.dueDate ?? null,
    completed_date: input.completedDate ?? null,
    status: input.status,
    assigned_to: input.assignedTo ?? null,
    notes: input.notes ?? null,
  };
}

export async function createAssetAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(assetSchema, input, async (data) => {
    const user = await requirePermission(PERMISSIONS.maintenance.create);
    const supabase = await createClient();
    const { data: row, error } = await supabase
      .from("maintenance_assets")
      .insert({ ...assetToRow(data), created_by: user.id })
      .select("id")
      .single();
    if (error) throw error;
    await logAction(supabase, "maintenance.asset_created", { type: "maintenance_asset", id: row.id }, { code: data.assetCode });
    revalidatePath("/maintenance");
    return { id: row.id };
  });
}

export async function updateAssetAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(updateAssetSchema, input, async ({ id, ...data }) => {
    await requirePermission(PERMISSIONS.maintenance.edit);
    const supabase = await createClient();
    const { error } = await supabase.from("maintenance_assets").update(assetToRow(data)).eq("id", id);
    if (error) throw error;
    await logAction(supabase, "maintenance.asset_updated", { type: "maintenance_asset", id });
    revalidatePath("/maintenance");
    return { id };
  });
}

export async function deleteAssetAction(input: unknown): Promise<ActionResult> {
  return runAction(idSchema, input, async ({ id }) => {
    await requirePermission(PERMISSIONS.maintenance.delete);
    const supabase = await createClient();
    const { error } = await supabase.from("maintenance_assets").delete().eq("id", id);
    if (error) throw error;
    await logAction(supabase, "maintenance.asset_deleted", { type: "maintenance_asset", id });
    revalidatePath("/maintenance");
    return undefined;
  });
}

export async function createMaintenanceRecordAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(maintenanceRecordSchema, input, async (data) => {
    const user = await requirePermission(PERMISSIONS.maintenance.create);
    const supabase = await createClient();
    const { data: row, error } = await supabase
      .from("maintenance_records")
      .insert({ ...recordToRow(data), created_by: user.id })
      .select("id")
      .single();
    if (error) throw error;
    await logAction(supabase, "maintenance.record_created", { type: "maintenance_record", id: row.id }, { title: data.title });
    revalidatePath("/maintenance");
    return { id: row.id };
  });
}

/** Editors, or the technician the record is assigned to, may update it. */
export async function updateMaintenanceRecordAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(updateMaintenanceRecordSchema, input, async ({ id, ...data }) => {
    const user = await requireActionUser();
    const supabase = await createClient();
    if (!user.can(PERMISSIONS.maintenance.edit)) {
      const { data: rec } = await supabase.from("maintenance_records").select("assigned_to").eq("id", id).maybeSingle();
      if (!rec || !user.employee || rec.assigned_to !== user.employee.id) throw new ForbiddenError();
    }
    const { error } = await supabase.from("maintenance_records").update(recordToRow(data)).eq("id", id);
    if (error) throw error;
    await logAction(supabase, "maintenance.record_updated", { type: "maintenance_record", id }, { status: data.status });
    revalidatePath("/maintenance");
    revalidatePath(`/maintenance/${id}`);
    return { id };
  });
}

export async function deleteMaintenanceRecordAction(input: unknown): Promise<ActionResult> {
  return runAction(idSchema, input, async ({ id }) => {
    await requirePermission(PERMISSIONS.maintenance.delete);
    const supabase = await createClient();
    const { error } = await supabase.from("maintenance_records").update({ deleted_at: new Date().toISOString() }).eq("id", id);
    if (error) throw error;
    await logAction(supabase, "maintenance.record_deleted", { type: "maintenance_record", id });
    revalidatePath("/maintenance");
    return undefined;
  });
}
