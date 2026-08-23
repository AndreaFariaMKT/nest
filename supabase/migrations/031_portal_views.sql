-- ═══════════════════════════════════════════════════════════════════════════
-- 031 — the portal reads views, not tables
--
-- 018 gave a portal client SELECT on its own `clients` row and its own
-- `contracts` rows. RLS is row-level, so "its own row" means the WHOLE row:
--
--   clients.notes        the studio's private commentary about this client
--   clients.portal_token the bearer credential for the public /p/ link
--   contracts.notes      internal commentary on the contract
--
-- The pages themselves select narrowly — `id, name, slug` and
-- `id, title, monthly_value_cents, starts_on, ends_on` — but the browser holds
-- the anon key, so `select *` from a console returns everything the policy
-- allows. Filtering in the application was never the boundary; this is the
-- same lesson as migration 022, one layer further in.
--
-- Columns are what a VIEW is for. The portal gets one per table, holding
-- exactly what it is meant to see, and loses its direct grant on the tables.
--
-- security_invoker = off (the default) on purpose: the view runs as its owner
-- and therefore does not re-enter the table's RLS. The WHERE clause IS the
-- boundary, and it is the same predicate `owns_portal_client` uses — which is
-- why it must be read carefully rather than trusted to a policy underneath.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace view public.portal_client as
  select c.id, c.name, c.slug, c.tenant_id
    from public.clients c
   where c.portal_user_id = (select auth.uid())
     and c.status <> 'archived';

comment on view public.portal_client is
  'What a portal login may know about its own client. Deliberately excludes '
  'notes (studio commentary) and portal_token (a bearer credential).';

create or replace view public.portal_contract as
  select k.id, k.client_id, k.title, k.monthly_value_cents, k.currency,
         k.starts_on, k.ends_on, k.status
    from public.contracts k
    join public.clients c on c.id = k.client_id
   where c.portal_user_id = (select auth.uid())
     and c.status <> 'archived';

comment on view public.portal_contract is
  'What a portal login may know about its own contracts. Excludes notes and '
  'document_url, which are internal.';

grant select on public.portal_client to authenticated;
grant select on public.portal_contract to authenticated;

-- Now withdraw the direct grants. Staff policies on both tables are untouched:
-- these two are the portal-only ones 018 added.
drop policy if exists "portal reads own client" on public.clients;
drop policy if exists "portal reads contracts" on public.contracts;

-- `owns_portal_client()` and `is_portal_user()` still read `clients` directly,
-- but both are SECURITY DEFINER (018, 029) and so are unaffected by the policy
-- going away — which is the whole reason the floors keep working.
