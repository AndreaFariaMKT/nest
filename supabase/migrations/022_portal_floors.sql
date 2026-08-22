-- ============================================================================
-- Put the portal's boundaries in the database.
--
-- Three separate screens filtered the portal's data in the APPLICATION and
-- assumed that was the boundary: the room filter on messages, the stage filter
-- on content_drafts, and the role list on shared logins. None of them is a
-- boundary. The browser holds the anon key (src/lib/supabase/client.ts) and a
-- valid client session, so a portal login can call PostgREST directly and skip
-- every one of those filters.
--
-- Two of the holes predate this module (016's blanket `messages read`, 018's
-- unfiltered `portal reads content`, 001's `client_id is null` short-circuit).
-- The social media module made them matter: it put internal production talk in
-- `messages`, internal notes on `content_drafts`, and meeting decisions on
-- `meetings`.
--
-- The fix is restrictive policies. Permissive policies OR together — which is
-- why 020's `and room = 'client'` did nothing next to 016's older, broader
-- grant. A RESTRICTIVE policy is AND-ed with all of them, so it constrains
-- every existing grant at once without rewriting any of them.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Is the caller a client login rather than studio staff?
-- ----------------------------------------------------------------------------
create or replace function public.is_portal_user()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.clients c where c.portal_user_id = auth.uid()
  );
$$;

-- ----------------------------------------------------------------------------
-- messages · a client sees its own client room, and nothing else
--
-- Before this, a client could read every team room in the tenant and the
-- studio-wide channel, and could post into any of them.
-- ----------------------------------------------------------------------------
drop policy if exists portal_room_floor on public.messages;
create policy portal_room_floor on public.messages
  as restrictive for all to authenticated
  using (
    not public.is_portal_user()
    or (room = 'client' and public.owns_portal_client(client_id))
  )
  with check (
    not public.is_portal_user()
    or (room = 'client' and public.owns_portal_client(client_id))
  );

-- ----------------------------------------------------------------------------
-- content_drafts · a client sees only the stages meant for them
--
-- The page filtered by CLIENT_VISIBLE_STAGES; the policy did not, so a direct
-- read returned pieces still in backlog/writing along with note_design,
-- note_publish, design_feedback and return_reason.
--
-- Keep this list in step with CLIENT_VISIBLE_STAGES in src/lib/social.ts.
-- ----------------------------------------------------------------------------
drop policy if exists portal_stage_floor on public.content_drafts;
create policy portal_stage_floor on public.content_drafts
  as restrictive for all to authenticated
  using (
    not public.is_portal_user()
    or status = any (array[
      'client_review', 'changes_requested', 'approved', 'scheduled', 'published'
    ]::content_status[])
  );

-- ----------------------------------------------------------------------------
-- tasks / meetings / transcripts · close the `client_id is null` short-circuit
--
-- 001's policies read `client_id is null or has_client_access(client_id)`. The
-- null branch short-circuits before any identity check, so every portal client
-- had full read AND write — including DELETE — on every unassigned task,
-- meeting and transcript in the tenant. Migration 020 raised the stakes by
-- putting meeting decisions there.
-- ----------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['tasks', 'meetings', 'transcripts']
  loop
    execute format('drop policy if exists portal_no_internal on public.%I', t);
    execute format(
      'create policy portal_no_internal on public.%I '
      || 'as restrictive for all to authenticated '
      || 'using (not public.is_portal_user() or %s) '
      || 'with check (not public.is_portal_user() or %s)',
      t,
      case t
        -- transcripts reach their client through the meeting they belong to.
        when 'transcripts' then
          'exists (select 1 from public.meetings m where m.id = transcripts.meeting_id '
          || 'and public.owns_portal_client(m.client_id))'
        else 'public.owns_portal_client(client_id)'
      end,
      case t
        when 'transcripts' then
          'exists (select 1 from public.meetings m where m.id = transcripts.meeting_id '
          || 'and public.owns_portal_client(m.client_id))'
        else 'public.owns_portal_client(client_id)'
      end
    );
  end loop;
end;
$$;

-- ----------------------------------------------------------------------------
-- shared_logins · an unset access list must mean "nobody", not "everybody"
--
-- The app now fails closed on an empty list (revealSecretAction), but the
-- default should not hand out a wide-open row in the first place.
-- ----------------------------------------------------------------------------
alter table public.shared_logins
  alter column access_roles set default array['founder']::text[];

update public.shared_logins
  set access_roles = array['founder']::text[]
  where access_roles = array[]::text[];
