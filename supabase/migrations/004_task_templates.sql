-- ═══════════════════════════════════════════════════════════════════════════
-- Nest · task templates
--
--   Task rows can be marked as templates. Templates are excluded from the
--   normal kanban/list views and cloned into concrete tasks by the cycles
--   cron whenever a brand-new cycle row lands for a client.
-- ═══════════════════════════════════════════════════════════════════════════

alter table tasks
  add column if not exists is_template boolean not null default false;

create index if not exists tasks_template_idx on tasks (is_template)
  where is_template = true;
