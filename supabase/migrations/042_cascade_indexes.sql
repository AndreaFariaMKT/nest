-- ============================================================================
-- Two indexes migration 037 missed.
--
-- `approvals` and `ai_edits` are both queried by `draft_id` on the draft edit
-- screen, and both cascade-delete from `content_drafts` — so deleting one
-- piece sequentially scans them. That is the same case 037 covered for
-- `scheduled_posts` and `creatives`; these two were overlooked.
--
-- Small today, like 037 was. The point is that they stop being small without
-- anyone noticing, and a cascade delete is the one query nobody thinks to
-- time.
-- ============================================================================

create index if not exists approvals_draft_idx
  on public.approvals (draft_id);

create index if not exists ai_edits_draft_idx
  on public.ai_edits (draft_id);
