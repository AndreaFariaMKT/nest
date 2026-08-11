-- ============================================================================
-- Internal team chat — one shared channel per tenant.
-- Every tenant member can read and post; RLS keeps it inside the tenant.
-- ============================================================================

create table if not exists public.messages (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references public.tenants (id) on delete cascade,
  sender_id  uuid not null references auth.users (id) on delete cascade,
  body       text not null,
  created_at timestamptz not null default now()
);

create index if not exists messages_tenant_created_idx
  on public.messages (tenant_id, created_at desc);

alter table public.messages enable row level security;

drop policy if exists "messages read" on public.messages;
create policy "messages read" on public.messages
  for select using (public.is_tenant_member(tenant_id));

drop policy if exists "messages insert" on public.messages;
create policy "messages insert" on public.messages
  for insert with check (
    public.is_tenant_member(tenant_id) and sender_id = auth.uid()
  );

-- Tenant isolation floor (consistent with migration 014).
drop policy if exists tenant_isolation on public.messages;
create policy tenant_isolation on public.messages
  as restrictive for all to authenticated
  using (public.is_tenant_member(tenant_id))
  with check (public.is_tenant_member(tenant_id));
