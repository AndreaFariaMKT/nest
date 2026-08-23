-- ═══════════════════════════════════════════════════════════════════════════
-- 027 — aggregate the month's KPIs in SQL, not in a truncated page of rows
--
-- `kpisFor()` selected raw snapshots with `.limit(2000)` and reduced them in
-- JavaScript. Two things were wrong with that, and the second is already
-- producing wrong numbers in production:
--
--   * PostgREST caps every response at `max_rows` (1000, both in
--     supabase/config.toml and on Supabase hosted), so `.limit(2000)` was
--     silently 1000.
--   * metrics-collect writes one snapshot per published post per day, so a
--     month of ~34 tracked posts already exceeds 1000. The query orders by
--     captured_at DESC, so the posts whose snapshots fall early in the month
--     drop out entirely — `latestPerPost` never sees them, reach and
--     impressions read low, and the month-over-month delta compares two
--     numbers truncated at different places.
--
-- DISTINCT ON picks each post's newest snapshot inside the window, in SQL. The
-- result is one row per POST rather than one per post per day — a ~30x
-- reduction that puts the response back inside the cap by a wide margin, and
-- makes what comes out independent of how long the month's collection ran.
--
-- The summing itself stays in src/lib/kpi.ts, where aggregateKpis is unit
-- tested and also computes engagementRate and postsCovered. Moving the sum
-- into SQL too would have meant a second definition of the engagement formula.
--
-- SECURITY INVOKER on purpose: the caller sums exactly what their RLS lets
-- them see. Staff reach it through has_client_access, a portal client through
-- owns_portal_client (023) — same function, two correct answers.
--
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.social_month_kpis(
  target_clients uuid[],
  from_ts timestamptz,
  to_ts timestamptz
)
returns table (
  published_post_id uuid,
  captured_at timestamptz,
  reach integer,
  impressions integer,
  likes integer,
  comments integer,
  saves integer,
  shares integer
)
language sql
stable
security invoker
set search_path = public
as $$
  select distinct on (m.published_post_id)
         m.published_post_id, m.captured_at, m.reach, m.impressions,
         m.likes, m.comments, m.saves, m.shares
    from public.post_metrics m
    join public.published_posts pp on pp.id = m.published_post_id
    join public.content_drafts d on d.id = pp.draft_id
   where m.captured_at >= from_ts
     and m.captured_at <  to_ts
     and d.client_id = any(target_clients)
   order by m.published_post_id, m.captured_at desc;
$$;

comment on function public.social_month_kpis is
  'Latest snapshot per published post inside a window. Replaces a raw snapshot '
  'select that PostgREST silently truncated at 1000 rows, dropping whole posts '
  'from the month''s totals.';

-- The report filters post_metrics on captured_at alone. The only index there
-- is (published_post_id, captured_at), where captured_at is the SECOND column
-- and so cannot serve a range scan on its own — every report load seq-scanned
-- the table, four times over (this month and last, on two screens).
create index if not exists post_metrics_captured_idx
  on public.post_metrics (captured_at desc);
