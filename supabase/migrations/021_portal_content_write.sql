-- ============================================================================
-- Close the portal's write path to content_drafts.
--
-- Migration 020 gave a client login an UPDATE policy on its own pieces so it
-- could approve them. That is too much: RLS is row-level, so the policy says
-- "this client may write this row" but cannot say "…and only `status` and
-- `client_comment`, and only to the four values a client can legitimately
-- produce". Since the browser holds the anon key and the user's session, a
-- client could call PostgREST directly and set status = 'published', or rewrite
-- the caption of a piece the studio wrote.
--
-- The decision itself is unchanged for the user. It now runs through the server
-- action (`runTransitionAction`), which checks ownership and then writes with
-- the service role — so the allowed columns and the allowed values live in one
-- place that can actually express them.
-- ============================================================================

drop policy if exists "portal decides content" on public.content_drafts;
