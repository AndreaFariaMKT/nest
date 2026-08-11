-- ============================================================================
-- Expand tenant_members.role to the app's 8 view-roles.
--
-- The app already maps legacy values (owner/admin -> founder, member ->
-- manager) at runtime, so this migration is not required for the app to work —
-- it just makes the stored values canonical and lets you assign granular roles
-- (social, designer_*, developer, accountant, client) to real staff logins.
-- ============================================================================

alter table public.tenant_members
  drop constraint if exists tenant_members_role_check;

-- Migrate existing values to the new vocabulary.
update public.tenant_members set role = 'founder' where role in ('owner', 'admin');
update public.tenant_members set role = 'manager' where role = 'member';

alter table public.tenant_members
  add constraint tenant_members_role_check
  check (role in (
    'founder', 'manager', 'social', 'designer_social',
    'designer_identity', 'developer', 'accountant', 'client'
  ));

alter table public.tenant_members alter column role set default 'manager';
