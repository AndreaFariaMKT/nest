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
