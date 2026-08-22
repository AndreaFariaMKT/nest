-- ============================================================================
-- Social media module · part 1 of 2 — enum values only.
--
-- `ALTER TYPE ... ADD VALUE` may not USE the new value in the same transaction,
-- so the three additions live in their own migration. Apply it with plain
-- autocommit psql (the documented command) and never wrap it in BEGIN/COMMIT:
--
--   psql "$DATABASE_URL" -f supabase/migrations/019_social_status_enum.sql
--
-- The pipeline the module runs on, in order:
--   backlog → draft (writing) → text_review (direction) → creative_review
--   (design) → client_review (client) → changes_requested | rejected →
--   approved → scheduled → published → archived
--
-- Everything before `draft` and after `client_review` is new; the middle is the
-- flow the content engine already used, so existing screens keep working.
-- ============================================================================

alter type content_status add value if not exists 'backlog' before 'draft';
alter type content_status add value if not exists 'changes_requested' after 'client_review';
alter type content_status add value if not exists 'rejected' after 'changes_requested';
