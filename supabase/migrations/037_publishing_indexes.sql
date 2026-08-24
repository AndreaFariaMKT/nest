-- ═══════════════════════════════════════════════════════════════════════════
-- 037 — three indexes the publishing path walks without one
--
-- All small at today's row counts. They are here because each serves a query
-- on a hot path, and two of them serve a CASCADE DELETE — which is the case
-- that degrades first and least visibly, since nobody watches how long a
-- delete takes until it starts timing out.
-- ═══════════════════════════════════════════════════════════════════════════

-- enqueueForPublish clears pending rows before re-queueing (so a date change
-- cannot leave two instants queued), runTransitionAction clears them when a
-- piece leaves `scheduled`, and content_drafts cascades here on delete.
-- scheduled_posts has (scheduled_for) where pending, and (tenant_id) — neither
-- leads with draft_id.
create index if not exists scheduled_posts_draft_status_idx
  on public.scheduled_posts (draft_id, status);

-- The creatives(image_url, version) embed on the piece record, which PostgREST
-- resolves by slide_id, and the cascade from slides that clearArtwork fires:
-- deleting a piece's slides currently seq-scans creatives once per slide.
create index if not exists creatives_slide_idx
  on public.creatives (slide_id);

-- getCurrentTenant, getActualRole and the middleware guard all filter
-- tenant_members by user_id ALONE, and the primary key is (tenant_id, user_id)
-- — the wrong leading column. Covering, so these become index-only scans.
--
-- Honest about the size: this table has a handful of rows, so the seq scan it
-- does today costs microseconds. It is here because it is the app's single
-- most-executed query — every request through the middleware — and free
-- hygiene on that is worth a line.
create index if not exists tenant_members_user_idx
  on public.tenant_members (user_id, tenant_id, role);
