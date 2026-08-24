import "server-only";

import { createHash, randomBytes } from "node:crypto";

import { createAdminClient } from "@/lib/supabase/admin";
import { dbError, type PgLikeError } from "@/lib/db-error";
import { log, redact } from "@/lib/log";

/**
 * Failures worth keeping, and the code a person can quote.
 *
 * Separate from src/lib/log.ts on purpose, in both directions.
 *
 * It imports `log`; `log` must never import this. `log.ts` is one careless
 * import away from the browser bundle — src/lib/db-error.ts already documents
 * refusing to import it for exactly that reason — and this module carries a
 * Supabase admin client and node:crypto, neither of which belongs there.
 *
 * And not everything `log.error` records deserves a row. A Claude response
 * that failed to parse, a per-row cron skip: those are operational noise, and
 * a table full of them is a table nobody opens. What lands here is a failure
 * somebody SAW — a refusal on screen, a page that crashed, a run that died.
 */

/** Where the failure happened. Mirrors the CHECK in migration 036. */
export type ErrorSource = "action" | "route" | "cron" | "client" | "render";
export type ErrorSeverity = "warn" | "error" | "fatal";

/** Ambiguous glyphs removed: this code gets read aloud over the phone. */
const REF_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const MAX_MESSAGE = 500;
const MAX_DETAIL = 4000;

export function newRef(): string {
  const bytes = randomBytes(6);
  let out = "";
  for (const b of bytes) out += REF_ALPHABET[b % REF_ALPHABET.length];
  return `NST-${out}`;
}

/**
 * Next signals redirects and not-found by THROWING. Recording those as errors
 * fills the log with the framework working correctly — and, worse, swallowing
 * them breaks the redirect. Callers rethrow when this is true.
 */
export function isFrameworkControlFlow(err: unknown): boolean {
  const digest =
    typeof err === "object" && err !== null && "digest" in err
      ? String((err as { digest?: unknown }).digest ?? "")
      : "";
  return (
    digest === "DYNAMIC_SERVER_USAGE" ||
    digest.startsWith("NEXT_REDIRECT") ||
    digest === "NEXT_NOT_FOUND"
  );
}

function isPgError(err: unknown): err is PgLikeError {
  return (
    typeof err === "object" &&
    err !== null &&
    "message" in err &&
    !(err instanceof Error)
  );
}

/**
 * Reduce a thrown thing to what is safe to keep.
 *
 * A Postgres error is reduced to its SQLSTATE plus the translated key — its
 * `message` names tables and columns, and `details`/`hint` echo the offending
 * VALUE. The hub stores those two and its own documentation concedes they can
 * carry row content; in this schema that would be client copy, internal
 * production notes and message bodies, in a table and in every backup.
 */
function describe(err: unknown): {
  message: string | null;
  detail: string | null;
  code: string | null;
} {
  if (err instanceof Error) {
    return {
      message: err.message.slice(0, MAX_MESSAGE),
      detail: (err.stack ?? "").slice(0, MAX_DETAIL) || null,
      code:
        "code" in err && err.code ? String((err as { code: unknown }).code) : null,
    };
  }
  if (isPgError(err)) {
    return { message: dbError(err), detail: null, code: err.code ?? null };
  }
  return { message: String(err).slice(0, MAX_MESSAGE), detail: null, code: null };
}

/**
 * Scrub a stack trace before storing it.
 *
 * `redact()` from log.ts matches KEY names and never scans string values —
 * that is a real limit and it was noted in the security review. A stack is a
 * string, so it goes past that entirely: a URL with a token in the query, a
 * long-lived Meta token that reached an error message, a bearer header echoed
 * by a fetch wrapper. This catches the shapes that actually appear.
 *
 * It is a reduction, not a guarantee, and it is worth being clear about that:
 * the real protection is that Postgres errors never reach here in the first
 * place, and that the table is founder-only.
 */
export function scrubStack(stack: string): string {
  return stack
    .replace(/(bearer\s+)[A-Za-z0-9._\-]+/gi, "$1[redacted]")
    .replace(/([?&](?:token|access_token|secret|key|apikey)=)[^&\s]+/gi, "$1[redacted]")
    // Long opaque blobs: Meta tokens, JWTs, base64 secrets.
    .replace(/\b[A-Za-z0-9._\-]{60,}\b/g, "[redacted]");
}

/** Identical failures group under one heading instead of burying the list. */
function fingerprintOf(
  area: string,
  scope: string,
  code: string | null,
  detail: string | null,
): string {
  const frame = (detail ?? "").split("\n")[1]?.trim() ?? "";
  return createHash("sha256")
    .update([area, scope, code ?? "", frame].join("|"))
    .digest("hex")
    .slice(0, 32);
}

export interface RecordErrorInput {
  source: ErrorSource;
  /** Same convention as log.ts: "cron.publish", "social.write". */
  area: string;
  /** The action or route that failed. */
  scope: string;
  err: unknown;
  severity?: ErrorSeverity;
  tenantId?: string | null;
  clientId?: string | null;
  actorId?: string | null;
  role?: string | null;
  path?: string | null;
  locale?: string | null;
  context?: Record<string, unknown>;
}

/**
 * Keep a failure, and return the code to show. Never throws: a logger that
 * takes the request down with it is worse than no logger.
 */
export async function recordError(input: RecordErrorInput): Promise<string> {
  const ref = newRef();
  try {
    const { message, detail, code } = describe(input.err);
    const admin = createAdminClient();
    await admin.from("error_log").insert({
      ref,
      source: input.source,
      severity: input.severity ?? "error",
      area: input.area,
      scope: input.scope,
      code,
      message,
      // Both through log.ts's redact(), so there is exactly one redaction set
      // in the codebase and it is the one with tests.
      detail: detail ? scrubStack(detail) : null,
      context: (redact(input.context ?? {}) ?? {}) as Record<string, unknown>,
      tenant_id: input.tenantId ?? null,
      client_id: input.clientId ?? null,
      actor_id: input.actorId ?? null,
      role: input.role ?? null,
      path: input.path ?? null,
      locale: input.locale ?? null,
      release: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
      fingerprint: fingerprintOf(input.area, input.scope, code, detail),
    });
    log.error(input.area, "recorded", { ref, code: code ?? "unknown" });
  } catch (e) {
    // The insert failing must not become a second failure. The Vercel log is
    // the fallback, and the ref still goes to the person.
    log.error(input.area, "error_log_insert_failed", {
      ref,
      err: e instanceof Error ? e.message : String(e),
    });
  }
  return ref;
}
