-- ═══════════════════════════════════════════════════════════════════════════
-- Nest · reel-videos storage bucket + RLS
--
--   Stores the final recorded video for a Reel draft. Public reads (Meta
--   Graph API needs a public URL for container creation, same rationale as
--   the creatives bucket). Writes / deletes are gated by has_client_access
--   via the draft's client.
--
--   Path convention: <draft_id>/<draft_id>-v<timestamp>.<ext>
-- ═══════════════════════════════════════════════════════════════════════════

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'reel-videos',
  'reel-videos',
  true,
  524288000, -- 500 MB
  array['video/mp4', 'video/quicktime', 'video/webm']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "reel-videos: public read" on storage.objects;
create policy "reel-videos: public read"
  on storage.objects for select
  using (bucket_id = 'reel-videos');

drop policy if exists "reel-videos: gated write" on storage.objects;
create policy "reel-videos: gated write"
  on storage.objects for insert
  with check (
    bucket_id = 'reel-videos'
    and exists (
      select 1
      from public.content_drafts d
      where d.id::text = split_part(storage.objects.name, '/', 1)
        and public.has_client_access(d.client_id)
    )
  );

drop policy if exists "reel-videos: gated delete" on storage.objects;
create policy "reel-videos: gated delete"
  on storage.objects for delete
  using (
    bucket_id = 'reel-videos'
    and exists (
      select 1
      from public.content_drafts d
      where d.id::text = split_part(storage.objects.name, '/', 1)
        and public.has_client_access(d.client_id)
    )
  );
