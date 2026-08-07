/**
 * "View as" is a UI-level preview: an owner can see the app as a lower-privilege
 * role would. It NEVER changes data access — Row-Level Security still governs
 * every query. It only adjusts what surfaces are shown.
 *
 * Pure module (no server-only imports) so it's safe in client components.
 */
export const VIEW_AS_ROLES = ["owner", "staff", "client"] as const;
export type ViewAsRole = (typeof VIEW_AS_ROLES)[number];

export const VIEW_AS_COOKIE = "nest-view-as";

export function isViewAsRole(v: string | undefined): v is ViewAsRole {
  return v === "owner" || v === "staff" || v === "client";
}

/** The role the UI should render for, combining the actual role and preview. */
export function effectiveRole(
  actualRole: string,
  viewAs: ViewAsRole | null,
): ViewAsRole {
  if (viewAs) return viewAs;
  return actualRole === "owner" ? "owner" : "staff";
}
