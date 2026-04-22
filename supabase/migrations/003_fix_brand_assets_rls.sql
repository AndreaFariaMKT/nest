-- ═══════════════════════════════════════════════════════════════════════════
-- Nest · fix storage RLS policies for brand-assets
--
--   Bug in migration 002: the `split_part(name, '/', 1)` inside the EXISTS
--   subquery resolved to `brand_kits.name` (since we aliased brand_kits as k
--   and brand_kits has a `name` column) instead of `storage.objects.name`.
--   Result: insert/delete policies never matched — all uploads returned 403.
--
--   Fix: qualify the outer table reference via storage.objects.name.
-- ═══════════════════════════════════════════════════════════════════════════

drop policy if exists "brand-assets: gated write" on storage.objects;
create policy "brand-assets: gated write"
  on storage.objects for insert
  with check (
    bucket_id = 'brand-assets'
    and exists (
      select 1
      from public.brand_kits k
      where k.id::text = split_part(storage.objects.name, '/', 1)
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
      where k.id::text = split_part(storage.objects.name, '/', 1)
        and public.has_client_access(k.client_id)
    )
  );
