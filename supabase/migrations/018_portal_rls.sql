-- ============================================================================
-- Client-portal RLS.
--
-- A "client" login must read ITS OWN client's data. The base policies only
-- grant staff/owner access, so add permissive policies that let a client read
-- rows tied to the clients row they're linked to (clients.portal_user_id).
-- These OR with existing policies; the restrictive tenant_isolation floor (014)
-- still applies (a client is a tenant member, so it passes).
-- ============================================================================

create or replace function public.owns_portal_client(target_client uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.clients c
    where c.id = target_client and c.portal_user_id = auth.uid()
  );
$$;

drop policy if exists "portal reads own client" on public.clients;
create policy "portal reads own client" on public.clients
  for select using (portal_user_id = auth.uid());

drop policy if exists "portal reads meetings" on public.meetings;
create policy "portal reads meetings" on public.meetings
  for select using (public.owns_portal_client(client_id));

drop policy if exists "portal reads contracts" on public.contracts;
create policy "portal reads contracts" on public.contracts
  for select using (public.owns_portal_client(client_id));

drop policy if exists "portal reads content" on public.content_drafts;
create policy "portal reads content" on public.content_drafts
  for select using (public.owns_portal_client(client_id));

drop policy if exists "portal reads messages" on public.messages;
create policy "portal reads messages" on public.messages
  for select using (public.owns_portal_client(client_id));

drop policy if exists "portal writes messages" on public.messages;
create policy "portal writes messages" on public.messages
  for insert with check (
    public.owns_portal_client(client_id) and sender_id = auth.uid()
  );
