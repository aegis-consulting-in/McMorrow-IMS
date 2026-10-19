import { toast } from "sonner";
import { finalizeUploadAction, requestUploadAction } from "@/lib/actions/documents";
import type { DocumentModule } from "@/lib/types/database";
import { ALLOWED_EXTENSIONS, ALLOWED_MIME_TYPES, MAX_FILE_SIZE_BYTES } from "@/lib/validation/documents";
import { formatBytes } from "./storage";

const MIME_BY_EXT: Record<string, (typeof ALLOWED_MIME_TYPES)[number]> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  txt: "text/plain",
  csv: "text/csv",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
};

export function validateFile(file: File): string | null {
  if (file.size === 0) return "File is empty.";
  if (file.size > MAX_FILE_SIZE_BYTES) return `Exceeds the ${formatBytes(MAX_FILE_SIZE_BYTES)} limit.`;
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!(ALLOWED_EXTENSIONS as readonly string[]).includes(ext)) return `.${ext || "?"} files are not allowed.`;
  const mime = resolveMime(file);
  if (!(ALLOWED_MIME_TYPES as readonly string[]).includes(mime)) return "This file type is not allowed.";
  return null;
}

/** Browser may report an empty MIME for some extensions; fall back by extension. */
export function resolveMime(file: File): (typeof ALLOWED_MIME_TYPES)[number] | "application/octet-stream" {
  if ((ALLOWED_MIME_TYPES as readonly string[]).includes(file.type)) {
    return file.type as (typeof ALLOWED_MIME_TYPES)[number];
  }
  const ext = file.name.split(".").pop()?.toLowerCase();
  return (ext && MIME_BY_EXT[ext]) || "application/octet-stream";
}

export async function uploadFileToEntity(
  module: DocumentModule,
  entityId: string,
  file: File,
  onProgress?: (pct: number) => void,
  /** Project documents only: upload into this milestone's subfolder. */
  milestoneId?: string | null,
): Promise<string | null> {
  const invalid = validateFile(file);
  if (invalid) return invalid;
  const mimeType = resolveMime(file);
  if (mimeType === "application/octet-stream") return "This file type is not allowed.";

  const req = await requestUploadAction({
    module,
    entityId,
    milestoneId: milestoneId ?? undefined,
    fileName: file.name,
    mimeType,
    fileSize: file.size,
  });
  if (!req.ok) return req.fieldErrors ? (Object.values(req.fieldErrors).flat()[0] ?? req.error) : req.error;

  const ok = await new Promise<boolean>((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", req.data.signedUrl, true);
    xhr.setRequestHeader("Content-Type", mimeType);
    xhr.setRequestHeader("x-upsert", "false");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(Math.max(5, Math.round((e.loaded / e.total) * 90)));
    };
    xhr.onload = () => resolve(xhr.status >= 200 && xhr.status < 300);
    xhr.onerror = () => resolve(false);
    xhr.send(file);
  });
  if (!ok) return "Upload to storage failed. Please retry.";

  const fin = await finalizeUploadAction({
    module,
    entityId,
    milestoneId: milestoneId ?? undefined,
    storagePath: req.data.storagePath,
    fileName: file.name,
    mimeType,
    fileSize: file.size,
  });
  if (!fin.ok) return fin.error;
  onProgress?.(100);
  return null;
}

export async function uploadFilesToEntity(module: DocumentModule, entityId: string, files: File[]): Promise<{ ok: number; failed: number }> {
  let ok = 0;
  let failed = 0;
  for (const file of files) {
    const error = await uploadFileToEntity(module, entityId, file);
    if (error) {
      failed += 1;
      toast.error(`${file.name}: ${error}`);
    } else {
      ok += 1;
    }
  }
  return { ok, failed };
}
