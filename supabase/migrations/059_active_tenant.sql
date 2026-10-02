-- ============================================================================
-- The active tenant — a login that belongs to both houses works in one at a
-- time, and the database knows which.
--
-- Until now the restrictive floor on every tenant-owned table was
-- `is_tenant_member(tenant_id)`: "you belong to the row's house". Andréa
-- belongs to AFM and Nest, so for her the floor admitted both, and the only
-- thing keeping Nest's screens free of AFM rows was each query remembering to
-- filter by tenant_id. Dozens did not (pages that open a row by id or slug,
-- the notifications list, the clients picker on the task form). It did not
-- show because Nest was empty and she could never reach it: the app resolved a
-- dual member to the lowest tenant id, which is always AFM.
--
-- Now the app sends the house it is working in as the `x-nest-tenant` request
-- header (from the `nest-tenant` cookie the switcher sets), and the floor is
-- `tenant_id = current_tenant_id()`. A forged header reaches nothing: the
-- function only returns a tenant the caller is a member of, and otherwise
-- falls back to exactly what the app did before — the lowest tenant id among
-- the caller's memberships. A single-house login is therefore unaffected.
--
-- The column default moves with it. It was the AFM id, hardcoded, so every
-- insert that forgot tenant_id (about a dozen in the session client: slides,
-- approvals, scheduled_posts, creatives, ai_edits, brand_kits) filed the row
-- under AFM whichever house the person was in. It is now the active tenant.
-- Under the service role there is no user and so no active tenant: the
-- default is null and the NOT NULL rejects the insert, which is the point — a
-- cron that does not say which house a row belongs to should fail, not file
-- it under AFM. The crons now say.
-- ============================================================================

create or replace function public.current_tenant_id()
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid    uuid := auth.uid();
  raw    text;
  wanted uuid;
begin
  if uid is null then
    return null;
  end if;

  -- PostgREST exposes the request headers as one JSON object. Absent outside
  -- PostgREST (psql, realtime), hence the missing_ok and the nullif.
  raw := nullif(current_setting('request.headers', true), '')::json ->> 'x-nest-tenant';

  if raw ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    wanted := raw::uuid;
    if exists (
      select 1 from public.tenant_members m
      where m.tenant_id = wanted and m.user_id = uid
    ) then
      return wanted;
    end if;
  end if;

  -- Same rule as src/lib/tenant-server.ts when there is no valid choice.
  select m.tenant_id into wanted
  from public.tenant_members m
  where m.user_id = uid
  order by m.tenant_id
  limit 1;

  return wanted;
end;
$$;

comment on function public.current_tenant_id() is
  'The tenant the caller is working in: the x-nest-tenant header when the '
  'caller is a member of it, else their lowest tenant id. Null without a user.';

revoke all on function public.current_tenant_id() from public;
grant execute on function public.current_tenant_id() to anon, authenticated, service_role;

-- ----------------------------------------------------------------------------
-- The floor: every tenant_isolation policy, rewritten in place.
--
-- `(select current_tenant_id())` rather than the bare call: as a sub-select
-- Postgres evaluates it once per statement (an InitPlan) instead of once per
-- row.
-- ----------------------------------------------------------------------------
do $$
declare
  t text;
begin
  for t in
    select tablename from pg_policies
    where schemaname = 'public'
      and policyname = 'tenant_isolation'
      and tablename <> 'error_log'
  loop
    execute format('drop policy tenant_isolation on public.%I', t);
    execute format(
      'create policy tenant_isolation on public.%I '
      || 'as restrictive for all to authenticated '
      || 'using (tenant_id = (select public.current_tenant_id())) '
      || 'with check (tenant_id = (select public.current_tenant_id()))',
      t
    );
  end loop;
end;
$$;

-- error_log keeps its null-tenant rows (errors from before a tenant was
-- known) visible; only the house part narrows.
drop policy if exists tenant_isolation on public.error_log;
create policy tenant_isolation on public.error_log
  as restrictive for all to authenticated
  using (tenant_id is null or tenant_id = (select public.current_tenant_id()));

-- ----------------------------------------------------------------------------
-- The default: the active tenant, not AFM.
-- ----------------------------------------------------------------------------
do $$
declare
  t text;
begin
  for t in
    select c.table_name
    from information_schema.columns c
    join information_schema.tables tb
      on tb.table_schema = c.table_schema and tb.table_name = c.table_name
    where c.table_schema = 'public'
      and c.column_name = 'tenant_id'
      and c.is_nullable = 'NO'
      and tb.table_type = 'BASE TABLE'
  loop
    execute format(
      'alter table public.%I alter column tenant_id set default public.current_tenant_id()',
      t
    );
  end loop;
end;
$$;

-- ----------------------------------------------------------------------------
-- Slugs are unique per house, not across houses.
--
-- uniqueSlug() in the app checks for a taken slug through the session client,
-- which now only sees the active house. Left global, a Nest client called
-- "Acme" would pass that check and then hit AFM's "acme" in the constraint.
-- ----------------------------------------------------------------------------
alter table public.clients drop constraint if exists clients_slug_key;
alter table public.clients
  add constraint clients_tenant_slug_key unique (tenant_id, slug);

alter table public.services drop constraint if exists services_slug_key;
alter table public.services
  add constraint services_tenant_slug_key unique (tenant_id, slug);

-- ----------------------------------------------------------------------------
-- Nest's starting set: the finance categories and project flows migrations
-- 049 and 052 seeded for AFM only. Copied from AFM's current rows, and only
-- into a house that has none, so a re-run or an already-configured Nest is
-- left alone.
-- ----------------------------------------------------------------------------
insert into public.fin_categories (tenant_id, name, slug, kind, sort)
select '00000000-0000-0000-0000-000000000e57', c.name, c.slug, c.kind, c.sort
from public.fin_categories c
where c.tenant_id = '00000000-0000-0000-0000-0000000000af'
  and not exists (
    select 1 from public.fin_categories n
    where n.tenant_id = '00000000-0000-0000-0000-000000000e57'
  )
on conflict (tenant_id, slug) do nothing;

insert into public.project_flow_steps
  (tenant_id, project_type, title, role, offset_days, priority, sort)
select '00000000-0000-0000-0000-000000000e57',
       s.project_type, s.title, s.role, s.offset_days, s.priority, s.sort
from public.project_flow_steps s
where s.tenant_id = '00000000-0000-0000-0000-0000000000af'
  and not exists (
    select 1 from public.project_flow_steps n
    where n.tenant_id = '00000000-0000-0000-0000-000000000e57'
  );
