-- ═══════════════════════════════════════════════════════════════════════════
-- 034 — the 031 views need security_barrier
--
-- Split out of 033: unrelated to the profiles grant, and pairing them meant
-- one failing took the other down with it.
-- ═══════════════════════════════════════════════════════════════════════════

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
