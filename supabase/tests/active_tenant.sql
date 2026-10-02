-- Migration 059 — the active tenant. Run against the LOCAL database only:
--
--   psql postgresql://postgres:postgres@127.0.0.1:54322/postgres \
--     -v ON_ERROR_STOP=1 -f supabase/tests/active_tenant.sql
--
-- Everything happens inside one transaction that is rolled back, so the seed
-- is left as it was. Each check raises on failure; reaching the final NOTICE
-- means every one passed.
--
-- It imitates PostgREST: `set local role authenticated`, the JWT claims in
-- request.jwt.claims (which is what auth.uid() reads), and the request headers
-- in request.headers.

begin;

-- ── Fixtures (as the superuser, before any role switch) ──────────────────────

-- A login in both houses, and one in Nest only.
insert into auth.users (id, email, aud, role)
values
  ('11111111-1111-1111-1111-111111111111', 'both@test.local', 'authenticated', 'authenticated'),
  ('22222222-2222-2222-2222-222222222222', 'nest-only@test.local', 'authenticated', 'authenticated');

insert into public.tenant_members (tenant_id, user_id, role) values
  ('00000000-0000-0000-0000-0000000000af', '11111111-1111-1111-1111-111111111111', 'founder'),
  ('00000000-0000-0000-0000-000000000e57', '11111111-1111-1111-1111-111111111111', 'founder'),
  ('00000000-0000-0000-0000-000000000e57', '22222222-2222-2222-2222-222222222222', 'founder');

-- One client per house, with the SAME slug — legal since 059.
insert into public.clients (id, tenant_id, name, slug) values
  ('aaaaaaaa-0000-0000-0000-0000000000af', '00000000-0000-0000-0000-0000000000af', 'Acme AFM',  'acme'),
  ('aaaaaaaa-0000-0000-0000-000000000e57', '00000000-0000-0000-0000-000000000e57', 'Acme Nest', 'acme');

create temp table _ok (n int);
grant all on _ok to authenticated;

create or replace function pg_temp.act_as(uid uuid, tenant text) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  perform set_config('request.headers',
    case when tenant is null then '{}' else json_build_object('x-nest-tenant', tenant)::text end,
    true);
end;
$$;

set local role authenticated;

-- ── 1. The header picks the house ────────────────────────────────────────────
select pg_temp.act_as('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000e57');
do $$ begin
  if (select array_agg(name) from public.clients where slug = 'acme') is distinct from array['Acme Nest'] then
    raise exception '1: dual member in Nest should see only the Nest client';
  end if;
end $$;

select pg_temp.act_as('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-0000000000af');
do $$ begin
  if (select array_agg(name) from public.clients where slug = 'acme') is distinct from array['Acme AFM'] then
    raise exception '1: dual member in AFM should see only the AFM client';
  end if;
end $$;

-- ── 2. A row of the other house is unreachable by id, for read and write ─────
select pg_temp.act_as('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000e57');
do $$
declare n int;
begin
  if exists (select 1 from public.clients where id = 'aaaaaaaa-0000-0000-0000-0000000000af') then
    raise exception '2: AFM client readable by id from Nest';
  end if;
  update public.clients set name = 'hijacked' where id = 'aaaaaaaa-0000-0000-0000-0000000000af';
  get diagnostics n = row_count;
  if n <> 0 then raise exception '2: AFM client updatable from Nest'; end if;
end $$;

-- ── 3. No header: the old rule, lowest tenant id (AFM) ───────────────────────
select pg_temp.act_as('11111111-1111-1111-1111-111111111111', null);
do $$ begin
  if public.current_tenant_id() <> '00000000-0000-0000-0000-0000000000af' then
    raise exception '3: no header should fall back to AFM for a dual member';
  end if;
end $$;

-- ── 4. A forged header reaches nothing it should not ─────────────────────────
-- The Nest-only login names AFM; it is not a member, so it stays in Nest.
select pg_temp.act_as('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-0000000000af');
do $$ begin
  if public.current_tenant_id() <> '00000000-0000-0000-0000-000000000e57' then
    raise exception '4: forged header moved a Nest-only login into AFM';
  end if;
  if exists (select 1 from public.clients where tenant_id = '00000000-0000-0000-0000-0000000000af') then
    raise exception '4: Nest-only login reads AFM rows';
  end if;
end $$;

-- Garbage in the header is ignored, not an error.
select pg_temp.act_as('22222222-2222-2222-2222-222222222222', 'not-a-uuid''; drop table clients; --');
do $$ begin
  if public.current_tenant_id() <> '00000000-0000-0000-0000-000000000e57' then
    raise exception '4: malformed header broke the fallback';
  end if;
end $$;

-- ── 5. An insert without tenant_id lands in the ACTIVE house ─────────────────
select pg_temp.act_as('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000e57');
insert into public.clients (name, slug) values ('Defaulted', 'defaulted');
reset role;
do $$ begin
  if (select tenant_id from public.clients where slug = 'defaulted')
     <> '00000000-0000-0000-0000-000000000e57' then
    raise exception '5: insert without tenant_id did not land in the active house (Nest)';
  end if;
end $$;
set local role authenticated;

-- ── 6. Writing into the other house explicitly is refused ────────────────────
select pg_temp.act_as('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000e57');
do $$ begin
  begin
    insert into public.clients (tenant_id, name, slug)
    values ('00000000-0000-0000-0000-0000000000af', 'Wrong house', 'wrong-house');
    raise exception '6: insert into AFM accepted while working in Nest';
  exception when insufficient_privilege then
    null; -- RLS refused it, as it should
  end;
end $$;

-- ── 7. Service role with no tenant_id fails instead of filing under AFM ──────
reset role;
set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
do $$ begin
  begin
    insert into public.clients (name, slug) values ('Orphan', 'orphan');
    raise exception '7: service-role insert without tenant_id was accepted';
  exception when not_null_violation then
    null;
  end;
end $$;

reset role;
do $$ begin raise notice 'active_tenant: all checks passed'; end $$;
rollback;
