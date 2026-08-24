-- ============================================================================
-- Messages arrive without a reload.
--
-- The chat screens have no liveness at all: no subscription, no polling, only
-- a refresh after your OWN send. The room pills say "internal only" and "the
-- client reads this", which promises a channel — and then a reply sits
-- unseen until someone happens to reload the page.
--
-- Adding the table to the realtime publication is all the server needs.
-- Realtime applies the table's RLS to each subscriber, so the split the
-- module is built on holds: a client is not told about a team room, because
-- the policy that hides those rows from them hides the change events too.
--
-- Guarded because a table already in the publication makes this an error, and
-- a migration should be safe to re-run.
-- ============================================================================

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end $$;

-- Realtime sends the old row on updates and deletes only when the table has a
-- replica identity that includes it. Inserts are all this feature listens for,
-- so the default is enough — noted so nobody adds `replica identity full`
-- later thinking it was an oversight. It would put every message body through
-- the WAL twice.
