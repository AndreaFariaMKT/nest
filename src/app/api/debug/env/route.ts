import { NextResponse, type NextRequest } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Dev-only env probe. Bearer-gated with CRON_SECRET. Returns presence +
 * length + safe prefix for key env vars — never the full value.
 *
 *   curl -H "Authorization: Bearer $CRON_SECRET" /api/debug/env
 */
export async function GET(request: NextRequest) {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return NextResponse.json({ error: "no CRON_SECRET set" }, { status: 500 });
  }
  if (request.headers.get("authorization") !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const probe = (name: string) => {
    const raw = process.env[name] ?? "";
    return {
      present: raw.length > 0,
      len: raw.length,
      prefix: raw.slice(0, 8),
    };
  };

  return NextResponse.json({
    NODE_ENV: process.env.NODE_ENV,
    ANTHROPIC_API_KEY: probe("ANTHROPIC_API_KEY"),
    ANTHROPIC_BASE_URL: process.env.ANTHROPIC_BASE_URL ?? null,
    META_APP_ID: probe("META_APP_ID"),
    META_APP_SECRET: probe("META_APP_SECRET"),
    META_LONG_LIVED_TOKEN: probe("META_LONG_LIVED_TOKEN"),
    INSTAGRAM_BUSINESS_ACCOUNT_ID: probe("INSTAGRAM_BUSINESS_ACCOUNT_ID"),
    CRON_SECRET: probe("CRON_SECRET"),
    SUPABASE_SERVICE_ROLE_KEY: probe("SUPABASE_SERVICE_ROLE_KEY"),
  });
}
