-- ============================================================================
-- Let a client answer from the portal, without minting a link nobody sent.
--
-- `approvals` was built for one flow: the studio mints a 14-day bearer token,
-- emails it, and the client answers at /a/<token>. That is why `token` is
-- `not null unique` — every row was, by definition, a live credential.
--
-- A client signed into the portal has already authenticated. Recording their
-- answer through that table meant generating a token to satisfy the
-- constraint — a working 14-day link to the same draft, never sent to anyone,
-- sitting in the database. A credential that exists for no reason is a
-- credential that can only leak.
--
-- So `token` becomes nullable and a portal answer carries none. Postgres
-- allows many NULLs under a unique constraint, and /a/[token] looks rows up by
-- a token it was given, which never matches NULL — so the link flow is
-- untouched.
--
-- `source` records which of the two answered, because "the client approved"
-- and "someone holding the link approved" are different facts and the
-- feedback screen should be able to tell them apart.
-- ============================================================================

alter table public.approvals
  alter column token drop not null;

alter table public.approvals
  add column if not exists source text not null default 'link';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'approvals_source_check'
  ) then
    alter table public.approvals
      add constraint approvals_source_check check (source in ('link', 'portal'));
  end if;
end;
$$;

-- A portal answer has no token; a link answer must have one. Stated as a
-- constraint so the two shapes cannot drift into each other.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'approvals_token_matches_source'
  ) then
    alter table public.approvals
      add constraint approvals_token_matches_source check (
        (source = 'link' and token is not null)
        or (source = 'portal' and token is null)
      );
  end if;
end;
$$;

comment on column public.approvals.source is
  'How the client answered: ''link'' (a mailed /a/<token> bearer link) or '
  '''portal'' (signed in, no token). Drives which credential rules apply.';

-- The portal reads "has this draft already been answered" per draft.
create index if not exists approvals_draft_answered_idx
  on public.approvals (draft_id, approved_at, rejected_at);
