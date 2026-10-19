"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { logAction } from "@/lib/audit-log";
import { ForbiddenError, requirePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { DOCUMENTS_BUCKET, buildStoragePath, folderPrefix } from "@/lib/documents/storage";
import { deleteDocumentSchema, finalizeUploadSchema, requestUploadSchema } from "@/lib/validation/documents";
import { runAction, type ActionResult } from "./result";

/** A milestone folder is only valid for project documents, and the milestone must belong to that project. */
async function assertMilestoneBelongs(
  supabase: Awaited<ReturnType<typeof createClient>>,
  module: string,
  entityId: string,
  milestoneId: string | null | undefined,
) {
  if (!milestoneId) return;
  if (module !== "project") throw new ForbiddenError("Milestone folders only exist for projects.");
  const { data, error } = await supabase
    .from("project_milestones")
    .select("id")
    .eq("id", milestoneId)
    .eq("project_id", entityId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new ForbiddenError("That milestone does not belong to this project.");
}

/**
 * Step 1 of an upload. Verifies the caller may attach files to this entity
 * (permission + entity visibility through RLS), then issues a signed upload
 * URL scoped to exactly one object path. The browser PUTs the bytes straight
 * to Storage; they never pass through the Next.js server.
 */
export async function requestUploadAction(
  input: unknown,
): Promise<ActionResult<{ storagePath: string; token: string; signedUrl: string }>> {
  return runAction(requestUploadSchema, input, async (data) => {
    await requirePermission(PERMISSIONS.documents.upload);
    const supabase = await createClient();

    const { data: allowed, error: accessError } = await supabase.rpc("can_access_entity", {
      p_module: data.module,
      p_entity_id: data.entityId,
    });
    if (accessError) throw accessError;
    if (!allowed) throw new ForbiddenError("You cannot upload documents to this record.");

    await assertMilestoneBelongs(supabase, data.module, data.entityId, data.milestoneId);

    const storagePath = buildStoragePath(data.module, data.entityId, `${randomUUID()}-${data.fileName}`, data.milestoneId);

    // Signed with the caller's session → storage RLS insert policy still applies.
    const { data: signed, error } = await supabase.storage.from(DOCUMENTS_BUCKET).createSignedUploadUrl(storagePath);
    if (error) throw new Error(error.message);

    return { storagePath, token: signed.token, signedUrl: signed.signedUrl };
  });
}

/**
 * Step 2. Records document metadata after the bytes are in Storage. The path
 * must belong to the declared module/entity (also enforced by a DB check).
 */
export async function finalizeUploadAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(finalizeUploadSchema, input, async (data) => {
    const user = await requirePermission(PERMISSIONS.documents.upload);
    const supabase = await createClient();

    await assertMilestoneBelongs(supabase, data.module, data.entityId, data.milestoneId);

    const expectedPrefix = folderPrefix(data.module, data.entityId, data.milestoneId);
    if (!data.storagePath.startsWith(expectedPrefix)) throw new ForbiddenError("Storage path does not match the record.");

    // Confirm the object really exists (prevents metadata for phantom files).
    const { data: listed, error: listError } = await supabase.storage
      .from(DOCUMENTS_BUCKET)
      .list(expectedPrefix.slice(0, -1), { search: data.storagePath.slice(expectedPrefix.length), limit: 1 });
    if (listError) throw new Error(listError.message);
    if (!listed?.length) throw new Error("Uploaded file was not found in storage. Please try again.");

    const { data: row, error } = await supabase
      .from("documents")
      .insert({
        file_name: data.fileName,
        storage_path: data.storagePath,
        bucket: DOCUMENTS_BUCKET,
        file_size: data.fileSize,
        mime_type: data.mimeType,
        module: data.module,
        entity_type: data.module,
        entity_id: data.entityId,
        milestone_id: data.milestoneId ?? null,
        description: data.description ?? null,
        uploaded_by: user.id,
      })
      .select("id")
      .single();
    if (error) {
      // Roll back the orphaned object so storage stays consistent.
      await supabase.storage.from(DOCUMENTS_BUCKET).remove([data.storagePath]);
      throw error;
    }

    await logAction(supabase, "document.uploaded", { type: "document", id: row.id }, {
      module: data.module,
      entity_id: data.entityId,
      milestone_id: data.milestoneId ?? null,
      file_name: data.fileName,
      size: data.fileSize,
    });
    revalidatePath("/documents");
    return { id: row.id };
  });
}

export async function deleteDocumentAction(input: unknown): Promise<ActionResult> {
  return runAction(deleteDocumentSchema, input, async ({ id }) => {
    await requirePermission(PERMISSIONS.documents.delete);
    const supabase = await createClient();

    const { data: doc, error: fetchError } = await supabase
      .from("documents")
      .select("id, storage_path, module, entity_id, file_name")
      .eq("id", id)
      .maybeSingle();
    if (fetchError) throw fetchError;
    if (!doc) throw new ForbiddenError("Document not found or not accessible.");

    const { error: rmError } = await supabase.storage.from(DOCUMENTS_BUCKET).remove([doc.storage_path]);
    if (rmError) throw new Error(rmError.message);

    const { error } = await supabase.from("documents").delete().eq("id", id);
    if (error) throw error;

    await logAction(supabase, "document.deleted", { type: "document", id }, {
      module: doc.module,
      entity_id: doc.entity_id,
      file_name: doc.file_name,
    });
    revalidatePath("/documents");
    return undefined;
  });
}
