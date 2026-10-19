import { z } from "zod";
import { optionalText, uuid } from "./common";

export const DOCUMENT_MODULES = ["training", "project", "supplier", "preventive-maintenance", "audit", "employee"] as const;
export type DocumentModuleKey = (typeof DOCUMENT_MODULES)[number];

export const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;

export const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/csv",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
] as const;

export const ALLOWED_EXTENSIONS = [
  "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "csv", "png", "jpg", "jpeg", "webp", "gif",
] as const;

const safeFileName = z
  .string()
  .trim()
  .min(1, "File name is required.")
  .max(180, "File name is too long.")
  .refine((n) => !n.includes("/") && !n.includes("\\") && !n.includes(".."), "Invalid file name.");

/** Step 1: ask the server for a signed upload URL. */
export const requestUploadSchema = z.object({
  module: z.enum(DOCUMENT_MODULES),
  entityId: uuid,
  /** Project documents only: upload into this milestone's subfolder. */
  milestoneId: uuid.nullish(),
  fileName: safeFileName,
  mimeType: z.enum(ALLOWED_MIME_TYPES, { message: "This file type is not allowed." }),
  fileSize: z
    .number()
    .int()
    .positive("File is empty.")
    .max(MAX_FILE_SIZE_BYTES, "File exceeds the 25 MB limit."),
});
export type RequestUploadInput = z.infer<typeof requestUploadSchema>;

/** Step 2: after the browser uploaded to Storage, record metadata. */
export const finalizeUploadSchema = z.object({
  module: z.enum(DOCUMENT_MODULES),
  entityId: uuid,
  milestoneId: uuid.nullish(),
  storagePath: z.string().min(1).max(500),
  fileName: safeFileName,
  mimeType: z.enum(ALLOWED_MIME_TYPES),
  fileSize: z.number().int().positive().max(MAX_FILE_SIZE_BYTES),
  description: optionalText(500),
});
export type FinalizeUploadInput = z.infer<typeof finalizeUploadSchema>;

export const deleteDocumentSchema = z.object({ id: uuid });
