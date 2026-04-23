-- 009_portal_token.sql
-- Add a token that grants read-only access to the client portal at /p/[token].
-- Token is 64 hex chars (32 random bytes), nullable so existing clients stay
-- inert until Andréa generates one explicitly.

alter table clients
  add column if not exists portal_token text;

create unique index if not exists clients_portal_token_key
  on clients (portal_token)
  where portal_token is not null;

comment on column clients.portal_token is
  'Public portal access token (64 hex chars). Generate via the owner action; share with the client.';
