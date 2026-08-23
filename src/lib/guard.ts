import type { AppRole } from "@/lib/roles";
import { canUseSocial } from "@/lib/social";

const ROLES: AppRole[] = [
  "founder",
  "manager",
  "social",
  "designer_social",
  "designer_identity",
  "developer",
  "accountant",
  "client",
];

export function isAppRoleValue(v: string | undefined | null): v is AppRole {
  return !!v && (ROLES as string[]).includes(v);
}

/** Map any legacy tenant_members.role value onto an app role (Edge-safe). */
export function mapLegacyRole(role: string | null | undefined): AppRole {
  if (isAppRoleValue(role)) return role;
  // The legacy values this app actually wrote before app roles existed. Named
  // explicitly so they keep mapping to what they meant.
  if (role === "owner" || role === "admin") return "founder";
  if (role === "member" || role === "staff") return "manager";
  // Anything else is a value nobody planned for — including the null a user
  // with NO membership row for the active tenant produces. That used to land
  // on "manager", which carries coordinate + publish, so such a user was
  // handed the capability to register publishing credentials. The tenant floor
  // denied every read and write behind it, but that floor was the only layer
  // and it does not cover `profiles`. Fail closed instead.
  return "client";
}

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
