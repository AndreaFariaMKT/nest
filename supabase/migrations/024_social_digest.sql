-- ============================================================================
-- One message a day to the client, not one per hand-off.
--
-- The module used to notify the moment a piece reached a client. Four pieces
-- on a Tuesday meant four notifications, and the one that mattered — a reply
-- date about to pass — was the one that got lost in the others.
--
-- `social_digest_at` records the last successful digest so a missed cron run
-- does not swallow a day's arrivals: the next run picks up everything since
-- this stamp rather than assuming a clean 24 hours.
-- ============================================================================

alter table public.clients
  add column if not exists social_digest_at timestamptz;

comment on column public.clients.social_digest_at is
  'Last successful daily social digest sent to this client''s portal login. '
  'Set only on success, so a failed run retries the same window tomorrow.';
