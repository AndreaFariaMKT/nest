-- ============================================================================
-- 050 — the money side of a project, and what it costs to deliver.
--
-- 048 gave a project its identity — type, scope, team, dates. The brief also
-- asks for its commercials: "Contrato, Proposta, dados fiscais, valor do
-- serviço, formas e datas dos pagamentos acordados, custos do contrato
-- (fornecedor e a % repassada)".
--
-- The fiscal data half of that sentence already landed on `clients` in 048,
-- where it belongs. This is the half that is genuinely per engagement: what
-- this piece of work sells for, on what terms, and what the studio pays out to
-- deliver it.
--
-- The last clause is the one that earns a table. A cost is not a number on the
-- project — it is a supplier, an amount, and the share of the contract being
-- passed through to them, and there is more than one per project.
-- ============================================================================

alter table public.projects
  -- Where the signed paper lives. A URL rather than a bytea: Storage already
  -- holds every other document in this product.
  add column if not exists contract_url text,
  add column if not exists proposal_url text,

  -- What the engagement sells for, in the currency it is billed in. Nullable:
  -- an internal project has no price, and a retainer's value lives on
  -- `contracts` where the recurrence is modelled.
  add column if not exists service_value_cents bigint,
  add column if not exists currency text not null default 'BRL'
    check (currency in ('BRL', 'USD')),

  -- Free text, deliberately. "50% na assinatura, 50% na entrega" and "3x
  -- mensais a partir de outubro" are both real and neither survives being
  -- forced into columns. The dates that matter operationally become rows in
  -- fin_receivables, which is where a cobrança can actually be chased.
  add column if not exists payment_terms text;

comment on column public.projects.service_value_cents is
  'The one-off value of this engagement, in cents of `currency`. Recurring '
  'revenue lives on contracts; this is the project fee.';

comment on column public.projects.payment_terms is
  'The agreed terms as written. Operational due dates live in '
  'fin_receivables — this is the sentence the contract says.';

-- ── What it costs to deliver ───────────────────────────────────────────────

create table if not exists public.project_costs (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null default '00000000-0000-0000-0000-0000000000af'
                     references public.tenants (id) on delete cascade,

  project_id       uuid not null references public.projects (id) on delete cascade,
  supplier_id      uuid references public.fin_suppliers (id) on delete set null,

  description      text not null,

  -- Two ways to express the same commitment, because the studio uses both: a
  -- fixed fee to a designer, or a percentage of the contract passed through.
  -- Exactly one of them is set — the CHECK below refuses a row that says both
  -- or neither, which is the state that makes a cost total unanswerable.
  amount_cents     bigint,
  percent_passed   numeric(5, 2) check (percent_passed > 0 and percent_passed <= 100),

  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  constraint project_costs_one_basis check (
    (amount_cents is not null and percent_passed is null)
    or (amount_cents is null and percent_passed is not null)
  )
);

create index if not exists project_costs_project_idx
  on public.project_costs (project_id);
create index if not exists project_costs_tenant_idx
  on public.project_costs (tenant_id);
create index if not exists project_costs_supplier_idx
  on public.project_costs (supplier_id);

alter table public.project_costs enable row level security;

-- Same three-policy shape as 049: finance is founder and accountant only, and
-- never the portal. A client must not read the margin on their own project.
drop policy if exists project_costs_staff_all on public.project_costs;
create policy project_costs_staff_all on public.project_costs
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
  );

drop policy if exists tenant_isolation on public.project_costs;
create policy tenant_isolation on public.project_costs
  as restrictive for all to authenticated
  using (public.is_tenant_member(tenant_id))
  with check (public.is_tenant_member(tenant_id));

drop policy if exists portal_no_project_costs on public.project_costs;
create policy portal_no_project_costs on public.project_costs
  as restrictive for all to authenticated
  using (not (select public.is_portal_user()))
  with check (not (select public.is_portal_user()));

drop trigger if exists project_costs_updated_at on public.project_costs;
create trigger project_costs_updated_at
  before update on public.project_costs
  for each row execute function public.set_updated_at();

comment on table public.project_costs is
  'What the studio pays out to deliver one engagement — a supplier and either '
  'a fixed amount or a share of the contract passed through, never both. More '
  'than one per project, which is why it is a table and not columns.';
