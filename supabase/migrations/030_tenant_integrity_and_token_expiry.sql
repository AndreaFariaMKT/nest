-- ═══════════════════════════════════════════════════════════════════════════
-- 030 — tie every row to its client's tenant, and give portal links an end
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. A row's tenant must be its client's tenant ─────────────────────────
--
-- `tenant_id` is NOT NULL with a DEFAULT of the AFM tenant (013), and nothing
-- checked it against the client the row points at. RLS cannot catch this:
-- `tenant_isolation` is `is_tenant_member(tenant_id)`, and the founder is an
-- owner of BOTH tenants (013:41-45), so she passes for either value. A stale
-- form, a crafted POST, or an insert that simply omitted the column created a
-- piece filed under one tenant for another tenant's client — visible on the
-- wrong screens, counted in the wrong fortnight, invisible from the right one,
-- with no error at any layer.
--
-- This is the invariant worth spending a constraint on: it cannot be expressed
-- in RLS, and the application has no single choke point that could enforce it.
-- The composite FK reuses the unique index below, so the cost is one index.

alter table public.clients
  drop constraint if exists clients_id_tenant_key;
alter table public.clients
  add constraint clients_id_tenant_key unique (id, tenant_id);

-- Repair anything already misfiled before the constraints go on, or they will
-- refuse to validate. The client's tenant is the authority.
update public.content_drafts d
   set tenant_id = c.tenant_id
  from public.clients c
 where c.id = d.client_id and d.tenant_id <> c.tenant_id;

update public.media_assets m
   set tenant_id = c.tenant_id
  from public.clients c
 where c.id = m.client_id and m.tenant_id <> c.tenant_id;

update public.shared_logins l
   set tenant_id = c.tenant_id
  from public.clients c
 where c.id = l.client_id and l.tenant_id <> c.tenant_id;

do $$
declare t text;
begin
  foreach t in array array['content_drafts', 'media_assets', 'shared_logins']
  loop
    execute format(
      'alter table public.%I drop constraint if exists %I', t, t || '_client_tenant_fkey'
    );
    execute format(
      'alter table public.%I add constraint %I '
      || 'foreign key (client_id, tenant_id) '
      || 'references public.clients (id, tenant_id) on update cascade',
      t, t || '_client_tenant_fkey'
    );
  end loop;
end $$;

-- `messages` and `meetings` carry a NULLABLE client_id (the studio's own team
-- room, an internal meeting), and a composite FK with a null in it is trivially
-- satisfied — so the constraint would be there without constraining. Left off
-- deliberately rather than added for symmetry.

-- ── 2. Portal links expire ────────────────────────────────────────────────
--
-- clients.portal_token is 256 bits of real entropy, so guessing is not the
-- threat. Permanence is: the link grants anonymous read of a client's whole
-- schedule and their pending approval tokens, it gets forwarded, pasted into
-- chats and left in inboxes, and the only way to invalidate one was for
-- somebody to remember to press revoke. A link that never expires is one that
-- outlives the relationship it was issued for.
--
-- Null means "no expiry", which is what every existing token gets — expiring
-- live links on deploy would break the studio's clients mid-week with no
-- warning. New tokens are stamped by the app.

alter table public.clients
  add column if not exists portal_token_expires_at timestamptz;

comment on column public.clients.portal_token_expires_at is
  'When the /p/[token] link stops working. Null = no expiry (tokens minted '
  'before migration 030). Enforced in the page query, not by RLS: the route '
  'is anonymous and reads with the service role.';
