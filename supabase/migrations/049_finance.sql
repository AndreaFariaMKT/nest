-- ============================================================================
-- 049 — the studio's own money.
--
-- Finance was one table and a sum: `contracts.monthly_value_cents`, with MRR
-- computed in memory on three different screens. There was nothing for a nota
-- fiscal, a payment, a receivable, a payable, a supplier, an expense, a bank
-- account, a transaction, a reconciliation, a tax or a currency conversion.
-- /finance rendered "Nenhum contrato ainda." and that was the whole product.
--
-- The distinction the rest of this file turns on, and the one that has to be
-- in the schema from the first day because retrofitting it is brutal: every
-- entry carries TWO dates.
--
--   date_cash    — when the money actually moved
--   date_accrual — which month the money BELONGS to (competência)
--
-- They are usually different and both are correct. August's invoice paid in
-- September is September's cash and August's revenue. "Balanço" is computed on
-- the first, "lucro" on the second, and the two are not supposed to agree —
-- the accountant works in competência and the bank works in cash. One date
-- column would force a choice between being wrong about profit and being wrong
-- about the balance.
--
-- Money is `bigint` cents, following contracts.monthly_value_cents and
-- @/lib/money — never a float. Currency is per row because the studio is paid
-- in USD by two clients and pays in BRL.
-- ============================================================================

-- ── Accounts ───────────────────────────────────────────────────────────────

create table if not exists public.fin_accounts (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null default '00000000-0000-0000-0000-0000000000af'
                references public.tenants (id) on delete cascade,

  name        text not null,
  institution text,
  currency    text not null default 'BRL' check (currency in ('BRL', 'USD')),

  -- The reserve is deliberately not part of working capital. It exists to not
  -- be spent, and folding it into the operating total is how a studio believes
  -- it has four months of runway when it has one.
  kind        text not null default 'operacional'
                check (kind in ('operacional', 'reserva')),

  is_active   boolean not null default true,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists fin_accounts_tenant_idx
  on public.fin_accounts (tenant_id);

-- ── Categories ─────────────────────────────────────────────────────────────

create table if not exists public.fin_categories (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null default '00000000-0000-0000-0000-0000000000af'
               references public.tenants (id) on delete cascade,

  name       text not null,
  slug       text not null,

  -- `transfer` earns its own value rather than being an expense with a
  -- matching income: moving money between the studio's own accounts is not a
  -- cost and must not land in "saída por categoria", or every month the
  -- reserve is topped up looks like a month of heavy spending.
  kind       text not null check (kind in ('income', 'expense', 'transfer')),

  sort       integer not null default 100,
  created_at timestamptz not null default now(),

  constraint fin_categories_slug_tenant_key unique (tenant_id, slug)
);

create index if not exists fin_categories_tenant_idx
  on public.fin_categories (tenant_id);

-- ── Suppliers ──────────────────────────────────────────────────────────────

create table if not exists public.fin_suppliers (
  id                   uuid primary key default gen_random_uuid(),
  tenant_id            uuid not null default '00000000-0000-0000-0000-0000000000af'
                         references public.tenants (id) on delete cascade,

  name                 text not null,
  category             text,

  -- Which one it is matters: recurring payments to a pessoa física can carry
  -- withholding that payments to a CNPJ do not, and the studio currently pays
  -- two people by CPF every month. Recording the distinction is the first step
  -- to answering it.
  doc_type             text check (doc_type in ('cpf', 'cnpj')),
  doc_number           text,
  pix_key              text,

  default_amount_cents bigint,
  pay_day              smallint check (pay_day between 1 and 31),

  -- Whether the invoice for their work has been collected and filed.
  note_status          text not null default 'pending'
                         check (note_status in ('pending', 'collected', 'not_required')),

  notes                text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index if not exists fin_suppliers_tenant_idx
  on public.fin_suppliers (tenant_id);

-- ── The ledger ─────────────────────────────────────────────────────────────

create table if not exists public.fin_entries (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null default '00000000-0000-0000-0000-0000000000af'
                 references public.tenants (id) on delete cascade,

  account_id   uuid references public.fin_accounts (id) on delete restrict,
  category_id  uuid references public.fin_categories (id) on delete set null,

  description  text not null,

  -- Signed: negative is money leaving. One column rather than a `direction`
  -- flag plus a magnitude, so summing a month is a sum and cannot be got wrong
  -- by forgetting to branch on the flag.
  amount_cents bigint not null,
  currency     text not null default 'BRL' check (currency in ('BRL', 'USD')),

  -- The two dates. See the header.
  date_cash    date not null,
  date_accrual date not null,

  -- What the money was for. All optional: a bank fee belongs to no client.
  client_id    uuid references public.clients (id) on delete set null,
  project_id   uuid references public.projects (id) on delete set null,
  supplier_id  uuid references public.fin_suppliers (id) on delete set null,

  -- Reconciliation state. `external_ref` is the bank's own identifier for the
  -- line, which is what makes an import idempotent.
  reconciled   boolean not null default false,
  external_ref text,

  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists fin_entries_tenant_cash_idx
  on public.fin_entries (tenant_id, date_cash desc);
create index if not exists fin_entries_tenant_accrual_idx
  on public.fin_entries (tenant_id, date_accrual desc);
create index if not exists fin_entries_account_idx
  on public.fin_entries (account_id);
create index if not exists fin_entries_project_idx
  on public.fin_entries (project_id);

-- Re-importing the same statement must not double the month. Partial, because
-- most entries are typed by hand and carry no bank reference at all.
create unique index if not exists fin_entries_external_ref_key
  on public.fin_entries (tenant_id, external_ref)
  where external_ref is not null;

-- ── Receivables and payables ───────────────────────────────────────────────

create table if not exists public.fin_receivables (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null default '00000000-0000-0000-0000-0000000000af'
                   references public.tenants (id) on delete cascade,

  client_id      uuid references public.clients (id) on delete set null,
  project_id     uuid references public.projects (id) on delete set null,
  contract_id    uuid references public.contracts (id) on delete set null,

  description    text not null,
  amount_cents   bigint not null,
  currency       text not null default 'BRL' check (currency in ('BRL', 'USD')),

  due_on         date not null,
  paid_on        date,
  date_accrual   date not null,

  status         text not null default 'open'
                   check (status in ('open', 'paid', 'late', 'cancelled')),

  -- A Brazilian client gets a nota fiscal; an American one is an export and
  -- gets none. `export` is a real terminal state here, not a way of saying
  -- "not done" — clients.country decides which.
  invoice_status text not null default 'pending'
                   check (invoice_status in ('pending', 'requested', 'issued', 'export')),
  invoice_ref    text,

  notes          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists fin_receivables_tenant_due_idx
  on public.fin_receivables (tenant_id, due_on);
create index if not exists fin_receivables_client_idx
  on public.fin_receivables (client_id);

create table if not exists public.fin_payables (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null default '00000000-0000-0000-0000-0000000000af'
                 references public.tenants (id) on delete cascade,

  supplier_id  uuid references public.fin_suppliers (id) on delete set null,
  category_id  uuid references public.fin_categories (id) on delete set null,
  project_id   uuid references public.projects (id) on delete set null,

  description  text not null,
  amount_cents bigint not null,
  currency     text not null default 'BRL' check (currency in ('BRL', 'USD')),

  due_on       date not null,
  paid_on      date,
  date_accrual date not null,

  status       text not null default 'open'
                 check (status in ('open', 'paid', 'late', 'cancelled')),

  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists fin_payables_tenant_due_idx
  on public.fin_payables (tenant_id, due_on);

-- ── Exchange rates ─────────────────────────────────────────────────────────
--
-- Per day, not one constant. The prototype carried a single 5.37 and listed
-- "câmbio por transação" as a known gap: a USD 4.110 receipt converted at the
-- wrong month's rate misstates revenue by more than the studio's monthly
-- accounting fee.

create table if not exists public.fin_fx_rates (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null default '00000000-0000-0000-0000-0000000000af'
               references public.tenants (id) on delete cascade,

  day        date not null,
  base       text not null default 'USD' check (base in ('USD', 'BRL')),
  quote      text not null default 'BRL' check (quote in ('USD', 'BRL')),

  -- numeric, not cents: this is a ratio, not an amount. 6 decimals is well
  -- past what any bank quotes.
  rate       numeric(14, 6) not null check (rate > 0),

  source     text,
  created_at timestamptz not null default now(),

  constraint fin_fx_rates_day_pair_key unique (tenant_id, day, base, quote)
);

create index if not exists fin_fx_rates_day_idx
  on public.fin_fx_rates (tenant_id, day desc);

-- ── RLS ────────────────────────────────────────────────────────────────────
--
-- Founder and accountant only, and never the portal. This is the studio's own
-- bank balance, its suppliers' documents and what every client pays — the
-- single most sensitive table set in the product. Each table gets the same
-- three policies: a permissive staff grant, the restrictive tenant floor from
-- 014, and the restrictive portal floor from 022/029/046.

do $$
declare t text;
begin
  foreach t in array array[
    'fin_accounts', 'fin_categories', 'fin_suppliers',
    'fin_entries', 'fin_receivables', 'fin_payables', 'fin_fx_rates'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);

    execute format('drop policy if exists finance_staff_all on public.%I', t);
    -- is_owner() covers the founder; the accountant role is checked through
    -- tenant_members, which is the table the app actually runs on (see 038 on
    -- why profiles.role is not it).
    execute format($f$
      create policy finance_staff_all on public.%I
        for all to authenticated
        using (
          public.is_owner()
          or exists (
            select 1 from public.tenant_members m
             where m.user_id = auth.uid() and m.role = 'accountant'
          )
        )
        with check (
          public.is_owner()
          or exists (
            select 1 from public.tenant_members m
             where m.user_id = auth.uid() and m.role = 'accountant'
          )
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

    execute format('drop trigger if exists %I_updated_at on public.%I', t, t);
  end loop;
end $$;

-- updated_at triggers, on the tables that carry the column.
create trigger fin_accounts_updated_at before update on public.fin_accounts
  for each row execute function public.set_updated_at();
create trigger fin_suppliers_updated_at before update on public.fin_suppliers
  for each row execute function public.set_updated_at();
create trigger fin_entries_updated_at before update on public.fin_entries
  for each row execute function public.set_updated_at();
create trigger fin_receivables_updated_at before update on public.fin_receivables
  for each row execute function public.set_updated_at();
create trigger fin_payables_updated_at before update on public.fin_payables
  for each row execute function public.set_updated_at();

-- ── Seed: the categories the studio already spends against ─────────────────
--
-- Taken from the real August close, so the first month in the system has
-- somewhere to put every line rather than starting with an empty picker.

insert into public.fin_categories (tenant_id, name, slug, kind, sort) values
  ('00000000-0000-0000-0000-0000000000af', 'Receita',        'receita',        'income',   10),
  ('00000000-0000-0000-0000-0000000000af', 'Reembolso',      'reembolso',      'income',   20),
  ('00000000-0000-0000-0000-0000000000af', 'Equipe',         'equipe',         'expense',  30),
  ('00000000-0000-0000-0000-0000000000af', 'Pró-labore',     'pro-labore',     'expense',  40),
  ('00000000-0000-0000-0000-0000000000af', 'Fornecedores',   'fornecedores',   'expense',  50),
  ('00000000-0000-0000-0000-0000000000af', 'Ferramentas',    'ferramentas',    'expense',  60),
  ('00000000-0000-0000-0000-0000000000af', 'Impostos',       'impostos',       'expense',  70),
  ('00000000-0000-0000-0000-0000000000af', 'Contabilidade',  'contabilidade',  'expense',  80),
  ('00000000-0000-0000-0000-0000000000af', 'Reserva',        'reserva',        'transfer', 90),
  ('00000000-0000-0000-0000-0000000000af', 'Transferência',  'transferencia',  'transfer', 100)
on conflict (tenant_id, slug) do nothing;

comment on table public.fin_entries is
  'The ledger. Two dates per row on purpose: date_cash is when the money '
  'moved, date_accrual is the month it belongs to. Balanço is computed on the '
  'first and lucro on the second, and they are not supposed to agree.';

comment on column public.fin_entries.amount_cents is
  'Signed cents — negative is money leaving. One column rather than a '
  'direction flag, so summing a month cannot be got wrong by forgetting to '
  'branch on the flag.';
