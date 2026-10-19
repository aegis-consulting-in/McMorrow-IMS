import { z } from "zod";
import { checkbox, optionalDate, optionalText, optionalUuid, requiredText, uuid } from "./common";

export const MAINTENANCE_STATUSES = ["scheduled", "due", "in_progress", "completed", "overdue", "cancelled"] as const;
export const MAINTENANCE_TYPES = ["preventive", "corrective", "calibration", "inspection"] as const;
export const MAINTENANCE_SOURCES = ["internal", "external"] as const;
export const MAINTENANCE_FREQUENCIES = ["daily", "weekly", "monthly", "quarterly", "half-yearly", "yearly", "one-off"] as const;

export const assetSchema = z.object({
  assetCode: requiredText("Asset code", 30),
  name: requiredText("Asset name", 200),
  description: optionalText(2000),
  serialNumber: optionalText(80),
  manufacturer: optionalText(120),
  location: optionalText(120),
  departmentId: optionalUuid,
  siteId: optionalUuid,
  purchaseDate: optionalDate,
  isActive: checkbox.default(true),
});
export type AssetInput = z.infer<typeof assetSchema>;
export const updateAssetSchema = assetSchema.extend({ id: uuid });

export const maintenanceRecordSchema = z
  .object({
    assetId: uuid,
    title: requiredText("Title", 200),
    description: optionalText(5000),
    maintenanceType: z.enum(MAINTENANCE_TYPES).default("preventive"),
    source: z.enum(MAINTENANCE_SOURCES).default("internal"),
    frequency: optionalText(30),
    scheduledDate: optionalDate,
    dueDate: optionalDate,
    completedDate: optionalDate,
    status: z.enum(MAINTENANCE_STATUSES).default("scheduled"),
    assignedTo: optionalUuid,
    notes: optionalText(5000),
  })
  .refine((d) => !d.scheduledDate || !d.dueDate || d.dueDate >= d.scheduledDate, {
    message: "Due date cannot be before the scheduled date.",
    path: ["dueDate"],
  });
export type MaintenanceRecordInput = z.infer<typeof maintenanceRecordSchema>;
export const updateMaintenanceRecordSchema = z.object({ id: uuid }).and(maintenanceRecordSchema);
