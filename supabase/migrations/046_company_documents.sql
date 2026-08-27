-- ============================================================================
-- 046 — the company's own documents.
--
-- /administration says "Documentos da empresa e clientes" and shows only the
-- second half. Its whole content is derived: contracts that happen to carry a
-- `document_url`. There has never been anywhere to record the studio's own
-- paperwork — the contrato social, the CNPJ card, an insurance policy, the
-- alvará, the business plan — so the screen named after them could not list
-- one, and nothing on it could be edited because nothing on it was a record.
--
-- `valid_until` earns its place rather than being schema decoration: half of
-- these expire, and a document nobody noticed expiring is the reason a screen
-- like this exists at all. It is nullable, because a contrato social does not.
--
-- Studio-only, and firmly so. These are the company's legal and financial
-- papers: no portal policy, plus the restrictive portal floor from 022/029 so
-- a permissive grant added here by mistake one day still cannot reach them.
-- ============================================================================

create table if not exists public.company_documents (
  id           uuid primary key default gen_random_uuid(),

  -- Explicit, not via 013's loop — that migration is done and a new table
  -- carries its own column. Same default tenant as 032 so a row written
  -- before the tenant is resolved still lands somewhere real.
  tenant_id    uuid not null default '00000000-0000-0000-0000-0000000000af'
                 references public.tenants (id) on delete cascade,

  title        text not null,

  -- A CHECK rather than a TypeScript union, for the reason 036 gives: a union
  -- kept only in the app means a typo writes fine and reads back as a category
  -- nobody has.
  category     text not null default 'other'
                 check (category in ('legal', 'finance', 'insurance', 'plan', 'other')),

  document_url text,
  notes        text,

  -- Date, not timestamptz. These expire on a day, in the studio's calendar,
  -- and storing an instant would reintroduce the timezone drift 91b4772 spent
  -- eight fixes removing.
  valid_until  date,

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists company_documents_tenant_idx
  on public.company_documents (tenant_id);

-- The screen's two orders: everything by category, and what expires next.
create index if not exists company_documents_tenant_expiry_idx
  on public.company_documents (tenant_id, valid_until)
  where valid_until is not null;

alter table public.company_documents enable row level security;

-- Founder-only, both ways. `is_owner()` reads tenant membership since 038, so
-- this is the live role and not the legacy `profiles.role` column.
drop policy if exists "company documents: access" on public.company_documents;
create policy "company documents: access" on public.company_documents
  for all using (public.is_owner()) with check (public.is_owner());

-- The tenant floor, consistent with 014.
drop policy if exists tenant_isolation on public.company_documents;
create policy tenant_isolation on public.company_documents
  as restrictive for all to authenticated
  using (public.is_tenant_member(tenant_id))
  with check (public.is_tenant_member(tenant_id));

-- The portal floor, consistent with 022/029.
drop policy if exists portal_no_company_documents on public.company_documents;
create policy portal_no_company_documents on public.company_documents
  as restrictive for all to authenticated
  using (not (select public.is_portal_user()))
  with check (not (select public.is_portal_user()));

-- Named to match 001's <table>_updated_at convention.
drop trigger if exists company_documents_updated_at on public.company_documents;
create trigger company_documents_updated_at
  before update on public.company_documents
  for each row execute function public.set_updated_at();

comment on table public.company_documents is
  'The studio''s own paperwork — contrato social, CNPJ, policies, alvará, the '
  'business plan. Founder-only; never exposed to the portal and never part of '
  'a client export.';
