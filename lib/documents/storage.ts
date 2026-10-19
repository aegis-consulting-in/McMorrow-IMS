import type { DocumentModule } from "@/lib/types/database";

export const DOCUMENTS_BUCKET = "documents";

/**
 * Storage key convention: {module}/{entity_id}/{unique}-{file_name}.
 * Project milestone files get a subfolder: project/{id}/milestones/{milestone_id}/{unique}-{file_name}.
 */
export function buildStoragePath(module: DocumentModule, entityId: string, objectName: string, milestoneId?: string | null) {
  return `${folderPrefix(module, entityId, milestoneId)}${objectName}`;
}

/** Folder prefix (with trailing slash) objects must live under. */
export function folderPrefix(module: DocumentModule, entityId: string, milestoneId?: string | null) {
  return milestoneId ? `${module}/${entityId}/milestones/${milestoneId}/` : `${module}/${entityId}/`;
}

export const MODULE_LABELS: Record<DocumentModule, string> = {
  training: "HR",
  project: "Project",
  supplier: "Supplier",
  "preventive-maintenance": "Preventive Maintenance",
  audit: "Audit",
  employee: "Employee",
};

/** Where a module folder's entity should link to in the app. */
export function entityHref(module: DocumentModule, entityId: string): string {
  switch (module) {
    case "training":
      return `/training/${entityId}`;
    case "project":
      return `/projects/${entityId}`;
    case "supplier":
      return `/suppliers/${entityId}`;
    case "preventive-maintenance":
      return `/maintenance/${entityId}`;
    case "audit":
      return `/audits/${entityId}`;
    case "employee":
      return `/employees/${entityId}`;
  }
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function fileKind(mime: string): "pdf" | "image" | "sheet" | "doc" | "slides" | "text" | "other" {
  if (mime === "application/pdf") return "pdf";
  if (mime.startsWith("image/")) return "image";
  if (mime.includes("spreadsheet") || mime.includes("excel") || mime === "text/csv") return "sheet";
  if (mime.includes("word") || mime === "application/msword") return "doc";
  if (mime.includes("presentation") || mime.includes("powerpoint")) return "slides";
  if (mime.startsWith("text/")) return "text";
  return "other";
}
