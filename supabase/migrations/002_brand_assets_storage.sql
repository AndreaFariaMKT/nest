-- ═══════════════════════════════════════════════════════════════════════════
-- Nest · brand-assets storage bucket + RLS
--
--   Public bucket for brand kit assets (logos, photos, illustrations, svgs).
--   Public read (Instagram + previews need publicly-accessible URLs).
--   Writes/deletes gated by has_client_access() through the brand_kit path.
--
--   Path convention: <brand_kit_id>/<timestamp>-<safe-name>.<ext>
-- ═══════════════════════════════════════════════════════════════════════════

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'brand-assets',
  'brand-assets',
  true,
  5242880,  -- 5 MB
  array[
    'image/png',
    'image/jpeg',
    'image/gif',
    'image/webp',
    'image/svg+xml'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Policies on storage.objects --------------------------------------------------

-- Anyone (even anon) can read — needed for Instagram container + client portal.
drop policy if exists "brand-assets: public read" on storage.objects;
create policy "brand-assets: public read"
  on storage.objects for select
  using (bucket_id = 'brand-assets');

-- Insert/delete require the caller to have client-level access via the brand_kit
-- whose id is encoded in the first path segment.
drop policy if exists "brand-assets: gated write" on storage.objects;
create policy "brand-assets: gated write"
  on storage.objects for insert
  with check (
    bucket_id = 'brand-assets'
    and exists (
      select 1
      from public.brand_kits k
      where k.id::text = split_part(name, '/', 1)
        and public.has_client_access(k.client_id)
    )
  );

drop policy if exists "brand-assets: gated delete" on storage.objects;
create policy "brand-assets: gated delete"
  on storage.objects for delete
  using (
    bucket_id = 'brand-assets'
    and exists (
      select 1
      from public.brand_kits k
      where k.id::text = split_part(name, '/', 1)
        and public.has_client_access(k.client_id)
    )
  );
