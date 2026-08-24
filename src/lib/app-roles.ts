/**
 * The role vocabulary, and nothing else.
 *
 * This used to live in roles.ts alongside the sidebar map — which imports React
 * icon components, so it cannot run in Edge middleware or be imported by a
 * plain unit test. The list was therefore copied into guard.ts, where it sat as
 * a second source of truth for who the app's roles are: add a ninth role to one
 * file and the other silently keeps deciding permissions from eight.
 *
 * Pure, no imports, safe everywhere. roles.ts re-exports these so existing
 * imports keep working.
 */
export const APP_ROLES = [
  "founder",
  "manager",
  "social",
  "designer_social",
  "designer_identity",
  "developer",
  "accountant",
  "client",
] as const;

export type AppRole = (typeof APP_ROLES)[number];

export function isAppRole(v: string | undefined | null): v is AppRole {
  return !!v && (APP_ROLES as readonly string[]).includes(v);
}

/**
 * Map any stored tenant_members.role value onto an app role.
 *
 * Fails closed. The legacy values are named explicitly so they keep meaning
 * what they meant; anything else — including the null a user with no
 * membership row produces — lands on `client`, the role that reaches nothing.
 */
export function mapStoredRole(role: string | null | undefined): AppRole {
  if (isAppRole(role)) return role;
  if (role === "owner" || role === "admin") return "founder";
  if (role === "member" || role === "staff") return "manager";
  return "client";
}
