-- ============================================================================
-- Drop content_drafts.direction_ok.
--
-- A boolean written in four places and read in none. It duplicated
-- `approved_internal_at is not null` — and not faithfully: sending text back
-- up after a rejection cleared the flag but left approved_internal_at holding
-- the old date, which the production screen displays. So a piece resubmitted
-- after a rejection read "text approved" beside an approval that no longer
-- applied.
--
-- The application stopped writing it in efb96f0, and clears approved_internal_at
-- on both paths instead, so the date on screen is now true on its own.
--
-- This one is destructive and deliberate: a dropped column does not come back.
-- Nothing reads it, no view or policy references it, and the fact it carried
-- is derivable from the column that remains.
-- ============================================================================

alter table public.content_drafts
  drop column if exists direction_ok;
