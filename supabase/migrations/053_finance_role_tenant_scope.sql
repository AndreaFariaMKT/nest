-- ============================================================================
-- 053 — the accountant grant was untenanted.
--
-- 049, 050 and 051 all wrote the same permissive clause:
--
--   or exists (select 1 from tenant_members m
--               where m.user_id = auth.uid() and m.role = 'accountant')
--
-- which asks "is this person an accountant *somewhere*", not "is this person
-- an accountant of the tenant that owns this row".
--
-- The restrictive tenant floor does not close it, and that is the subtle part.
-- The floor asks whether the caller is a member of the row's tenant — any
-- membership, any role. So a person who is accountant of AFM and, say, social
-- of a second house passes the permissive clause (accountant somewhere) AND
-- the floor (member of this tenant) on the second house's rows: full read and
-- write over its ledger, its suppliers' CPF and PIX keys, its receivables.
--
-- Not reachable today — tenant_members holds one person with a role in both
-- houses, and she is the founder of both. It is one INSERT away from being
-- reachable, and finance is the wrong module to leave that in.
--
-- Note on the fix: inside the subquery, an unqualified `tenant_id` would bind
-- to `m.tenant_id` and compare the column to itself — a no-op that reads like
-- a fix. It has to name the outer table, which inside format() means %1$I.
-- ============================================================================

do $$
declare t text;
begin
  foreach t in array array[
    'fin_accounts', 'fin_categories', 'fin_suppliers', 'fin_entries',
    'fin_receivables', 'fin_payables', 'fin_fx_rates',
    'project_costs', 'fin_imports', 'fin_import_lines'
  ]
  loop
    execute format('drop policy if exists finance_staff_all on public.%I', t);
    execute format($f$
      create policy finance_staff_all on public.%1$I
        for all to authenticated
        using (
          public.is_owner()
          or exists (
            select 1 from public.tenant_members m
             where m.user_id = auth.uid()
               and m.role = 'accountant'
               and m.tenant_id = %1$I.tenant_id
          )
        )
        with check (
          public.is_owner()
          or exists (
            select 1 from public.tenant_members m
             where m.user_id = auth.uid()
               and m.role = 'accountant'
               and m.tenant_id = %1$I.tenant_id
          )
        )
    $f$, t);
  end loop;
end $$;

-- ── project_members needed 030's rule too ──────────────────────────────────
--
-- 048 gave `projects` a trigger asserting its tenant matches its client's, and
-- gave project_members nothing. So a membership row could be filed under one
-- tenant while pointing at another tenant's project. The app no longer writes
-- that shape (the delete and insert are tenant-scoped now), but the same
-- argument 030 made applies: the app filtering correctly is the reason this
-- has not happened, not the reason it cannot.

create or replace function public.project_members_tenant_matches_project()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select p.tenant_id from public.projects p where p.id = new.project_id)
     is distinct from new.tenant_id then
    raise exception 'project_members tenant_id must match its project tenant_id';
  end if;
  return new;
end;
$$;

drop trigger if exists project_members_tenant_guard on public.project_members;
create trigger project_members_tenant_guard
  before insert or update on public.project_members
  for each row execute function public.project_members_tenant_matches_project();

-- ── The commercials are not for everyone ───────────────────────────────────
--
-- 048 gave `projects` a policy admitting every non-portal role, which was
-- right when a project held a name, a type and a scope. 050 then put
-- service_value_cents, payment_terms, contract_url and proposal_url on the
-- same row, and nothing revisited the policy — so a designer could read the
-- value of every deal, and write it.
--
-- Split rather than locked: everyone internal keeps reading projects, because
-- tasks, the board and the flow all depend on it. Writing is founder, manager
-- and accountant.

drop policy if exists projects_staff_all on public.projects;

create policy projects_read on public.projects
  for select to authenticated
  using (not (select public.is_portal_user()));

create policy projects_write on public.projects
  for all to authenticated
  using (
    public.is_owner()
    or exists (
      select 1 from public.tenant_members m
       where m.user_id = auth.uid()
         and m.tenant_id = projects.tenant_id
         and m.role in ('manager', 'accountant')
    )
  )
  with check (
    public.is_owner()
    or exists (
      select 1 from public.tenant_members m
       where m.user_id = auth.uid()
         and m.tenant_id = projects.tenant_id
         and m.role in ('manager', 'accountant')
    )
  );

comment on policy projects_read on public.projects is
  'Every internal role reads: tasks, the board and the flow all resolve a '
  'project. Writing is narrower — see projects_write.';
