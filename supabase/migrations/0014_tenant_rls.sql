-- ============================================================================
-- Tenant isolation at the database (RLS).
--
-- Adds ONE restrictive policy per tenant-owned table. Restrictive policies are
-- AND-ed with the existing (permissive) role-based policies, so this hardens
-- isolation WITHOUT rewriting any existing policy: a row is only visible/
-- writable if the caller is a member of that row's tenant.
--
-- Service-role access (crons, public /a and /p token routes) bypasses RLS, so
-- those flows are unaffected. The app still scopes to the *active* tenant via
-- .eq("tenant_id", …); this policy is the security floor beneath that.
-- ============================================================================

do $$
declare
  t text;
begin
  foreach t in array array[
    'clients', 'client_contacts', 'client_members', 'client_services',
    'contracts', 'services', 'cycles', 'tasks', 'meetings', 'transcripts',
    'content_drafts', 'slides', 'creatives', 'scheduled_posts',
    'published_posts', 'post_metrics', 'approvals', 'monthly_reports',
    'brand_kits', 'brand_assets', 'templates', 'notes', 'ai_edits',
    'notifications'
  ]
  loop
    if to_regclass('public.' || t) is null then
      continue;
    end if;
    -- Only applies where a tenant_id column exists (added in 0013).
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = t and column_name = 'tenant_id'
    ) then
      continue;
    end if;

    execute format('drop policy if exists tenant_isolation on public.%I', t);
    execute format(
      'create policy tenant_isolation on public.%I '
      || 'as restrictive for all to authenticated '
      || 'using (public.is_tenant_member(tenant_id)) '
      || 'with check (public.is_tenant_member(tenant_id))',
      t
    );
  end loop;
end;
$$;
