-- ============================================================================
-- Social media module · part 2 of 2 — columns, tables, policies.
--
-- Run 019_social_status_enum.sql first (it adds the content_status values this
-- file's defaults and checks rely on).
--
-- What this adds:
--   · content_drafts   → everything a piece carries from shelf to live
--   · clients          → module toggle + how many pieces a fortnight buys
--   · meetings         → summary, files, and the decisions that must survive
--   · messages         → `room`, so a client's internal room and the room the
--                        client actually reads are two different places
--   · media_assets     → raw material (footage, stills, recordings)
--   · shared_logins    → where a shared credential lives and who holds it;
--                        the secret itself is stored encrypted by the app
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Enums
-- ----------------------------------------------------------------------------
do $$ begin
  create type design_state as enum ('todo', 'done', 'signed_off');
exception when duplicate_object then null; end $$;

do $$ begin
  create type content_origin as enum (
    'research', 'client_request', 'meeting', 'follow_up', 'dated_event'
  );
exception when duplicate_object then null; end $$;

-- ----------------------------------------------------------------------------
-- content_drafts · the piece
--
-- `pillar` already meant "which territory does this belong to" — that is the
-- module's axis, so it is reused rather than duplicated.
-- ----------------------------------------------------------------------------
alter table public.content_drafts
  add column if not exists post_type            post_type,
  add column if not exists slide_count          int check (slide_count is null or slide_count between 1 and 20),
  add column if not exists channels             platform[] not null default array['instagram']::platform[],
  add column if not exists origin               content_origin,
  add column if not exists why_now              text,
  add column if not exists window_note          text,
  add column if not exists source_ref           text,
  add column if not exists design_state         design_state not null default 'todo',
  add column if not exists material_url         text,
  add column if not exists note_design          text,
  add column if not exists note_publish         text,
  add column if not exists design_feedback      text,
  add column if not exists client_comment       text,
  add column if not exists return_reason        text,
  add column if not exists publish_on           date,
  add column if not exists publish_time         time not null default '08:00',
  add column if not exists direction_ok         boolean not null default false,
  add column if not exists backlog_added_on     date not null default current_date,
  add column if not exists sent_up_at           timestamptz,
  add column if not exists approved_internal_at timestamptz,
  add column if not exists sent_to_client_at    timestamptz,
  add column if not exists client_approved_at   timestamptz,
  add column if not exists published_at         timestamptz;

-- The two lookups the module makes constantly: "what is on the shelf for this
-- client" and "what publishes in this window".
create index if not exists content_drafts_client_status_idx
  on public.content_drafts (client_id, status);
create index if not exists content_drafts_publish_on_idx
  on public.content_drafts (publish_on)
  where publish_on is not null;

-- ----------------------------------------------------------------------------
-- clients · module toggle + fortnight volume (drives the backlog stock meter)
-- ----------------------------------------------------------------------------
alter table public.clients
  add column if not exists social_enabled  boolean not null default true,
  add column if not exists posts_per_cycle int not null default 2;

do $$ begin
  alter table public.clients
    add constraint clients_posts_per_cycle_range
    check (posts_per_cycle between 1 and 40);
exception when duplicate_object then null; end $$;

-- ----------------------------------------------------------------------------
-- meetings · a meeting with no decision written down gets held again
-- ----------------------------------------------------------------------------
alter table public.meetings
  add column if not exists summary        text,
  add column if not exists agenda_url     text,
  add column if not exists transcript_url text,
  add column if not exists decisions      text[] not null default array[]::text[];

-- ----------------------------------------------------------------------------
-- messages · team room vs client room
--
-- client_id null  → the tenant-wide internal channel (unchanged)
-- client_id set   → room = 'team'   : production talk, the client NEVER sees it
--                   room = 'client' : the room the client reads and writes in
-- ----------------------------------------------------------------------------
alter table public.messages
  add column if not exists room text not null default 'client';

do $$ begin
  alter table public.messages
    add constraint messages_room_check check (room in ('team', 'client'));
exception when duplicate_object then null; end $$;

-- Existing rows: the tenant channel is a team room; per-client rows were the
-- client chat, which is already the default.
update public.messages set room = 'team' where client_id is null and room <> 'team';

create index if not exists messages_client_room_idx
  on public.messages (client_id, room, created_at desc);

-- A client may only ever read (and write in) its own client room. This
-- REPLACES the 018 policies, which predate the room split.
drop policy if exists "portal reads messages" on public.messages;
create policy "portal reads messages" on public.messages
  for select using (public.owns_portal_client(client_id) and room = 'client');

drop policy if exists "portal writes messages" on public.messages;
create policy "portal writes messages" on public.messages
  for insert with check (
    public.owns_portal_client(client_id)
    and room = 'client'
    and sender_id = auth.uid()
  );

-- ----------------------------------------------------------------------------
-- media_assets · raw material, not finished pieces
-- ----------------------------------------------------------------------------
create table if not exists public.media_assets (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null default '00000000-0000-0000-0000-0000000000af'
                references public.tenants (id) on delete cascade,
  client_id   uuid not null references public.clients (id) on delete cascade,
  title       text not null,
  url         text not null,
  access_note text,
  description text,
  -- Material ages. A portrait from March and one from last week are not
  -- interchangeable, and nothing in the file says which is which.
  captured_on date not null default current_date,
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists media_assets_tenant_idx on public.media_assets (tenant_id);
create index if not exists media_assets_client_idx on public.media_assets (client_id, captured_on desc);

-- ----------------------------------------------------------------------------
-- shared_logins · WHERE a shared credential lives and WHO holds it.
--
-- `secret_enc` is AES-256-GCM ciphertext produced by the app (src/lib/secrets.ts)
-- with SOCIAL_SECRET_KEY — the database never sees a password in the clear, so
-- a dump or a leaked read does not hand anyone a client's account. Null means
-- partner/delegated access, where there is no password to hold at all.
-- ----------------------------------------------------------------------------
create table if not exists public.shared_logins (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null default '00000000-0000-0000-0000-0000000000af'
                 references public.tenants (id) on delete cascade,
  client_id    uuid not null references public.clients (id) on delete cascade,
  platform     text not null,
  site         text,
  username     text not null,
  secret_enc   text,
  holder       text not null default 'client',
  mfa          text,
  -- Which app roles are on this login (founder, manager, social, client, …).
  access_roles text[] not null default array[]::text[],
  note         text,
  rotated_on   date,
  created_by   uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists shared_logins_tenant_idx on public.shared_logins (tenant_id);
create index if not exists shared_logins_client_idx on public.shared_logins (client_id);

-- ----------------------------------------------------------------------------
-- RLS · same shape as every other client-owned table
-- ----------------------------------------------------------------------------
alter table public.media_assets  enable row level security;
alter table public.shared_logins enable row level security;

drop policy if exists "media_assets: read" on public.media_assets;
create policy "media_assets: read" on public.media_assets
  for select using (has_client_access(client_id));
drop policy if exists "media_assets: write" on public.media_assets;
create policy "media_assets: write" on public.media_assets
  for all using (has_client_access(client_id))
  with check (has_client_access(client_id));

drop policy if exists "shared_logins: read" on public.shared_logins;
create policy "shared_logins: read" on public.shared_logins
  for select using (has_client_access(client_id));
drop policy if exists "shared_logins: write" on public.shared_logins;
create policy "shared_logins: write" on public.shared_logins
  for all using (has_client_access(client_id))
  with check (has_client_access(client_id));

-- The client reads its own material and its own logins (read-only — the studio
-- keeps the record).
drop policy if exists "portal reads media" on public.media_assets;
create policy "portal reads media" on public.media_assets
  for select using (public.owns_portal_client(client_id));

drop policy if exists "portal reads logins" on public.shared_logins;
create policy "portal reads logins" on public.shared_logins
  for select using (public.owns_portal_client(client_id));

-- A client approves, rejects, or asks for changes on its own pieces. The
-- server action is what constrains WHICH columns move; this is the floor.
drop policy if exists "portal decides content" on public.content_drafts;
create policy "portal decides content" on public.content_drafts
  for update using (public.owns_portal_client(client_id))
  with check (public.owns_portal_client(client_id));

-- Tenant isolation floor + updated_at, consistent with migrations 001 and 014.
do $$
declare t text;
begin
  foreach t in array array['media_assets', 'shared_logins']
  loop
    execute format('drop trigger if exists %I_updated_at on public.%I', t, t);
    execute format(
      'create trigger %I_updated_at before update on public.%I '
      || 'for each row execute function set_updated_at()',
      t, t
    );
    execute format('drop policy if exists tenant_isolation on public.%I', t);
    execute format(
      'create policy tenant_isolation on public.%I '
      || 'as restrictive for all to authenticated '
      || 'using (public.is_tenant_member(tenant_id)) '
      || 'with check (public.is_tenant_member(tenant_id))',
      t
    );
  end loop;
end;
$$;
