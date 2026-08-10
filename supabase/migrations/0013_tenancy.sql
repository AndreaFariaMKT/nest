-- ============================================================================
-- Multi-tenancy — AFM and Nest as separate tenants sharing one deployment.
--
-- Strategy (low risk, no downtime): every tenant-owned table gets a
-- tenant_id column that DEFAULTS to the AFM tenant. Existing rows (all of
-- which belong to Studio Andréa Faria = AFM) are backfilled by the default,
-- and any insert that doesn't yet pass a tenant_id also lands in AFM — so the
-- app keeps working while it is wired to set the current tenant. Nest starts
-- empty. RLS tenant-enforcement is a follow-up (Andréa is a member of both
-- tenants, so app-level scoping is already correct for the current single user).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Tenants + membership
-- ----------------------------------------------------------------------------
create table if not exists public.tenants (
  id         uuid primary key default gen_random_uuid(),
  slug       text not null unique,
  name       text not null,
  theme      text not null default 'nest' check (theme in ('nest', 'afm')),
  branding   jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

insert into public.tenants (id, slug, name, theme)
values
  ('00000000-0000-0000-0000-0000000000af', 'afm', 'AFM', 'afm'),
  ('00000000-0000-0000-0000-000000000e57', 'nest', 'Nest', 'nest')
on conflict (slug) do nothing;

create table if not exists public.tenant_members (
  tenant_id  uuid not null references public.tenants (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  role       text not null default 'member' check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  primary key (tenant_id, user_id)
);

-- Andréa owns both tenants.
insert into public.tenant_members (tenant_id, user_id, role)
select t.id, u.id, 'owner'
from public.tenants t
cross join auth.users u
where u.email = 'andrea@andreafariamkt.com'
on conflict (tenant_id, user_id) do nothing;

-- Membership helper (SECURITY DEFINER — safe to call from RLS later).
create or replace function public.is_tenant_member(target_tenant uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.tenant_members m
    where m.tenant_id = target_tenant and m.user_id = auth.uid()
  );
$$;

alter table public.tenants enable row level security;
alter table public.tenant_members enable row level security;

drop policy if exists "members read tenants" on public.tenants;
create policy "members read tenants" on public.tenants
  for select using (public.is_tenant_member(id));

drop policy if exists "read own tenant memberships" on public.tenant_members;
create policy "read own tenant memberships" on public.tenant_members
  for select using (user_id = auth.uid() or public.is_tenant_member(tenant_id));

-- ----------------------------------------------------------------------------
-- Add tenant_id to every tenant-owned table (defaults to AFM).
-- ----------------------------------------------------------------------------
do $$
declare
  afm uuid := '00000000-0000-0000-0000-0000000000af';
  t   text;
begin
  foreach t in array array[
    'clients', 'client_contacts', 'client_members', 'client_services',
    'contracts', 'services', 'cycles', 'tasks', 'meetings', 'transcripts',
    'content_drafts', 'slides', 'creatives', 'scheduled_posts',
    'published_posts', 'post_metrics', 'approvals', 'monthly_reports',
    'brand_kits', 'brand_assets', 'templates', 'notes', 'ai_edits',
    'notifications'
  ]
  loop
    -- Skip tables that don't exist in this environment.
    if to_regclass('public.' || t) is null then
      continue;
    end if;

    -- Add the column only once; NOT NULL DEFAULT backfills existing rows.
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = t and column_name = 'tenant_id'
    ) then
      execute format(
        'alter table public.%I add column tenant_id uuid not null default %L references public.tenants(id)',
        t, afm
      );
      execute format(
        'create index if not exists %I on public.%I (tenant_id)',
        t || '_tenant_idx', t
      );
    end if;
  end loop;
end;
$$;
