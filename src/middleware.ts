import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

export default createMiddleware(routing);

export const config = {
  // Match all pathnames except for:
  //   - API routes (/api/*)
  //   - Next.js internals (/_next/*, /_vercel/*)
  //   - Static files (anything with an extension, e.g. favicon.ico)
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
