-- ============================================================================
-- is_owner() stops depending on a column nothing writes.
--
-- It has always been `profiles.role = 'owner'` — the legacy owner/staff/client
-- enum. The signup trigger writes the 'staff' default and never revisits it,
-- no migration sets 'owner' for anyone, and 025 revoked update(role) from
-- `authenticated`, so the application cannot set it either. Whoever holds it
-- today holds it because someone typed it into the SQL editor once.
--
-- That matters more than it looks, because has_client_access() is
--
--     is_owner() or exists (select 1 from client_members ...)
--
-- and client_members has no write site anywhere in the application. So
-- is_owner() is, in practice, the ONLY thing standing between a login and
-- every clients-scoped table in the schema. The next person made a founder
-- would pass every check the app makes, reach every screen, and read zero rows
-- — with no way to fix it short of hand-written SQL.
--
-- Additive on purpose. The old predicate stays, so nobody who can read
-- something today loses it; the new one adds the role the application actually
-- runs on. A migration that touches eighteen policies at once should only ever
-- be able to grant.
-- ============================================================================

create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'owner'
    )
    or exists (
      -- The live role: founder of any tenant this user belongs to. Untenanted
      -- on purpose — is_owner() takes no tenant argument, and narrowing it
      -- here would silently revoke access rather than add it. The restrictive
      -- tenant floors from 022 already scope every row to one tenant.
      select 1 from public.tenant_members
      where user_id = auth.uid() and role = 'founder'
    );
$$;

comment on function public.is_owner is
  'True for a founder in tenant_members, or the legacy profiles.role=''owner''. '
  'Was the legacy check alone, which nothing in the app can set — so a second '
  'founder passed every application check and read zero rows.';
