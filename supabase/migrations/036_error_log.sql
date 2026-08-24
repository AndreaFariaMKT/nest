-- ═══════════════════════════════════════════════════════════════════════════
-- 036 — an error log the founder can read
--
-- Today a failure leaves two traces, and neither survives: a line in the
-- Vercel log, which rolls off and which nobody reads unless already
-- suspicious, and a refusal on screen that says what went wrong but not where
-- or how often. There is no way to answer "is this happening to other people",
-- and no code a person can quote when they call.
--
-- Modelled on the hub's error_log, with its flaws left behind — they are named
-- at the columns where the decision differs.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.error_log (
  id           uuid primary key default gen_random_uuid(),

  -- NULLABLE, deliberately, and not in 014's tenant loop.
  --
  -- Some failures happen before a tenant is known: a login, the middleware,
  -- the public token routes, a cron run that has not reached a row yet. Giving
  -- this column NOT NULL DEFAULT '…af' — which is what 013 did to every other
  -- table — would file every pre-auth error under AFM, and 030 is the whole
  -- migration written to clean up that class of mistake.
  tenant_id    uuid references public.tenants (id) on delete cascade,

  occurred_at  timestamptz not null default now(),

  severity     text not null default 'error'
                 check (severity in ('warn', 'error', 'fatal')),
  -- A CHECK, not bare text. The hub kept this union in TypeScript only, so a
  -- typo wrote fine and read back as a category nobody had.
  source       text not null
                 check (source in ('action','route','cron','client','render')),

  -- Mirrors src/lib/log.ts's `area` exactly ("cron.publish", "social.write"),
  -- so a row here and a line there can be put side by side.
  area         text not null,
  scope        text not null,

  -- The primary diagnostic. SQLSTATE, a provider code, or Next's digest.
  code         text,

  -- Only ever a SAFE string: an i18n key, a DbError key, or the message of a
  -- non-Postgres error. Never err.details or err.hint — the hub stores those
  -- and its own docs admit they can echo row values. In this schema that would
  -- mean client copy, internal production notes and message bodies landing in
  -- a table, and from there in every database backup.
  message      text,

  -- Stack only, redacted and capped.
  detail       text,
  context      jsonb not null default '{}'::jsonb,

  actor_id     uuid references public.profiles (id) on delete set null,
  -- The app role at the moment of failure. A `client` failing in the portal is
  -- a different animal from a founder failing on a board.
  role         text,
  client_id    uuid references public.clients (id) on delete set null,

  path         text,
  locale       text,
  -- The commit that was running. The hub deferred this column and ended up
  -- apologising for it in a UI comment — it prints the CURRENT deploy with a
  -- disclaimer that it may not be the one that failed. One line, added now.
  release      text,

  -- UNIQUE, unlike the hub's. It is the code a person reads aloud on the
  -- phone; two rows answering to it defeats the point.
  ref          text not null unique,
  -- Identical failures group under one heading. Without it, one crash-looping
  -- cron buries every other error in the list.
  fingerprint  text not null,

  resolved_at  timestamptz,
  resolved_by  uuid references public.profiles (id) on delete set null
);

create index if not exists error_log_occurred_idx
  on public.error_log (occurred_at desc);
create index if not exists error_log_tenant_idx
  on public.error_log (tenant_id, occurred_at desc);
create index if not exists error_log_fingerprint_idx
  on public.error_log (fingerprint, occurred_at desc);
create index if not exists error_log_area_idx
  on public.error_log (area, occurred_at desc);
-- The default view: what still needs looking at.
create index if not exists error_log_open_idx
  on public.error_log (occurred_at desc) where resolved_at is null;

-- ── Who is a founder, in SQL ──────────────────────────────────────────────
--
-- New, because this schema has no app-role helper at all: authorisation by app
-- role has lived entirely in TypeScript until now. It accepts the legacy
-- values 015 migrated (owner/admin → founder) for the same reason
-- mapLegacyRole does — otherwise the same value drift bites at a new layer.
--
-- `target_tenant is null` is an explicit allow, not an accident: a founder of
-- any tenant may read the rows that belong to no tenant, which are exactly the
-- pre-auth failures you most need to see.
create or replace function public.is_founder(target_tenant uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.tenant_members m
    where m.user_id = (select auth.uid())
      and (target_tenant is null or m.tenant_id = target_tenant)
      and m.role in ('founder', 'owner', 'admin')
  );
$$;

alter table public.error_log enable row level security;

drop policy if exists "error_log founder read" on public.error_log;
create policy "error_log founder read" on public.error_log
  for select to authenticated using (public.is_founder(tenant_id));

-- Hand-written, NOT added to 014's loop. `is_tenant_member(null)` is null, not
-- false, and a restrictive policy whose USING is null denies — which would
-- silently hide every untenanted row, i.e. every pre-auth failure.
drop policy if exists tenant_isolation on public.error_log;
create policy tenant_isolation on public.error_log
  as restrictive for all to authenticated
  using (tenant_id is null or public.is_tenant_member(tenant_id));

-- Belt to the founder-only brace above, same shape as 022/029: even if a
-- permissive grant is added here by mistake one day, a portal login is still
-- refused at the floor.
drop policy if exists portal_no_error_log on public.error_log;
create policy portal_no_error_log on public.error_log
  as restrictive for all to authenticated
  using (not (select public.is_portal_user()));

-- No INSERT, UPDATE or DELETE policy anywhere on purpose. Writes go through
-- the service role, so a bug in a browser can neither forge a record nor erase
-- one. Resolving goes through a server action behind a founder check, not a
-- client-writable policy.

comment on table public.error_log is
  'Failures worth keeping. Founder-readable, service-role-writable. Never '
  'exposed to the portal and never included in a client export.';
