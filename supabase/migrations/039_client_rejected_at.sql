-- ============================================================================
-- When the client said no.
--
-- The module records `sent_to_client_at` and `client_approved_at`, and for a
-- refusal it writes only `client_comment` — so "they asked for changes" has
-- text but no date. The monthly report needs a date: its counts are per month,
-- and a piece sent in August, refused in August and approved in September
-- belongs to both months in different columns.
--
-- Without this the report could only guess, by reading the piece's CURRENT
-- stage — which reports a piece that was refused and later approved as
-- approved only, losing the round trip it is meant to show.
--
-- Deliberately not cleared when the client later approves. Both facts are
-- true, they happened on different days, and a report that erases the first
-- one is the report nobody trusts.
-- ============================================================================

alter table public.content_drafts
  add column if not exists client_rejected_at timestamptz;

comment on column public.content_drafts.client_rejected_at is
  'When the client asked for changes or refused. Set by both refusal paths, '
  'kept if they later approve — the two dates are different facts.';

-- The report scans a month at a time, per client.
create index if not exists content_drafts_client_rejected_idx
  on public.content_drafts (client_id, client_rejected_at)
  where client_rejected_at is not null;
