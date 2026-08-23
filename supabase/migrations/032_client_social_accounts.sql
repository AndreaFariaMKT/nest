-- ═══════════════════════════════════════════════════════════════════════════
-- 032 — publishing credentials belong to a client, not to the deployment
--
-- Until now the publish path used deployment-wide singletons:
-- META_LONG_LIVED_TOKEN + INSTAGRAM_BUSINESS_ACCOUNT_ID, LINKEDIN_ORGANIZATION
-- _URN, TIKTOK_ACCESS_TOKEN. The cron picked due rows across every client and
-- both tenants and published them all with that one set — so a second client's
-- approved carousel would have gone live on the FIRST client's feed. Publicly,
-- irreversibly, under the wrong brand. PUBLISH_ENABLED_CLIENT_ID was the stopgap
-- that made that safe by allowing exactly one client; this is the real fix, and
-- it retires that variable.
--
-- Distinct from `shared_logins`, which is a REGISTER of who holds which client
-- password. These are machine credentials the platform uses to act as the
-- client. Same encryption (src/lib/secrets.ts, AES-256-GCM), different purpose,
-- and deliberately a different table so "who can see a password" and "what can
-- the publisher act as" never share an access rule.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.client_social_accounts (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null default '00000000-0000-0000-0000-0000000000af'
                 references public.tenants (id) on delete cascade,
  client_id    uuid not null references public.clients (id) on delete cascade,
  platform     public.platform not null,

  -- Who the post is authored as. Instagram: the IG Business account id.
  -- LinkedIn: the organization URN. TikTok: unused — the token identifies the
  -- account on its own, so this stays null there rather than being invented.
  account_ref  text,

  -- The access token, encrypted. Null means "registered but not yet usable",
  -- which is a real state during onboarding and must not read as "publish with
  -- somebody else's token" — hence `enabled` below being separate.
  secret_enc   text,

  -- Per-account API pinning, so one client can lag a Graph version without
  -- moving everyone.
  api_version  text,

  -- TikTok only: 'inbox' leaves the post for a human to finalise in the app,
  -- 'direct' publishes outright. Defaults to the safe one everywhere.
  publish_mode text not null default 'inbox'
                 check (publish_mode in ('inbox', 'direct')),

  -- The switch the cron reads. Off by default: registering an account and
  -- authorising it to publish are two decisions, and conflating them is how a
  -- half-finished onboarding puts a post on a live feed.
  enabled      boolean not null default false,

  note         text,
  rotated_on   date,
  created_by   uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  -- One account per client per platform. A second row would reintroduce the
  -- exact ambiguity this table exists to remove.
  unique (client_id, platform)
);

-- The invariant migration 030 established: a row's tenant is its client's.
do $$
begin
  alter table public.client_social_accounts
    add constraint client_social_accounts_client_tenant_fkey
    foreign key (client_id, tenant_id)
    references public.clients (id, tenant_id) on update cascade;
exception
  when duplicate_object then null;
end $$;

create index if not exists client_social_accounts_client_idx
  on public.client_social_accounts (client_id, platform);

-- The cron's own lookup: enabled accounts for a platform.
create index if not exists client_social_accounts_enabled_idx
  on public.client_social_accounts (platform, enabled)
  where enabled;

alter table public.client_social_accounts enable row level security;

-- Staff only, through the same gate as every other client-scoped table.
-- No portal policy at all, and none should ever be added: a client reading
-- these rows would be reading the credential that acts on their behalf.
drop policy if exists "social accounts: read" on public.client_social_accounts;
create policy "social accounts: read" on public.client_social_accounts
  for select using (public.has_client_access(client_id));

drop policy if exists "social accounts: write" on public.client_social_accounts;
create policy "social accounts: write" on public.client_social_accounts
  for all using (public.has_client_access(client_id))
  with check (public.has_client_access(client_id));

-- The tenant floor, consistent with 014.
drop policy if exists tenant_isolation on public.client_social_accounts;
create policy tenant_isolation on public.client_social_accounts
  as restrictive for all to authenticated
  using (public.is_tenant_member(tenant_id))
  with check (public.is_tenant_member(tenant_id));

-- The portal floor, consistent with 022/029. Belt to the "no portal policy"
-- brace above: even if someone later adds a permissive grant by mistake, a
-- portal login is still refused at the floor.
drop policy if exists portal_no_accounts on public.client_social_accounts;
create policy portal_no_accounts on public.client_social_accounts
  as restrictive for all to authenticated
  using (not (select public.is_portal_user()))
  with check (not (select public.is_portal_user()));

-- Named to match 001's convention (<table>_updated_at), because 001 creates
-- these in a loop over every table with an updated_at column and a re-run of
-- that block would otherwise collide with a differently-named one here.
drop trigger if exists client_social_accounts_updated_at
  on public.client_social_accounts;
create trigger client_social_accounts_updated_at
  before update on public.client_social_accounts
  for each row execute function public.set_updated_at();

comment on table public.client_social_accounts is
  'Per-client publishing credentials. Replaces the deployment-wide META / '
  'LINKEDIN / TIKTOK env singletons, which could only ever serve one client.';
