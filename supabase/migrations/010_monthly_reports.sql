-- 010_monthly_reports.sql
-- Store Claude-generated monthly recap reports so Andréa can send them to
-- clients without re-running the model. `content` is a structured JSON blob
-- with { summary, highlights[], lessons[], nextPillars[], ... }.

create table if not exists monthly_reports (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  year int not null,
  month int not null check (month between 1 and 12),
  generated_by uuid references profiles(id) on delete set null,
  content jsonb not null,
  model text,
  generated_at timestamptz not null default now(),
  unique (client_id, year, month)
);

create index if not exists monthly_reports_client_idx
  on monthly_reports (client_id, year desc, month desc);

alter table monthly_reports enable row level security;

drop policy if exists "monthly_reports: read" on monthly_reports;
create policy "monthly_reports: read" on monthly_reports
  for select using (has_client_access(client_id));

drop policy if exists "monthly_reports: owner writes" on monthly_reports;
create policy "monthly_reports: owner writes" on monthly_reports
  for all using (is_owner()) with check (is_owner());

comment on table monthly_reports is
  'Claude-generated monthly recap reports — one per (client, year, month).';
