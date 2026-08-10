import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  typedRoutes: true,
  // Client-side router cache: revisiting a route within 30s reuses the last
  // render instantly instead of a server round-trip. Mutations still show
  // fresh data (server actions revalidate; router.refresh() bypasses it).
  experimental: {
    staleTimes: { dynamic: 30 },
  },
  // Keep the headless-browser packages external so their native binaries are
  // traced into the serverless function instead of bundled by the compiler.
  serverExternalPackages: [
    "@sparticuz/chromium",
    "puppeteer-core",
    "playwright-core",
  ],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co" },
      { protocol: "https", hostname: "*.supabase.in" },
      // Local Supabase Storage served via the dev stack (next/image needs an
      // explicit allow-list). Cover common local Supabase ports.
      { protocol: "http", hostname: "127.0.0.1", port: "54321" },
      { protocol: "http", hostname: "localhost", port: "54321" },
    ],
  },
};

export default withNextIntl(nextConfig);
