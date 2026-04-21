-- ═══════════════════════════════════════════════════════════════════════════
-- Nest · Initial schema
--   Studio Andréa Faria operational platform
--   Reference: HANDOFF.md §4 (Data model)
-- ═══════════════════════════════════════════════════════════════════════════

create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm";

-- ───────────────────────────────────────────────────────────────────────────
-- Enums
-- ───────────────────────────────────────────────────────────────────────────

create type user_role as enum ('owner', 'staff', 'client');
create type client_status as enum ('prospect', 'active', 'paused', 'archived');
create type task_status as enum ('todo', 'in_progress', 'blocked', 'review', 'done');
create type task_priority as enum ('low', 'medium', 'high', 'urgent');
create type content_status as enum (
  'draft', 'text_review', 'creative_review',
  'client_review', 'approved', 'scheduled', 'published', 'archived'
);
create type platform as enum ('instagram', 'linkedin', 'tiktok');
create type post_type as enum ('carousel', 'single_image', 'reel', 'story', 'text');
create type meeting_status as enum ('scheduled', 'completed', 'cancelled');

-- ───────────────────────────────────────────────────────────────────────────
-- Profiles · extends auth.users
-- ───────────────────────────────────────────────────────────────────────────

create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  avatar_url text,
  role user_role not null default 'staff',
  locale text not null default 'pt-BR',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index profiles_role_idx on profiles (role);

-- ───────────────────────────────────────────────────────────────────────────
-- Clients
-- ───────────────────────────────────────────────────────────────────────────

create table clients (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  legal_name text,
  industry text,
  status client_status not null default 'active',
  website text,
  notes text,
  primary_contact_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index clients_status_idx on clients (status);
create index clients_name_trgm_idx on clients using gin (name gin_trgm_ops);

create table client_contacts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients (id) on delete cascade,
  full_name text not null,
  role text,
  email text,
  phone text,
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);
create index client_contacts_client_idx on client_contacts (client_id);

alter table clients
  add constraint clients_primary_contact_fkey
  foreign key (primary_contact_id) references client_contacts (id) on delete set null;

-- Membership · which staff members are assigned to which clients
create table client_members (
  client_id uuid not null references clients (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (client_id, user_id)
);

-- ───────────────────────────────────────────────────────────────────────────
-- Contracts · owner-only visibility
-- ───────────────────────────────────────────────────────────────────────────

create table contracts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients (id) on delete cascade,
  title text not null,
  monthly_value_cents bigint,
  currency text not null default 'BRL',
  starts_on date not null,
  ends_on date,
  auto_renew boolean not null default true,
  document_url text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index contracts_client_idx on contracts (client_id);

-- ───────────────────────────────────────────────────────────────────────────
-- Services · templates + per-client subscriptions
-- ───────────────────────────────────────────────────────────────────────────

create table services (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  default_monthly_cents bigint,
  created_at timestamptz not null default now()
);

create table client_services (
  client_id uuid not null references clients (id) on delete cascade,
  service_id uuid not null references services (id) on delete cascade,
  started_on date not null default current_date,
  ended_on date,
  primary key (client_id, service_id, started_on)
);

-- ───────────────────────────────────────────────────────────────────────────
-- Brand kits · identity + assets
-- ───────────────────────────────────────────────────────────────────────────

create table brand_kits (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients (id) on delete cascade,
  name text not null,
  palette jsonb not null default '[]'::jsonb,   -- [{name, hex}]
  typography jsonb not null default '{}'::jsonb, -- {headings, body}
  voice_tone text,
  do_list text[] default array[]::text[],
  dont_list text[] default array[]::text[],
  guidelines_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index brand_kits_client_idx on brand_kits (client_id);

create table brand_assets (
  id uuid primary key default gen_random_uuid(),
  brand_kit_id uuid not null references brand_kits (id) on delete cascade,
  kind text not null,          -- logo | photo | illustration | svg | font
  label text,
  storage_path text not null,
  mime_type text,
  width int,
  height int,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index brand_assets_kit_idx on brand_assets (brand_kit_id);

-- ───────────────────────────────────────────────────────────────────────────
-- Templates · slide templates (cover, list, highlight…)
-- ───────────────────────────────────────────────────────────────────────────

create table templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null,
  html text not null,
  css text not null,
  preview_url text,
  created_at timestamptz not null default now()
);

-- ───────────────────────────────────────────────────────────────────────────
-- Cycles + tasks
-- ───────────────────────────────────────────────────────────────────────────

create table cycles (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients (id) on delete cascade,
  year int not null,
  month int not null check (month between 1 and 12),
  starts_on date not null,
  ends_on date not null,
  created_at timestamptz not null default now(),
  unique (client_id, year, month)
);
create index cycles_client_idx on cycles (client_id);

create table tasks (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients (id) on delete cascade,
  cycle_id uuid references cycles (id) on delete set null,
  assignee_id uuid references profiles (id) on delete set null,
  created_by uuid references profiles (id) on delete set null,
  title text not null,
  description text,
  status task_status not null default 'todo',
  priority task_priority not null default 'medium',
  due_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index tasks_client_idx on tasks (client_id);
create index tasks_assignee_idx on tasks (assignee_id);
create index tasks_status_idx on tasks (status);
create index tasks_due_idx on tasks (due_at);

-- ───────────────────────────────────────────────────────────────────────────
-- Notes · pinned per client
-- ───────────────────────────────────────────────────────────────────────────

create table notes (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients (id) on delete cascade,
  author_id uuid references profiles (id) on delete set null,
  title text,
  body text not null,
  pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index notes_client_idx on notes (client_id);

-- ───────────────────────────────────────────────────────────────────────────
-- Meetings + transcripts
-- ───────────────────────────────────────────────────────────────────────────

create table meetings (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients (id) on delete cascade,
  title text not null,
  starts_at timestamptz not null,
  ends_at timestamptz,
  status meeting_status not null default 'scheduled',
  google_event_id text,
  google_meet_url text,
  created_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index meetings_client_idx on meetings (client_id);
create index meetings_starts_idx on meetings (starts_at);

create table transcripts (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references meetings (id) on delete cascade,
  language text not null default 'pt-BR',
  content text not null,
  source text,       -- google_meet | manual_upload | zoom
  created_at timestamptz not null default now()
);
create index transcripts_meeting_idx on transcripts (meeting_id);

-- ───────────────────────────────────────────────────────────────────────────
-- Content engine · drafts, slides, creatives
-- ───────────────────────────────────────────────────────────────────────────

create table content_drafts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients (id) on delete cascade,
  transcript_id uuid references transcripts (id) on delete set null,
  title text not null,
  pillar text,
  hook text,
  caption text,
  hashtags text[] default array[]::text[],
  status content_status not null default 'draft',
  created_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index content_drafts_client_idx on content_drafts (client_id);
create index content_drafts_status_idx on content_drafts (status);

create table slides (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid not null references content_drafts (id) on delete cascade,
  position int not null,
  template_id uuid references templates (id) on delete set null,
  headline text,
  body text,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (draft_id, position)
);

create table creatives (
  id uuid primary key default gen_random_uuid(),
  slide_id uuid references slides (id) on delete cascade,
  draft_id uuid references content_drafts (id) on delete cascade,
  version int not null default 1,
  image_url text not null,
  width int,
  height int,
  render_html text,
  render_css text,
  created_at timestamptz not null default now()
);
create index creatives_draft_idx on creatives (draft_id);

-- ───────────────────────────────────────────────────────────────────────────
-- Scheduling + publishing
-- ───────────────────────────────────────────────────────────────────────────

create table scheduled_posts (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid not null references content_drafts (id) on delete cascade,
  platform platform not null,
  post_type post_type not null,
  scheduled_for timestamptz not null,
  published_post_id uuid,
  status text not null default 'pending', -- pending | publishing | published | failed
  attempt_count int not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index scheduled_posts_due_idx on scheduled_posts (scheduled_for) where status = 'pending';

create table published_posts (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid not null references content_drafts (id) on delete cascade,
  platform platform not null,
  post_type post_type not null,
  external_id text not null,
  permalink text,
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create unique index published_posts_external_idx on published_posts (platform, external_id);

alter table scheduled_posts
  add constraint scheduled_posts_published_fkey
  foreign key (published_post_id) references published_posts (id) on delete set null;

create table post_metrics (
  id uuid primary key default gen_random_uuid(),
  published_post_id uuid not null references published_posts (id) on delete cascade,
  captured_at timestamptz not null default now(),
  impressions int,
  reach int,
  likes int,
  comments int,
  saves int,
  shares int,
  profile_visits int,
  follows int,
  video_views int,
  raw jsonb not null default '{}'::jsonb
);
create index post_metrics_post_idx on post_metrics (published_post_id, captured_at);

-- ───────────────────────────────────────────────────────────────────────────
-- Client approvals · public token-based access
-- ───────────────────────────────────────────────────────────────────────────

create table approvals (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid not null references content_drafts (id) on delete cascade,
  token text not null unique,
  expires_at timestamptz,
  approved_at timestamptz,
  rejected_at timestamptz,
  client_comment text,
  created_at timestamptz not null default now()
);

-- ───────────────────────────────────────────────────────────────────────────
-- AI edit history (memory for creative chat)
-- ───────────────────────────────────────────────────────────────────────────

create table ai_edits (
  id uuid primary key default gen_random_uuid(),
  creative_id uuid references creatives (id) on delete cascade,
  draft_id uuid references content_drafts (id) on delete cascade,
  prompt text not null,
  response text,
  model text,
  tokens_in int,
  tokens_out int,
  created_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index ai_edits_creative_idx on ai_edits (creative_id);

-- ───────────────────────────────────────────────────────────────────────────
-- Notifications · in-app
-- ───────────────────────────────────────────────────────────────────────────

create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on notifications (user_id, read_at);

-- ═══════════════════════════════════════════════════════════════════════════
-- Triggers · updated_at maintenance
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

do $$ declare r record; begin
  for r in
    select table_name from information_schema.columns
    where table_schema = 'public' and column_name = 'updated_at'
  loop
    execute format(
      'create trigger %I_updated_at before update on %I
       for each row execute function set_updated_at();',
      r.table_name, r.table_name
    );
  end loop;
end $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- Row Level Security
-- ═══════════════════════════════════════════════════════════════════════════

-- Helper: is the current user an owner?
create or replace function is_owner()
returns boolean language sql stable as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and role = 'owner'
  );
$$;

-- Helper: does the current user have access to this client?
create or replace function has_client_access(target_client uuid)
returns boolean language sql stable as $$
  select
    is_owner()
    or exists (
      select 1 from client_members
      where client_id = target_client and user_id = auth.uid()
    );
$$;

alter table profiles         enable row level security;
alter table clients          enable row level security;
alter table client_contacts  enable row level security;
alter table client_members   enable row level security;
alter table contracts        enable row level security;
alter table services         enable row level security;
alter table client_services  enable row level security;
alter table brand_kits       enable row level security;
alter table brand_assets     enable row level security;
alter table templates        enable row level security;
alter table cycles           enable row level security;
alter table tasks            enable row level security;
alter table notes            enable row level security;
alter table meetings         enable row level security;
alter table transcripts      enable row level security;
alter table content_drafts   enable row level security;
alter table slides           enable row level security;
alter table creatives        enable row level security;
alter table scheduled_posts  enable row level security;
alter table published_posts  enable row level security;
alter table post_metrics     enable row level security;
alter table approvals        enable row level security;
alter table ai_edits         enable row level security;
alter table notifications    enable row level security;

-- profiles: anyone authenticated can read; users can update only their own
create policy "profiles: read" on profiles
  for select using (auth.role() = 'authenticated');
create policy "profiles: self update" on profiles
  for update using (id = auth.uid());

-- clients: owner sees all; staff sees assigned
create policy "clients: read" on clients
  for select using (has_client_access(id));
create policy "clients: owner writes" on clients
  for all using (is_owner()) with check (is_owner());

create policy "client_contacts: read" on client_contacts
  for select using (has_client_access(client_id));
create policy "client_contacts: owner writes" on client_contacts
  for all using (is_owner()) with check (is_owner());

create policy "client_members: read" on client_members
  for select using (is_owner() or user_id = auth.uid());
create policy "client_members: owner writes" on client_members
  for all using (is_owner()) with check (is_owner());

-- contracts: owner only
create policy "contracts: owner only" on contracts
  for all using (is_owner()) with check (is_owner());

-- services: readable by authenticated; writable by owner
create policy "services: read" on services
  for select using (auth.role() = 'authenticated');
create policy "services: owner writes" on services
  for all using (is_owner()) with check (is_owner());

create policy "client_services: read" on client_services
  for select using (has_client_access(client_id));
create policy "client_services: owner writes" on client_services
  for all using (is_owner()) with check (is_owner());

-- brand kits & assets
create policy "brand_kits: read" on brand_kits
  for select using (has_client_access(client_id));
create policy "brand_kits: owner writes" on brand_kits
  for all using (is_owner()) with check (is_owner());

create policy "brand_assets: read" on brand_assets
  for select using (
    exists (
      select 1 from brand_kits k
      where k.id = brand_kit_id and has_client_access(k.client_id)
    )
  );
create policy "brand_assets: owner writes" on brand_assets
  for all using (is_owner()) with check (is_owner());

-- templates: shared library — readable by authenticated, writable by owner
create policy "templates: read" on templates
  for select using (auth.role() = 'authenticated');
create policy "templates: owner writes" on templates
  for all using (is_owner()) with check (is_owner());

-- cycles, tasks, notes, meetings — client-scoped
create policy "cycles: read" on cycles
  for select using (has_client_access(client_id));
create policy "cycles: owner writes" on cycles
  for all using (is_owner()) with check (is_owner());

create policy "tasks: read" on tasks
  for select using (client_id is null or has_client_access(client_id));
create policy "tasks: write" on tasks
  for all using (client_id is null or has_client_access(client_id))
  with check (client_id is null or has_client_access(client_id));

create policy "notes: read" on notes
  for select using (has_client_access(client_id));
create policy "notes: write" on notes
  for all using (has_client_access(client_id))
  with check (has_client_access(client_id));

create policy "meetings: read" on meetings
  for select using (client_id is null or has_client_access(client_id));
create policy "meetings: write" on meetings
  for all using (client_id is null or has_client_access(client_id))
  with check (client_id is null or has_client_access(client_id));

create policy "transcripts: read" on transcripts
  for select using (
    exists (
      select 1 from meetings m
      where m.id = meeting_id
        and (m.client_id is null or has_client_access(m.client_id))
    )
  );
create policy "transcripts: write" on transcripts
  for all using (
    exists (
      select 1 from meetings m
      where m.id = meeting_id
        and (m.client_id is null or has_client_access(m.client_id))
    )
  )
  with check (
    exists (
      select 1 from meetings m
      where m.id = meeting_id
        and (m.client_id is null or has_client_access(m.client_id))
    )
  );

-- content engine
create policy "content_drafts: read" on content_drafts
  for select using (has_client_access(client_id));
create policy "content_drafts: write" on content_drafts
  for all using (has_client_access(client_id))
  with check (has_client_access(client_id));

create policy "slides: read" on slides
  for select using (
    exists (
      select 1 from content_drafts d
      where d.id = draft_id and has_client_access(d.client_id)
    )
  );
create policy "slides: write" on slides
  for all using (
    exists (
      select 1 from content_drafts d
      where d.id = draft_id and has_client_access(d.client_id)
    )
  )
  with check (
    exists (
      select 1 from content_drafts d
      where d.id = draft_id and has_client_access(d.client_id)
    )
  );

create policy "creatives: read" on creatives
  for select using (
    exists (
      select 1 from content_drafts d
      where d.id = draft_id and has_client_access(d.client_id)
    )
  );
create policy "creatives: write" on creatives
  for all using (
    exists (
      select 1 from content_drafts d
      where d.id = draft_id and has_client_access(d.client_id)
    )
  )
  with check (
    exists (
      select 1 from content_drafts d
      where d.id = draft_id and has_client_access(d.client_id)
    )
  );

create policy "scheduled_posts: read" on scheduled_posts
  for select using (
    exists (
      select 1 from content_drafts d
      where d.id = draft_id and has_client_access(d.client_id)
    )
  );
create policy "scheduled_posts: write" on scheduled_posts
  for all using (
    exists (
      select 1 from content_drafts d
      where d.id = draft_id and has_client_access(d.client_id)
    )
  )
  with check (
    exists (
      select 1 from content_drafts d
      where d.id = draft_id and has_client_access(d.client_id)
    )
  );

create policy "published_posts: read" on published_posts
  for select using (
    exists (
      select 1 from content_drafts d
      where d.id = draft_id and has_client_access(d.client_id)
    )
  );
create policy "published_posts: owner writes" on published_posts
  for all using (is_owner()) with check (is_owner());

create policy "post_metrics: read" on post_metrics
  for select using (
    exists (
      select 1 from published_posts p
      join content_drafts d on d.id = p.draft_id
      where p.id = published_post_id and has_client_access(d.client_id)
    )
  );
create policy "post_metrics: owner writes" on post_metrics
  for all using (is_owner()) with check (is_owner());

-- approvals: public access via token is handled at app layer (service role)
create policy "approvals: owner access" on approvals
  for all using (is_owner()) with check (is_owner());

create policy "ai_edits: read" on ai_edits
  for select using (
    exists (
      select 1 from content_drafts d
      where d.id = draft_id and has_client_access(d.client_id)
    )
  );
create policy "ai_edits: write" on ai_edits
  for all using (
    exists (
      select 1 from content_drafts d
      where d.id = draft_id and has_client_access(d.client_id)
    )
  )
  with check (
    exists (
      select 1 from content_drafts d
      where d.id = draft_id and has_client_access(d.client_id)
    )
  );

create policy "notifications: own only" on notifications
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ═══════════════════════════════════════════════════════════════════════════
-- Auth bootstrap · auto-create profile on signup
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
