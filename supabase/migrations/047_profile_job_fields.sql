-- Job title and department on a person's profile.
--
-- The team screen showed three things about a colleague: name, email, and the
-- role select. "Role" there is the *permission* role — founder, manager,
-- designer_identity — which answers what someone may open, not what they do.
-- Those are different questions, and the studio was reading the first as an
-- answer to the second.
--
-- Free text on purpose. A department enum would need a migration every time
-- the studio renames a team, and the set is small enough to read at a glance
-- without one.

alter table public.profiles
  add column if not exists job_title text,
  add column if not exists department text;

-- Column privileges in PostgreSQL are ADDITIVE — this is the trap 033 wrote
-- itself to document. 033 replaced the table-wide grant on profiles with an
-- explicit column list so the google_* secrets would stop being world-readable
-- to every staff session. That list is now the whole of what `authenticated`
-- may read, which means a column added later is invisible until it is named
-- here: the team page would have selected job_title and received a permission
-- error, not a null.
grant select (job_title, department) on public.profiles to authenticated;

-- Writable by the person themselves. The self-update policy from 025 already
-- constrains this to `id = auth.uid()` and pins `role` to its current value,
-- so the narrow grant is all that is needed for someone to fill in their own
-- title. Invites write through the service role, which bypasses grants.
grant update (job_title, department) on public.profiles to authenticated;

comment on column public.profiles.job_title is
  'What the person does — "Designer de identidade", "Gestao financeira". Free '
  'text, and distinct from tenant_members.role, which is the permission set.';

comment on column public.profiles.department is
  'Which team they sit in. Free text; a small enough set to read without an '
  'enum, and renaming a team should not need a migration.';
