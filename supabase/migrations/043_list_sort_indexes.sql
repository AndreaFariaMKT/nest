-- ============================================================================
-- The sort half of every list query.
--
-- Migration 013 gave every tenant-scoped table a single-column `(tenant_id)`
-- index when it added the column. That covers the filter and nothing else —
-- and inside a single tenant it barely covers that, because in a
-- single-studio table `tenant_id` matches nearly every row. Postgres reads
-- what it can, then sorts the result on its own.
--
-- Every screen in this app is "the tenant's rows, in an order": clients by
-- name, meetings by date, contracts by start, the board by due date. Each one
-- pays for a sort that an index could have supplied. These are the composite
-- `(tenant_id, <sort column>)` indexes those screens actually want — the same
-- shape `messages_tenant_created_idx` already uses.
--
-- Paired with the pagination work: `.range()` on an unsorted read still has
-- to sort the whole table before it can discard all but thirty rows, so the
-- pager only stops the transfer, not the scan. This is the half that stops
-- the scan.
-- ============================================================================

-- The meetings screen splits future from past (`starts_at >= now` and
-- `< now`, opposite sorts) and the calendar reads a month range. All three are
-- this one index.
create index if not exists meetings_tenant_starts_idx
  on public.meetings (tenant_id, starts_at);

-- The clients list sorts by name, and so does every client picker on every
-- form.
create index if not exists clients_tenant_name_idx
  on public.clients (tenant_id, name);

-- Finance and Administration both read contracts newest-first.
create index if not exists contracts_tenant_starts_idx
  on public.contracts (tenant_id, starts_on desc);

-- The scheduling table. `scheduled_posts_due_idx` already covers the publish
-- cron, but it is partial (`where status = 'pending'`) and so cannot serve the
-- screen, which lists every status.
create index if not exists scheduled_posts_tenant_due_idx
  on public.scheduled_posts (tenant_id, scheduled_for);

-- `content_drafts_engine_status_idx` is (tenant_id, engine, status) — right
-- for the filter, no help for the sort the content calendar applies after it.
create index if not exists content_drafts_tenant_engine_updated_idx
  on public.content_drafts (tenant_id, engine, updated_at desc);

-- The board and the overview both filter on `is_template` and sort by due
-- date. `tasks_template_idx` is partial on `is_template = true`, which is the
-- template list — the opposite of what both screens read.
create index if not exists tasks_tenant_template_due_idx
  on public.tasks (tenant_id, is_template, due_at);

-- The studio-wide media library. `media_assets_client_idx` already covers one
-- client's; this covers the unfiltered view.
create index if not exists media_assets_tenant_captured_idx
  on public.media_assets (tenant_id, captured_on desc);

create index if not exists services_tenant_name_idx
  on public.services (tenant_id, name);

-- The highest-frequency query in the product: the notification bell is in the
-- app layout, so this runs on every page load of every screen. The existing
-- `notifications_user_idx` is (user_id, read_at), which serves the unread
-- count beside it but leaves this one sorting.
create index if not exists notifications_user_created_idx
  on public.notifications (user_id, created_at desc);
