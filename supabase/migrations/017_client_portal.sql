-- ============================================================================
-- Authenticated client portal.
--
-- A "client" login is linked to exactly one clients row via portal_user_id, so
-- the portal can scope everything to that client. messages gains a nullable
-- client_id so the same table carries both the internal team channel
-- (client_id is null) and per-client chat (client_id set).
-- ============================================================================

alter table public.clients
  add column if not exists portal_user_id uuid references auth.users (id) on delete set null;

create unique index if not exists clients_portal_user_idx
  on public.clients (portal_user_id)
  where portal_user_id is not null;

alter table public.messages
  add column if not exists client_id uuid references public.clients (id) on delete cascade;

create index if not exists messages_client_idx
  on public.messages (client_id, created_at desc);
