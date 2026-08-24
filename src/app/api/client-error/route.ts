import { NextResponse, type NextRequest } from "next/server";

import { getSessionUser } from "@/lib/auth";
import { getActualRole } from "@/lib/roles-server";
import { currentTenantId } from "@/lib/tenant-server";
import { recordError } from "@/lib/error-log";
import { checkRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/** A stack is the biggest thing here, and 8 KB is well past a real one. */
const MAX_BODY = 8 * 1024;

/**
 * Where a crashed screen reports itself.
 *
 * The BROWSER supplies only what it saw: a message, a stack, a digest, a path.
 * Everything that decides who this belongs to — source, actor, tenant, role —
 * is decided here, from the session. A client that could set those could file
 * a failure as somebody else, in somebody else's tenant.
 */
export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  // Keyed on the user, not the IP: a component stuck in a render loop will
  // hammer this from one session, and that is the case worth bounding.
  const rl = checkRateLimit({
    key: `client-error:${user.id}`,
    limit: 10,
    windowMs: 60_000,
  });
  if (!rl.allowed) return NextResponse.json({ ok: false }, { status: 429 });

  const raw = await request.text();
  if (raw.length > MAX_BODY) {
    return NextResponse.json({ ok: false }, { status: 413 });
  }

  let body: {
    message?: unknown;
    stack?: unknown;
    digest?: unknown;
    path?: unknown;
  };
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const message = String(body.message ?? "").slice(0, 500);
  // A React render error should never carry a Postgres message — if one shows
  // up, something upstream leaked it into the client and storing it here would
  // put table and column names in a second place.
  const looksLikePostgres =
    /row-level security|violates .* constraint|relation ".*" does not exist/i.test(
      message,
    );

  const [role, tenantId] = await Promise.all([
    getActualRole(),
    currentTenantId().catch(() => null),
  ]);

  const err = new Error(looksLikePostgres ? "redacted_db_message" : message);
  err.stack = typeof body.stack === "string" ? body.stack : undefined;

  const ref = await recordError({
    source: "render",
    area: "client",
    scope: String(body.path ?? "unknown").slice(0, 200),
    err,
    severity: "error",
    tenantId,
    actorId: user.id,
    role,
    path: String(body.path ?? "").slice(0, 200) || null,
    context: body.digest ? { digest: String(body.digest).slice(0, 100) } : {},
  });

  return NextResponse.json({ ok: true, ref });
}
