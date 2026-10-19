-- =============================================================================
-- McMorrow IMS — Preventive maintenance Internal / External source
-- Migration 5
-- =============================================================================

do $$ begin
  create type public.maintenance_source as enum ('internal', 'external');
exception
  when duplicate_object then null;
end $$;

alter table public.maintenance_records
  add column if not exists source public.maintenance_source not null default 'internal';

create index if not exists maintenance_records_source_idx on public.maintenance_records (source);

grant usage on type public.maintenance_source to authenticated, service_role;
