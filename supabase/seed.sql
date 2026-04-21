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

  -- handle_new_user() trigger creates the profile; promote to owner
  update public.profiles
     set role = 'owner', full_name = 'Dev Owner'
   where id = dev_user_id;
end $$;
