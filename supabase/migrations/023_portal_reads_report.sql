-- ============================================================================
-- The client can read its own month.
--
-- The Performance screen needs three tables the portal has never been able to
-- read: the posts that went live, their metrics, and the stored narrative.
-- 018 granted the portal `clients`, `meetings`, `contracts`, `content_drafts`
-- and `messages`; these three were simply never needed until now.
--
-- Following 018's shape: permissive SELECT policies keyed on
-- `owns_portal_client`, which OR with the existing staff grants. The restrictive
-- `tenant_isolation` floor (014) still applies, and 022's portal floors are
-- unaffected — none of these tables carries one, because a client reading its
-- own published posts and their numbers is the whole point.
--
-- Write access is deliberately not granted. The studio owns the record.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- published_posts · reached through the draft that produced them
-- ----------------------------------------------------------------------------
drop policy if exists "portal reads published posts" on public.published_posts;
create policy "portal reads published posts" on public.published_posts
  for select using (
    exists (
      select 1 from public.content_drafts d
      where d.id = published_posts.draft_id
        and public.owns_portal_client(d.client_id)
    )
  );

-- ----------------------------------------------------------------------------
-- post_metrics · one more hop, through the published post
-- ----------------------------------------------------------------------------
drop policy if exists "portal reads post metrics" on public.post_metrics;
create policy "portal reads post metrics" on public.post_metrics
  for select using (
    exists (
      select 1
      from public.published_posts p
      join public.content_drafts d on d.id = p.draft_id
      where p.id = post_metrics.published_post_id
        and public.owns_portal_client(d.client_id)
    )
  );

-- ----------------------------------------------------------------------------
-- monthly_reports · the narrative the studio already writes for them
-- ----------------------------------------------------------------------------
drop policy if exists "portal reads monthly reports" on public.monthly_reports;
create policy "portal reads monthly reports" on public.monthly_reports
  for select using (public.owns_portal_client(client_id));

-- Supports the joins above, which run per row under RLS.
create index if not exists published_posts_draft_idx
  on public.published_posts (draft_id);
