import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { auditEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

/**
 * Public-ish liveness + readiness probe.
 *
 *   200 → process is up AND can round-trip a trivial query to Postgres.
 *   503 → either env is misconfigured or the DB is unreachable.
 *
 * Safe for uptime monitors, Vercel deploys, and for "is the DB up?" checks
 * during incident response. We never return row data — only the fact that
 * we could open a connection.
 */
export async function GET() {
  const started = Date.now();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json(
      {
        status: "unconfigured",
        reason: "missing SUPABASE env",
        version: appVersion(),
      },
      { status: 503 },
    );
  }

  let dbOk = false;
  let dbMs = 0;
  try {
    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });
    const dbStarted = Date.now();
    const { error } = await admin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .limit(1);
    dbMs = Date.now() - dbStarted;
    dbOk = !error;
  } catch {
    dbOk = false;
  }

  const envReport = auditEnv();
  const body = {
    status: dbOk ? "ok" : "degraded",
    version: appVersion(),
    uptimeSec: Math.round(process.uptime()),
    checks: {
      db: { ok: dbOk, latencyMs: dbMs },
      env: {
        ok: envReport.ok,
        inactiveOptional: envReport.inactiveOptional,
        missingCount: envReport.missingRequired.length,
        invalidCount: envReport.invalid.length,
      },
    },
    elapsedMs: Date.now() - started,
  };
  return NextResponse.json(body, { status: dbOk ? 200 : 503 });
}

function appVersion(): string {
  return (
    process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ??
    process.env.GIT_COMMIT?.slice(0, 7) ??
    "dev"
  );
}
