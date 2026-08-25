/**
 * Brand theme. Pure module (no server-only imports).
 *
 * This used to carry a cookie name, a default, a label map and a type guard,
 * for a theme switcher that no longer exists: the theme comes from
 * `tenant.theme` now, resolved from membership in the layout. Only the
 * vocabulary survives, and THEMES survives only because the type derives
 * from it.
 */
const THEMES = ["nest", "afm"] as const;
export type Theme = (typeof THEMES)[number];

/**
 * The theme now arrives from `tenants.theme` rather than a constant, so it is
 * a string from the database and has to be checked before it selects a
 * stylesheet and a logo.
 */
export function isTheme(v: string | null | undefined): v is Theme {
  return v === "nest" || v === "afm";
}
