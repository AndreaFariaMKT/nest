import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { guardRedirect, mapLegacyRole, isAppRoleValue } from "@/lib/guard";

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

  const {
    data: { user },
  } = await supabase.auth.getUser();

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

    // Effective role: the login's role, or a founder's "view as" preview.
    const { data: membership } = await supabase
      .from("tenant_members")
      .select("role")
      .eq("user_id", user.id)
      .order("tenant_id", { ascending: true })
      .limit(1)
      .maybeSingle();
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
