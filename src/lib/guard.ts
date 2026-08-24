import {
  APP_ROLES,
  isAppRole,
  mapStoredRole,
  type AppRole,
} from "@/lib/app-roles";
import { canUseSocial } from "@/lib/social";

const ROLES: readonly AppRole[] = APP_ROLES;

// Kept as named exports because callers and tests use these names. Both are
// now the shared implementation rather than a second copy of it — this file
// used to restate the eight roles and re-implement the legacy mapping, so a
// role added to roles.ts and not here would have been judged by a guard that
// had never heard of it.
export const isAppRoleValue = isAppRole;
export const mapLegacyRole = mapStoredRole;

/**
 * Sensitive routes and who may reach them. Anything not listed is allowed for
 * any internal (non-client) role — sub-features like the content-engine editor
 * stay reachable. Clients are hard-isolated to the portal below.
 */
const RESTRICTED: { prefix: string; roles: AppRole[] }[] = [
  { prefix: "/business-plan", roles: ["founder"] },
  { prefix: "/commercial", roles: ["founder"] },
  { prefix: "/finance", roles: ["founder", "accountant"] },
  { prefix: "/administration", roles: ["founder", "accountant"] },
  // /admin/* — the error log and the usage screen. This prefix was MISSING:
  // /administration is a different route, so everything under /admin was
  // reachable by every internal role at the middleware layer, saved only by
  // whatever each page checked for itself.
  { prefix: "/admin", roles: ["founder"] },
  // Derived, not restated: a hand-copied list drifts the first time a role's
  // responsibilities change. src/lib/social.ts is pure and Edge-safe.
  { prefix: "/social", roles: ROLES.filter(canUseSocial) },
];

function inPortal(base: string): boolean {
  return base === "/portal" || base.startsWith("/portal/");
}

/**
 * Given a locale-stripped path and the effective role, return a redirect target
 * (locale-stripped) if the role may NOT access it, or null if allowed.
 */
export function guardRedirect(base: string, role: AppRole): string | null {
  // Clients only ever see the portal.
  if (role === "client") return inPortal(base) ? null : "/portal";

  // The portal is client-only; internal staff go to their home.
  if (inPortal(base)) return "/today";

  for (const r of RESTRICTED) {
    if (base === r.prefix || base.startsWith(r.prefix + "/")) {
      if (!r.roles.includes(role)) return "/today";
    }
  }
  return null;
}
