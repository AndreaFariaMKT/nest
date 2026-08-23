-- ═══════════════════════════════════════════════════════════════════════════
-- 029 — three unrelated things that all live on the portal boundary
--
--   1. Archiving a client did not end their portal access.
--   2. The Google OAuth tokens were readable by every authenticated session.
--   3. `is_portal_user()` was being called once per ROW, for staff too.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. An archived client is a former client ──────────────────────────────
--
-- `archiveClientAction` only sets clients.status = 'archived'. Both portal
-- helpers matched on `portal_user_id = auth.uid()` and never looked at status,
-- so an ex-client kept full read access to their content, contracts, meetings,
-- media and shared logins — indefinitely, and with nothing in the UI hinting
-- that the archive button had not done what it looks like it does.
--
-- Checked here rather than by clearing portal_user_id in the app, because that
-- is reversible: un-archiving restores access, and the link survives.
create or replace function public.owns_portal_client(target_client uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.clients c
    where c.id = target_client
      and c.portal_user_id = (select auth.uid())
      and c.status <> 'archived'
  );
$$;

-- `is_portal_user` deliberately does NOT get the status check: someone whose
-- client was archived must still be recognised AS a portal user, or the
-- restrictive floors below stop applying to them and they fall back to the
-- permissive staff grants. Losing access must not mean gaining it.
create or replace function public.is_portal_user()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.clients c where c.portal_user_id = (select auth.uid())
  );
$$;

-- ── 2. The Google tokens are service-role only, as 012 always claimed ──────
--
-- 012 added these columns with the comment "Server-only — never expose to
-- client", but `profiles: read` grants SELECT to every authenticated session.
-- 025's restrictive floor stopped a PORTAL client reading other people's rows;
-- this stops staff reading each other's, and closes the column for good.
-- The service role bypasses column grants, so every legitimate reader —
-- google-calendar.ts, calendar-mirror.ts, transcript-pull, the OAuth callback —
-- is unaffected. `google_email` is deliberately left readable: it is the user's
-- own address and it is what the settings screen shows.
revoke select (
  google_refresh_token,
  google_access_token,
  google_token_expires_at,
  google_scopes
) on public.profiles from authenticated, anon;

-- ── 3. Stop calling is_portal_user() once per row ─────────────────────────
--
-- PostgreSQL will not inline a SECURITY DEFINER function, and a zero-argument
-- STABLE call inside a boolean qual is not hoisted — so each of these policies
-- ran a full function invocation for every row scanned, including for staff,
-- for whom the answer is always false. A tenant-wide read of content_drafts
-- meant one call per draft, per policy.
--
-- Wrapping it in a scalar subquery with no outer reference turns it into an
-- InitPlan, evaluated once per query. This is Supabase's documented RLS
-- pattern. `owns_portal_client(client_id)` takes a column and genuinely must
-- run per row, so it stays as it is — but it now benefits from the
-- `(select auth.uid())` hoist inside its own body, above.
drop policy if exists portal_room_floor on public.messages;
create policy portal_room_floor on public.messages
  as restrictive for all to authenticated
  using (
    not (select public.is_portal_user())
    or (room = 'client' and public.owns_portal_client(client_id))
  )
  with check (
    not (select public.is_portal_user())
    or (room = 'client' and public.owns_portal_client(client_id))
  );

-- Kept in step with CLIENT_VISIBLE_STAGES in src/lib/social.ts.
drop policy if exists portal_stage_floor on public.content_drafts;
create policy portal_stage_floor on public.content_drafts
  as restrictive for all to authenticated
  using (
    not (select public.is_portal_user())
    or status = any (array[
      'client_review', 'changes_requested', 'approved', 'scheduled', 'published'
    ]::content_status[])
  );

do $$
declare
  t text;
  own text;
begin
  foreach t in array array['tasks', 'meetings', 'transcripts']
  loop
    own := case t
      -- transcripts reach their client through the meeting they belong to.
      when 'transcripts' then
        'exists (select 1 from public.meetings m where m.id = transcripts.meeting_id '
        || 'and public.owns_portal_client(m.client_id))'
      else 'public.owns_portal_client(client_id)'
    end;
    execute format('drop policy if exists portal_no_internal on public.%I', t);
    execute format(
      'create policy portal_no_internal on public.%I '
      || 'as restrictive for all to authenticated '
      || 'using (not (select public.is_portal_user()) or %s) '
      || 'with check (not (select public.is_portal_user()) or %s)',
      t, own, own
    );
  end loop;
end $$;
