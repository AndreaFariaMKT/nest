import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { guardRedirect, mapLegacyRole, isAppRoleValue } from "@/lib/guard";
import { TENANT_COOKIE, pickTenantId } from "@/lib/tenant";

/**
 * Refresh the Supabase auth session on every request, then enforce per-role
 * route access. Callers pass the response they already built (e.g. from
 * next-intl) so auth cookies attach without clobbering i18n redirects.
 */
export async function updateSession(
  request: NextRequest,
  response: NextResponse,
) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(
          cookiesToSet: {
            name: string;
            value: string;
            options: CookieOptions;
          }[],
        ) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set({ name, value, ...options });
          });
        },
      },
    },
  );

  // getClaims(), not getUser(): the JWT is verified locally against a cached
  // JWKS instead of asking the Auth server on every single request that the
  // matcher lets through. Falls back to a getUser()-equivalent call on a
  // project still signing with the symmetric secret, so it is never worse.
  //
  // The trade: a revoked session keeps passing this guard until its token
  // expires. What it gates is which ROUTE you may see — RLS, which is the
  // thing that decides what data you may read, is unaffected and still runs
  // against the database on every query.
  const { data: claims } = await supabase.auth.getClaims();
  const user = claims?.claims?.sub ? { id: claims.claims.sub } : null;

  if (user) {
    // Locale-strip the path (pt-BR default = no prefix, en = /en).
    // Compared lowercased: a request to /EN/finance would otherwise keep its
    // prefix, so `base` stays "/EN/finance", matches no RESTRICTED prefix, and
    // the guard returns "allowed". RLS still stands behind it, but a guard is
    // not allowed to fail open on capitalisation.
    const path = request.nextUrl.pathname;
    const lower = path.toLowerCase();
    const isEn = lower === "/en" || lower.startsWith("/en/");
    const prefix = isEn ? "/en" : "";
    const base = (isEn ? lower.slice(3) : lower) || "/";

    // Effective role: the login's role IN THE HOUSE IT IS WORKING IN, or a
    // founder's "view as" preview. The same person can be founder of one
    // house and accountant of another, so the role is read for the house the
    // switcher chose — by the same rule getCurrentTenant() applies.
    const { data: memberships } = await supabase
      .from("tenant_members")
      .select("tenant_id, role")
      .eq("user_id", user.id);
    const active = pickTenantId(
      (memberships ?? []).map((m) => m.tenant_id),
      request.cookies.get(TENANT_COOKIE)?.value,
    );
    const membership = memberships?.find((m) => m.tenant_id === active);
    let role = mapLegacyRole(membership?.role);
    if (role === "founder") {
      const preview = request.cookies.get("nest-view-role")?.value;
      if (isAppRoleValue(preview)) role = preview;
    }

    const target = guardRedirect(base, role);
    if (target && target !== base) {
      const url = request.nextUrl.clone();
      url.pathname = prefix + target;
      url.search = "";
      return NextResponse.redirect(url);
    }
  }

  return response;
}
