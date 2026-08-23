-- ═══════════════════════════════════════════════════════════════════════════
-- 028 — metrics-collect must rotate, not re-pick the same newest posts
--
-- The cron selected `published_posts` ordered by `published_at DESC` limited to
-- 50, inside a 90-day window. At four posts a week a SINGLE client already has
-- ~52 posts in that window, so from the second client onward — in practice,
-- from now — every post past the newest 50 stopped accumulating metrics
-- permanently, because each run re-picked the same newest 50.
--
-- The report then measured a sample that shrinks as the studio publishes more.
--
-- Ordering by "least recently captured" instead makes coverage rotate: every
-- post is reached within ceil(total / batch) days, and a post that has never
-- been captured sorts first. Same batch size, same API budget, no post starved.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.stale_metrics_posts(
  platform_name text,
  lookback_ts timestamptz,
  batch integer
)
returns table (
  id uuid,
  platform text,
  external_id text,
  published_at timestamptz,
  last_captured_at timestamptz
)
language sql
stable
security invoker
set search_path = public
as $$
  select pp.id,
         pp.platform::text,
         pp.external_id,
         pp.published_at,
         m.last_captured_at
    from public.published_posts pp
    left join lateral (
      select max(pm.captured_at) as last_captured_at
        from public.post_metrics pm
       where pm.published_post_id = pp.id
    ) m on true
   where pp.platform::text = platform_name
     and pp.published_at >= lookback_ts
   -- Never captured sorts first; after that, longest since last snapshot.
   order by m.last_captured_at asc nulls first, pp.published_at desc
   limit batch;
$$;

comment on function public.stale_metrics_posts is
  'Published posts due for a metrics snapshot, least-recently-captured first. '
  'Replaces a newest-first pick that starved every post past the batch size.';

-- The join key the lateral above walks, and the one migration 023's portal
-- policies walk per row. published_posts had only its PK, a unique on
-- (platform, external_id), and (tenant_id) — nothing on draft_id.
create index if not exists published_posts_draft_idx
  on public.published_posts (draft_id);

create index if not exists post_metrics_post_captured_idx
  on public.post_metrics (published_post_id, captured_at desc);
