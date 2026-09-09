-- ============================================================================
-- 055 — progress from the whole board, and the indexes the queries wanted.
--
-- Two lists draw a progress bar per project, and both built it by reading the
-- tenant's tasks into memory and grouping in TypeScript — capped, like every
-- list read, at 500. Past 500 tasks PostgREST returns an arbitrary 500, so a
-- project's tasks could be partly or entirely absent: the card showed
-- "0% · 0 abertas" while that project's own page, which queries its tasks
-- directly, showed 40%. The same shape of bug as the account balances in 054,
-- and the same fix.
-- ============================================================================

create or replace function public.project_task_progress(p_tenant uuid)
returns table (
  project_id uuid,
  total integer,
  done integer
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    t.project_id,
    count(*)::integer,
    count(*) filter (where t.status = 'done')::integer
  from public.tasks t
  where t.tenant_id = p_tenant
    and t.project_id is not null
    and t.is_template = false
  group by t.project_id;
$$;

comment on function public.project_task_progress(uuid) is
  'Task counts per project across the whole board. security invoker, so RLS '
  'still applies.';

-- ── Indexes for the queries that were actually written ─────────────────────
--
-- 048 states the rule and 043 proved it: a lone (tenant_id) index covers the
-- filter and nothing of the ordering, and inside a single tenant it matches
-- almost every row. 049 and 051 then added three tables whose screens filter
-- and sort on columns no index reaches.

-- The invoicing screen: paid rows, newest first. Neither existing index helps
-- the filter or the sort — a full scan plus a sort, on the one screen the
-- whole invoicing feature exists to serve.
create index if not exists fin_receivables_paid_idx
  on public.fin_receivables (tenant_id, paid_on desc)
  where paid_on is not null;

-- The reconcile screen: unconfirmed lines, oldest first. The existing index
-- stops at confirmed_at and leaves the sort uncovered.
create index if not exists fin_import_lines_pending_date_idx
  on public.fin_import_lines (tenant_id, date)
  where confirmed_at is null;

-- Small tables, but the same argument, and consistency is the point: these
-- three are read on every finance page load.
create index if not exists fin_accounts_tenant_active_name_idx
  on public.fin_accounts (tenant_id, is_active, name);
create index if not exists fin_categories_tenant_sort_idx
  on public.fin_categories (tenant_id, sort);
create index if not exists fin_suppliers_tenant_name_idx
  on public.fin_suppliers (tenant_id, name);

-- The date-range read that replaced the "500 most recent" window in 054 needs
-- the range to be an index scan, not a filter over the tenant's whole ledger.
create index if not exists fin_entries_tenant_cash_range_idx
  on public.fin_entries (tenant_id, date_cash);
