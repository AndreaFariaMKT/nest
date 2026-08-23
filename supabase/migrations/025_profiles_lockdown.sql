-- ═══════════════════════════════════════════════════════════════════════════
-- 025 — profiles: stop self-promotion, and stop outsiders reading staff rows
--
-- Two holes in the same table, both dating to 001, both reachable from a
-- browser console with the anon key. Neither needs an exploit beyond knowing
-- the endpoint exists.
--
--   1. `profiles: self update` was `for update using (id = auth.uid())` with
--      no WITH CHECK and no column restriction. PostgreSQL falls back to the
--      USING expression for the check, and `id` is unchanged by a role edit —
--      so `PATCH /rest/v1/profiles?id=eq.<me> {"role":"owner"}` was accepted.
--      `is_owner()` is defined purely as `profiles.role = 'owner'`, and
--      `has_client_access()` short-circuits on it, so that one request handed
--      any logged-in user — a portal client included — write access to every
--      client's contracts, brand kits, media and shared_logins in their tenant.
--
--   2. `profiles: read` is `using (auth.role() = 'authenticated')`, and 012
--      later added `google_refresh_token` to this table with a comment saying
--      "never expose to client". A portal client could read every staff row,
--      which means a live Google OAuth refresh token scoped to calendar and
--      Meet transcripts. profiles is in no tenant list, so this crossed tenants.
--
-- Both policies are replaced rather than patched: RLS has no ALTER for the
-- expression, and drop-then-create keeps this file re-runnable.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. A user may edit their own row, but not their own authority ──────────
-- Everything the app actually self-updates (full_name, avatar_url, locale)
-- still passes. The role and the Google credentials move only under the
-- service role, which is already how google/callback and settings/actions
-- write them.
drop policy if exists "profiles: self update" on public.profiles;
create policy "profiles: self update" on public.profiles
  for update
  using (id = auth.uid())
  with check (
    id = auth.uid()
    and role = (select p.role from public.profiles p where p.id = auth.uid())
  );

-- Belt to the braces above: even if a future policy is written carelessly,
-- the column grant itself refuses. Service role bypasses grants entirely.
revoke update (role) on public.profiles from authenticated;

-- ── 2. A portal client sees only their own profile row ─────────────────────
-- Restrictive, so it AND-s with the permissive read grant instead of having to
-- rewrite it — the same shape 022 used, and for the same reason: internal
-- staff still need to read each other to put names on messages and tasks.
--
-- One visible consequence, and it is the only one: portal/messages names its
-- senders from this table, so staff names in the client chat fall back to the
-- "Estudio" label the page already has at `nameOf.get(...) || t("chat.studio")`.
-- No crash, no empty screen. If the studio wants real names there, expose them
-- through a view of (id, full_name) rather than reopening the whole row.
--
-- This does NOT stop staff reading each other's google_* columns. Closing that
-- needs `revoke select (google_refresh_token, ...)`, which breaks
-- getCurrentProfile()'s `select("*")` — so it belongs with that code change,
-- not in a migration that must be safe to apply on its own.
drop policy if exists "profiles portal floor" on public.profiles;
create policy "profiles portal floor" on public.profiles
  as restrictive
  for select
  to authenticated
  using (
    not (select public.is_portal_user())
    or id = auth.uid()
  );

comment on policy "profiles portal floor" on public.profiles is
  'Portal clients read only their own profile. Staff are unaffected.';
