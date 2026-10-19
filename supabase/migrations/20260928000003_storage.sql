-- =============================================================================
-- McMorrow IMS — Storage bucket and object policies
-- Migration 3 of 3
--
-- One PRIVATE bucket ("documents"). Objects are keyed as
--   {module}/{entity_id}/{uuid}-{file_name}
-- and every policy derives authorization from that path through
-- public.can_access_document_path(), the same function the documents table uses.
-- Nothing in this bucket is ever served without a signed URL.
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documents',
  'documents',
  false,
  26214400, -- 25 MB
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'text/csv',
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/gif'
  ]
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Reading (needed to create signed download URLs on behalf of the caller).
create policy "documents bucket: read authorized entity files"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'documents'
    and public.has_permission('documents.view')
    and public.can_access_document_path(name)
  );

-- Uploading. The caller must hold documents.upload AND be allowed to see the
-- entity encoded in the path, so a user cannot smuggle a file into another
-- module's folder by editing the object key.
create policy "documents bucket: upload to authorized entity folder"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'documents'
    and public.has_permission('documents.upload')
    and public.can_access_document_path(name)
    and owner = auth.uid()
  );

-- Upserts / metadata updates by the same rule as uploads.
create policy "documents bucket: update own authorized files"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'documents'
    and public.has_permission('documents.upload')
    and public.can_access_document_path(name)
  )
  with check (
    bucket_id = 'documents'
    and public.has_permission('documents.upload')
    and public.can_access_document_path(name)
  );

create policy "documents bucket: delete authorized files"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'documents'
    and public.has_permission('documents.delete')
    and public.can_access_document_path(name)
  );
