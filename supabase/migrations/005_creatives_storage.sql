-- ═══════════════════════════════════════════════════════════════════════════
-- Nest · creatives storage bucket + RLS
--
--   Stores PNG renders of carousel slides. Public reads (Instagram's Graph
--   API needs publicly-reachable URLs for container creation). Writes and
--   deletes are gated by has_client_access() via the slide's draft's client.
--
--   Path convention: <draft_id>/<slide_id>-v<version>.png
-- ═══════════════════════════════════════════════════════════════════════════

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'creatives',
  'creatives',
  true,
  10485760,  -- 10 MB
  array['image/png']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "creatives: public read" on storage.objects;
create policy "creatives: public read"
  on storage.objects for select
  using (bucket_id = 'creatives');

drop policy if exists "creatives: gated write" on storage.objects;
create policy "creatives: gated write"
  on storage.objects for insert
  with check (
    bucket_id = 'creatives'
    and exists (
      select 1
      from public.content_drafts d
      where d.id::text = split_part(storage.objects.name, '/', 1)
        and public.has_client_access(d.client_id)
    )
  );

drop policy if exists "creatives: gated delete" on storage.objects;
create policy "creatives: gated delete"
  on storage.objects for delete
  using (
    bucket_id = 'creatives'
    and exists (
      select 1
      from public.content_drafts d
      where d.id::text = split_part(storage.objects.name, '/', 1)
        and public.has_client_access(d.client_id)
    )
  );
