-- ============================================================================
-- A prospect has a position, not just a label.
--
-- `clients.status` answers "is this a client" — prospect, active, paused,
-- archived. It does not answer "how far along is this conversation", so the
-- commercial screen could list prospects and nothing else: no way to record
-- that one had been contacted, or that a proposal was out, or to turn a won
-- conversation into an active client without editing the client by hand.
--
-- There is deliberately no 'won' stage. Winning IS the conversion: the same
-- write sets `status = 'active'` and clears the stage. A separate 'won' stage
-- would be a second place that claims someone is a client, and the two would
-- disagree the first time one write succeeded and the other did not.
--
-- 'lost' stays a stage rather than a status, because a lost prospect is still
-- a prospect the studio may come back to. Archiving is the existing way to
-- make one go away.
-- ============================================================================

alter table public.clients
  add column if not exists pipeline_stage text;

-- Every prospect that already exists starts at the beginning rather than at
-- null, so the board has no "unstaged" column nobody knows what to do with.
update public.clients
   set pipeline_stage = 'new'
 where status = 'prospect'
   and pipeline_stage is null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'clients_pipeline_stage_check'
  ) then
    alter table public.clients
      add constraint clients_pipeline_stage_check check (
        pipeline_stage is null
        or pipeline_stage in ('new', 'contacted', 'proposal', 'negotiation', 'lost')
      );
  end if;
end;
$$;

-- Only a prospect carries a stage. Stated here so converting cannot leave a
-- stale position behind on an active client, which is exactly the drift the
-- missing 'won' stage was avoiding.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'clients_stage_only_for_prospects'
  ) then
    alter table public.clients
      add constraint clients_stage_only_for_prospects check (
        status = 'prospect' or pipeline_stage is null
      );
  end if;
end;
$$;

comment on column public.clients.pipeline_stage is
  'Where a prospect sits in the commercial conversation: new, contacted, '
  'proposal, negotiation or lost. Null for everyone who is not a prospect — '
  'winning is the conversion to status = ''active'', not a stage.';

-- The commercial board reads the tenant's prospects by stage.
create index if not exists clients_tenant_pipeline_idx
  on public.clients (tenant_id, pipeline_stage)
  where status = 'prospect';
