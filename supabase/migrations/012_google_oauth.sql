-- ═══════════════════════════════════════════════════════════════════════════
-- Nest · Google OAuth tokens on profiles
--
--   Stores the per-user Google OAuth state so the app can call Calendar/Meet
--   on the user's behalf. We attach to `profiles` (not a separate table)
--   because each user can connect at most one Google account at a time, and
--   the refresh-token rotation pattern is simpler when it lives next to the
--   identity it represents.
--
--   `google_refresh_token` is the durable secret — never returned to the
--   client. The access token is also stored so we can avoid a refresh on
--   every API call; we refresh proactively when expires_at is within 60s.
-- ═══════════════════════════════════════════════════════════════════════════

alter table profiles
  add column if not exists google_refresh_token text,
  add column if not exists google_access_token text,
  add column if not exists google_token_expires_at timestamptz,
  add column if not exists google_email text,
  add column if not exists google_scopes text[];

comment on column profiles.google_refresh_token is
  'Long-lived Google OAuth refresh token. Server-only — never expose to client.';
comment on column profiles.google_access_token is
  'Short-lived (1h) Google OAuth access token. Refreshed on demand.';
comment on column profiles.google_token_expires_at is
  'Absolute expiry time for google_access_token. Refresh when within 60s.';
comment on column profiles.google_email is
  'The Google account email the user authorised — for display + reconnect prompts.';
comment on column profiles.google_scopes is
  'Granted OAuth scopes; lets the app detect insufficient consent without an API call.';
