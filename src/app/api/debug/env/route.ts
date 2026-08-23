import { NextResponse, type NextRequest } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Dev-only env probe (404 in production). Bearer-gated with CRON_SECRET. Returns presence +
 * length + safe prefix for key env vars — never the full value.
 *
 *   curl -H "Authorization: Bearer $CRON_SECRET" /api/debug/env
 */
export async function GET(request: NextRequest) {
  // These exist to debug a deployment, not to serve one. In production the
  // route should not merely refuse — it should not appear to exist, because a
  // 401 confirms the endpoint is there and worth attacking. The bearer gate
  // below is CRON_SECRET, which is shared with four public cron routes, so it
  // is the wrong secret to stake a secret-probe on.
  if (process.env.NODE_ENV === "production") {
    return new NextResponse(null, { status: 404 });
  }

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
