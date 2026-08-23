-- ═══════════════════════════════════════════════════════════════════════════
-- 026 — content_drafts: say which workflow a row belongs to
--
-- `content_drafts.status` carries two state machines. The content engine writes
-- 'draft' → 'approved' → 'scheduled' → 'published'; the social module runs its
-- own eleven-stage pipeline over the same column on the same table.
--
-- Nothing distinguished them. `listPieces` reads every draft in the tenant and
-- keeps anything `isSocialStage()` accepts — which is every value except
-- 'archived' — and `clients.social_enabled` defaults to true, so every
-- content-engine draft has been showing up on the social module's backlog,
-- production and publishing screens, wearing this file's predecessor's
-- defaults: design_state 'todo' ("needs drawing"), direction_ok false
-- ("direction not approved"), and backlog_added_on set to the day 020 ran.
-- A post that went live weeks ago reads as work nobody has started.
--
-- A column, not a table split. Splitting would mean forking published_posts,
-- slides, creatives, approvals and scheduled_posts — all of which reference
-- draft_id — and migrating live rows. `where engine = 'social'` buys the
-- separation that matters for a fraction of that.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.content_drafts
  add column if not exists engine text not null default 'social';

do $$
begin
  alter table public.content_drafts
    add constraint content_drafts_engine_check
    check (engine in ('social', 'content'));
exception
  when duplicate_object then null;
end $$;

comment on column public.content_drafts.engine is
  'Which workflow owns this row''s status: ''social'' (the eleven-stage module) '
  'or ''content'' (the transcript-to-carousel engine). Screens filter on it.';

-- Backfill. A content-engine draft is one that came from a transcript, or that
-- has slide rows — both are things the social module never creates. Social
-- pieces carry a slide COUNT on the row and no `slides` children, and are
-- never derived from a transcript.
--
-- Convergent: re-running only re-asserts the same rows. Any row this misses
-- reads as 'social', which is the visible failure (it appears on a screen it
-- should not) rather than the silent one.
update public.content_drafts d
   set engine = 'content'
 where d.engine <> 'content'
   and (
     d.transcript_id is not null
     or exists (select 1 from public.slides s where s.draft_id = d.id)
   );

create index if not exists content_drafts_engine_status_idx
  on public.content_drafts (tenant_id, engine, status);
