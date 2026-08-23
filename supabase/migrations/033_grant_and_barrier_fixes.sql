-- ═══════════════════════════════════════════════════════════════════════════
-- 033 — two protections that were written and never actually held
--
-- Both come from the same mistake: assuming a statement did what its name
-- suggests, without checking the engine's semantics.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. The google_* revoke in 029 was a no-op ─────────────────────────────
--
-- `revoke select (col) ... from authenticated` cannot subtract from a
-- table-level grant. Column privileges in PostgreSQL are ADDITIVE: they widen
-- a narrower grant, they never narrow a wider one. Supabase's bootstrap gives
-- `authenticated` table-level SELECT on everything in `public`, so 029's
-- revoke created no column ACL at all and every staff session — any role,
-- either tenant, since `profiles` carries no tenant floor — could still read
-- `google_refresh_token` straight off PostgREST with the anon key.
--
-- What makes this worse than an ordinary miss: the application was then
-- DESIGNED AROUND the protection. `src/lib/auth.ts` and `team/page.tsx` were
-- both narrowed from `select("*")` to explicit column lists, with comments
-- explaining they were avoiding the revoke. The breakage was accommodated;
-- the protection never existed.
--
-- The fix is to rebuild the grant, not to subtract from it.
revoke select on public.profiles from authenticated, anon;

grant select (
  id, email, full_name, avatar_url, role, locale,
  google_email, created_at, updated_at
) on public.profiles to authenticated;

-- Note what is NOT in that list: google_refresh_token, google_access_token,
-- google_token_expires_at, google_scopes. Every legitimate reader of those
-- (google-calendar.ts, calendar-mirror.ts, transcript-pull, the OAuth
-- callback) uses the service role, which bypasses grants entirely.
--
-- `google_email` stays readable: it is the user's own connected address, it is
-- what the settings screen shows, and disconnecting nulls it — so it doubles
-- as the "is Google connected" signal.

comment on column public.profiles.google_refresh_token is
  'Service-role only. Not in the authenticated column grant (033). 012 always '
  'said this; 029 tried to enforce it with a revoke that cannot work.';

-- ── 2. The 031 views need security_barrier ────────────────────────────────
--
-- A plain view is flattened into the calling query and its predicates are
-- merged into one filter list, ordered by estimated cost rather than by
-- origin. So a cheap, caller-supplied, non-leakproof predicate can be
-- evaluated BEFORE the view's own `portal_user_id = auth.uid()` — against
-- every row in the base table, both tenants.
--
-- The response body still contains only the caller's own row, so this is not
-- a direct read. It is an oracle: PostgREST exposes `like`/`ilike`/`~`, whose
-- operators are `proleakproof = false`, and a catastrophic-backtracking regex
-- against `statement_timeout` turns "did any row anywhere match this prefix"
-- into a clean boolean. Iterating prefixes extracts every client name and slug
-- in the database. `eq` is leakproof and was never affected.
--
-- security_barrier forbids that reordering: the view's own quals are evaluated
-- first, and anything the caller adds runs above them.
--
-- It cannot reach `notes` or `portal_token` — PostgREST can only filter on
-- columns the view projects, and those are not projected. That part of 031's
-- design held; this is the part that did not.
alter view public.portal_client set (security_barrier = true);
alter view public.portal_contract set (security_barrier = true);
