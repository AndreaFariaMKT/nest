import {
  APP_ROLES,
  isAppRole,
  mapStoredRole,
  type AppRole,
} from "@/lib/app-roles";
import {
  canReachSocialPath,
  canUseSocial,
  firstSocialScreen,
} from "@/lib/social";

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
  // Connects the studio's own Google account and holds its tokens. It had no
  // nav entry, so nothing pointed at it and nothing guarded it either — every
  // internal role could reach it by typing the path.
  { prefix: "/settings", roles: ["founder"] },
  // Projects carry the commercials — 050 put service_value_cents,
  // payment_terms, contract_url and proposal_url on the row — and the RLS
  // policy admits every non-portal role, because it was written in 048 when
  // a project held only a name, a type and a scope. Until that policy is
  // narrowed, the deal value of every engagement was readable AND writable by
  // a designer who typed the path: the nav was the only thing keeping them
  // out, which is the exact failure /admin above was added to fix.
  { prefix: "/projects", roles: ["founder", "manager", "accountant"] },
  // The team list and role assignment. Same story: page-level isOwner() was
  // the only check, so a bug there was the only thing between a designer and
  // the invite form.
  { prefix: "/team", roles: ["founder"] },
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

  // Inside the module, per screen. The RESTRICTED entry above admits any role
  // holding a social capability to the whole prefix; each screen says who it
  // is actually for, and until now only one of eleven enforced it.
  if (base === "/social" || base.startsWith("/social/")) {
    if (!canReachSocialPath(role, base)) return firstSocialScreen(role);
  }

  return null;
}
