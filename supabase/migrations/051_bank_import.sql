-- ============================================================================
-- 051 — bank statements, and the staging they land in.
--
-- The rule this table exists to enforce: nothing from a bank file becomes a
-- ledger entry without a person agreeing. An import writes rows HERE, the
-- screen shows what it thinks each line is, and only a confirmation moves it
-- into fin_entries.
--
-- Staging rather than writing straight through is the whole design. An OFX
-- with a mis-parsed column, a statement pulled for the wrong account, a
-- duplicate month — all of those are recoverable while they are import lines
-- and permanent once they are ledger entries.
-- ============================================================================

create table if not exists public.fin_imports (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null default '00000000-0000-0000-0000-0000000000af'
                  references public.tenants (id) on delete cascade,

  account_id    uuid references public.fin_accounts (id) on delete set null,

  filename      text not null,
  format        text not null default 'ofx' check (format in ('ofx', 'csv', 'manual')),

  -- What the file covered, as read from it. Lets the screen say "this is
  -- August" rather than making someone infer it from the rows.
  period_start  date,
  period_end    date,

  line_count    integer not null default 0,
  imported_by   uuid references public.profiles (id) on delete set null,

  created_at    timestamptz not null default now()
);

create index if not exists fin_imports_tenant_idx
  on public.fin_imports (tenant_id, created_at desc);

create table if not exists public.fin_import_lines (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null default '00000000-0000-0000-0000-0000000000af'
                  references public.tenants (id) on delete cascade,

  import_id     uuid not null references public.fin_imports (id) on delete cascade,

  -- Straight from the file.
  external_ref  text,
  date          date not null,
  description   text not null,
  amount_cents  bigint not null,

  -- What the matcher proposed. `match_kind` mirrors @/lib/reconcile exactly;
  -- `match_reasons` is why it is not `auto`, so the screen can explain itself
  -- instead of showing an unexplained amber badge.
  match_kind    text not null default 'unmatched'
                  check (match_kind in ('auto', 'suggested', 'unmatched')),
  match_reasons text[] not null default '{}',

  -- What it was matched TO, when anything.
  matched_kind  text check (matched_kind in ('receivable', 'payable', 'entry')),
  matched_id    uuid,

  -- Set when a person confirms. Until then this line has changed nothing.
  confirmed_at  timestamptz,
  entry_id      uuid references public.fin_entries (id) on delete set null,

  created_at    timestamptz not null default now()
);

create index if not exists fin_import_lines_import_idx
  on public.fin_import_lines (import_id);
create index if not exists fin_import_lines_pending_idx
  on public.fin_import_lines (tenant_id, confirmed_at);

-- The same guard fin_entries has, one step earlier: a statement pulled twice
-- must not stage the same movement twice either.
create unique index if not exists fin_import_lines_ref_key
  on public.fin_import_lines (tenant_id, external_ref)
  where external_ref is not null;

-- RLS, matching 049: founder and accountant, never the portal.
do $$
declare t text;
begin
  foreach t in array array['fin_imports', 'fin_import_lines']
  loop
    execute format('alter table public.%I enable row level security', t);

    execute format('drop policy if exists finance_staff_all on public.%I', t);
    execute format($f$
      create policy finance_staff_all on public.%I
        for all to authenticated
        using (
          public.is_owner()
          or exists (select 1 from public.tenant_members m
                      where m.user_id = auth.uid() and m.role = 'accountant')
        )
        with check (
          public.is_owner()
          or exists (select 1 from public.tenant_members m
                      where m.user_id = auth.uid() and m.role = 'accountant')
        )
    $f$, t);

    execute format('drop policy if exists tenant_isolation on public.%I', t);
    execute format($f$
      create policy tenant_isolation on public.%I
        as restrictive for all to authenticated
        using (public.is_tenant_member(tenant_id))
        with check (public.is_tenant_member(tenant_id))
    $f$, t);

    execute format('drop policy if exists portal_no_finance on public.%I', t);
    execute format($f$
      create policy portal_no_finance on public.%I
        as restrictive for all to authenticated
        using (not (select public.is_portal_user()))
        with check (not (select public.is_portal_user()))
    $f$, t);
  end loop;
end $$;

comment on table public.fin_import_lines is
  'Staging for a bank statement. A line here has changed nothing until '
  'confirmed_at is set — the import proposes, a person disposes. Recoverable '
  'while staged; permanent once it becomes a fin_entries row.';
