-- 008_reels.sql
-- Reels support: a generated voiceover script + (optionally) the final
-- edited video URL. We reuse `content_drafts` rather than introducing a
-- new table — a Reel is just a draft with a script + video, no slides.

alter table content_drafts
  add column if not exists video_script text,
  add column if not exists video_url text;

comment on column content_drafts.video_script is
  'Claude-generated voiceover script for Reels / short-form video.';

comment on column content_drafts.video_url is
  'Uploaded final video URL (Supabase Storage public URL or external).';
