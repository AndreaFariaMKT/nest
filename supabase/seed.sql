-- ═══════════════════════════════════════════════════════════════════════════
-- Nest · local dev seed
--
--   DEV ONLY — runs on `supabase db reset`. Creates a predictable owner
--   user so the app is usable immediately without going through signup.
--
--   Credentials:  dev@nest.local / devpassword
-- ═══════════════════════════════════════════════════════════════════════════

do $$
declare
  dev_user_id uuid;
begin
  -- Idempotent: re-create only if missing
  select id into dev_user_id from auth.users where email = 'dev@nest.local';

  if dev_user_id is null then
    dev_user_id := gen_random_uuid();

    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, email_change,
      email_change_token_new, recovery_token
    ) values (
      '00000000-0000-0000-0000-000000000000',
      dev_user_id,
      'authenticated',
      'authenticated',
      'dev@nest.local',
      crypt('devpassword', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Dev Owner"}'::jsonb,
      now(), now(), '', '', '', ''
    );

    insert into auth.identities (
      id, user_id, identity_data, provider, provider_id,
      last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(),
      dev_user_id,
      format('{"sub":"%s","email":"dev@nest.local"}', dev_user_id)::jsonb,
      'email',
      dev_user_id::text,
      now(), now(), now()
    );
  end if;

  -- handle_new_user() trigger creates the profile.
  update public.profiles
     set role = 'owner', full_name = 'Dev Owner'
   where id = dev_user_id;

  -- The half that was missing, and the reason `supabase db reset` produced a
  -- login that could not use the app.
  --
  -- Since migration 013 the app resolves a role from `tenant_members`, not
  -- from `profiles.role`. With no membership row, mapStoredRole() fails closed
  -- to `client`, the guard redirects every internal route to /portal, and
  -- getPortalClient() returns null because the dev user is no client's
  -- portal_user_id — so a developer following the README landed on an empty
  -- "not linked yet" box with no way out but hand-written SQL.
  --
  -- Founder in both tenants, matching what the README promises.
  insert into public.tenant_members (tenant_id, user_id, role)
  select t.id, dev_user_id, 'founder'
    from public.tenants t
  on conflict (tenant_id, user_id) do update set role = 'founder';
end $$;
