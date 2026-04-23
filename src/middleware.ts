import createIntlMiddleware from "next-intl/middleware";
import type { NextRequest } from "next/server";
import { routing } from "./i18n/routing";
import { updateSession } from "./lib/supabase/middleware";

const intlMiddleware = createIntlMiddleware(routing);

export default async function middleware(request: NextRequest) {
  const response = intlMiddleware(request);
  return updateSession(request, response);
}

export const config = {
  // Exclude /a/* (approval link) and /p/* (client portal) — both public
  // routes live outside the locale prefix + auth guard.
  matcher: ["/((?!api|a/|p/|_next|_vercel|.*\\..*).*)"],
};
