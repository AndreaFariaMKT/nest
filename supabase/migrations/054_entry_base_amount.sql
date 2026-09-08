-- ============================================================================
-- 054 — an entry has to know what it was worth in reais.
--
-- 049 gave `fin_entries` an `amount_cents` and a `currency`, and every
-- aggregation then summed `amount_cents` across rows without reading the
-- currency. A USD 4.110,00 receipt added 411000 to the month's inflow and
-- rendered as R$ 4.110,00 — an 81% understatement, silent, with nothing on
-- screen to suggest it.
--
-- The fix is the one accounting has always used: record the functional-currency
-- amount AT THE TRANSACTION, from that day's rate, and aggregate on it. A rate
-- looked up later is a different number — the studio is not owed today's rate
-- on August's receipt.
--
-- Nullable on purpose. When no rate is on file for the day, the honest answer
-- is "not converted yet", not a guess: `openTotal` already refuses to invent
-- one and counts what it skipped, and the aggregations now do the same. A
-- constant or a 1:1 fallback produces a number that looks like money and is
-- wrong in the direction nobody checks.
-- ============================================================================

alter table public.fin_entries
  add column if not exists amount_brl_cents bigint;

-- Everything already in the ledger is BRL: the only writer hardcoded
-- `currency: 'BRL'`, which is the bug this migration exists alongside. So the
-- backfill is exact rather than an estimate.
update public.fin_entries
   set amount_brl_cents = amount_cents
 where amount_brl_cents is null
   and currency = 'BRL';

comment on column public.fin_entries.amount_brl_cents is
  'The entry in BRL cents at the rate of its cash date. Equal to amount_cents '
  'for a BRL row. NULL means no rate was on file — the aggregations skip it '
  'and report the count rather than guessing.';

create index if not exists fin_entries_tenant_accrual_brl_idx
  on public.fin_entries (tenant_id, date_accrual)
  where amount_brl_cents is not null;

-- ── Signs ──────────────────────────────────────────────────────────────────
--
-- `fin_payables.amount_cents` is an obligation and is meant to be positive —
-- `reconcile/actions.ts` flips it defensively with -Math.abs() precisely
-- because nothing enforced that. Someone copying the bank's sign types
-- -135000, the matcher still finds it, and then `openTotal` subtracts instead
-- of adding: the payable total drops by R$ 1.350 and working capital rises by
-- R$ 2.700. Same hazard, mirrored, on a negative receivable.

update public.fin_payables set amount_cents = abs(amount_cents)
 where amount_cents < 0;
update public.fin_receivables set amount_cents = abs(amount_cents)
 where amount_cents < 0;

alter table public.fin_payables
  drop constraint if exists fin_payables_amount_positive;
alter table public.fin_payables
  add constraint fin_payables_amount_positive check (amount_cents > 0);

alter table public.fin_receivables
  drop constraint if exists fin_receivables_amount_positive;
alter table public.fin_receivables
  add constraint fin_receivables_amount_positive check (amount_cents > 0);

comment on column public.fin_payables.amount_cents is
  'Always positive — an obligation, not a movement. The ledger entry that '
  'settles it carries the sign.';

-- ── Balances belong in SQL ─────────────────────────────────────────────────
--
-- `balancesByAccount` sums a page of entries in TypeScript, and the page was
-- the 500 most recent — so every account balance, the working capital built on
-- it and the runway built on that were the sum of a window, silently
-- understated the moment the ledger passed 500 rows. The file arguing that a
-- derived balance "cannot drift" was right about the arithmetic and wrong
-- about its input.
--
-- Aggregating in the database is the fix and it is the house pattern already:
-- 027 does the same for the month's social KPIs, and finance/contracts even
-- carries a comment explaining why a total must never be computed from a page.
--
-- Sums `amount_brl_cents`, so a USD entry contributes its converted value and
-- an entry with no rate on file contributes nothing — reported separately
-- rather than folded in as zero.
create or replace function public.fin_account_balances(p_tenant uuid)
returns table (
  account_id uuid,
  balance_cents bigint,
  unconverted integer
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    e.account_id,
    coalesce(sum(e.amount_brl_cents), 0)::bigint,
    count(*) filter (where e.amount_brl_cents is null)::integer
  from public.fin_entries e
  where e.tenant_id = p_tenant
    and e.account_id is not null
  group by e.account_id;
$$;

comment on function public.fin_account_balances(uuid) is
  'Account balances from the whole ledger, not from a page of it. security '
  'invoker, so RLS still applies — a caller who cannot read fin_entries gets '
  'no rows.';
