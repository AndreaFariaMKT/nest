// Rate limiting, in two layers.
//
// `checkRateLimit` below is the in-memory sliding window: each key keeps the
// timestamps of recent requests and rejects when too many fall inside the
// window. It is exact, it is free, and it is per process — which on Vercel
// means per instance, so the effective limit is whatever you configured times
// however many instances happen to be warm. That number rises with traffic,
// which is to say it rises exactly when the limit was supposed to bite, and a
// fresh instance starts at zero.
//
// `checkRateLimitShared` is the one to call from a route. It counts in
// Postgres (057), so every instance reads the same number, and falls back to
// the in-memory window when the database cannot answer.

import { createAdminClient } from "@/lib/supabase/admin";
import { log } from "@/lib/log";

type Bucket = {
  // Timestamps (ms) of recent requests, oldest first.
  hits: number[];
};

const buckets = new Map<string, Bucket>();

/**
 * How often to sweep buckets that have gone quiet.
 *
 * The Map used to grow for the life of the process: an emptied bucket was left
 * in place, and the key is per-IP, so it grew with every distinct caller and
 * never shrank. Bounded in practice today — the limiter is only reachable from
 * the cron routes and /a/[token] — but "bounded because of who happens to call
 * it" is not a property worth relying on, and it costs eight lines not to.
 */
const SWEEP_EVERY_MS = 60_000;
let lastSweep = 0;

function sweep(now: number, windowMs: number): void {
  if (now - lastSweep < SWEEP_EVERY_MS) return;
  lastSweep = now;
  const cutoff = now - windowMs;
  for (const [key, bucket] of buckets) {
    // A bucket whose newest hit is outside the window can say nothing about
    // any future request, so it is not state — it is a leak.
    if (bucket.hits.length === 0 || bucket.hits[bucket.hits.length - 1] < cutoff) {
      buckets.delete(key);
    }
  }
}

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetMs: number; // ms until the oldest relevant hit falls out of the window
  limit: number;
};

export type RateLimitOptions = {
  /** Unique identifier for the actor being limited (IP, token, user id). */
  key: string;
  /** Max requests allowed inside the window. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
  /** Optional: don't count this call, just inspect. */
  peek?: boolean;
};

export function checkRateLimit(opts: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  const windowStart = now - opts.windowMs;
  sweep(now, opts.windowMs);

  let bucket = buckets.get(opts.key);
  if (!bucket) {
    bucket = { hits: [] };
    buckets.set(opts.key, bucket);
  }

  // Drop hits that fell out of the window.
  while (bucket.hits.length > 0 && bucket.hits[0] < windowStart) {
    bucket.hits.shift();
  }

  const currentCount = bucket.hits.length;
  const resetMs =
    currentCount > 0 ? Math.max(0, bucket.hits[0] - windowStart) : 0;

  if (currentCount >= opts.limit) {
    return {
      allowed: false,
      remaining: 0,
      resetMs,
      limit: opts.limit,
    };
  }

  if (!opts.peek) {
    bucket.hits.push(now);
  }
  return {
    allowed: true,
    remaining: opts.limit - bucket.hits.length,
    resetMs,
    limit: opts.limit,
  };
}

/** Test-only: wipe all buckets so unit tests don't leak state. */
export function _resetRateLimitStore(): void {
  buckets.clear();
  lastSweep = 0;
}

/**
 * Best-effort IP extraction from Next/Vercel request headers. Falls back to
 * "unknown" so the limiter still works (one shared bucket for unknown IPs).
 */
export function ipFromHeaders(headers: Headers): string {
  // ⚠ On Vercel this header is set by the platform, but a caller reaching the
  // function directly controls it — so the FIRST entry is attacker-chosen and
  // a limiter keyed on it can be sidestepped by varying the value. Vercel also
  // sets `x-vercel-forwarded-for`, which it does not let a client forge, so
  // that is preferred where present. Read the trustworthy one first.
  const vercel = headers.get("x-vercel-forwarded-for");
  if (vercel) {
    const first = vercel.split(",")[0]?.trim();
    if (first) return first;
  }
  const xff = headers.get("x-forwarded-for");
  if (xff) {
    // First entry is the original client — as reported by the caller.
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = headers.get("x-real-ip");
  if (real) return real;
  return "unknown";
}


/**
 * The same question, answered once for the whole deployment.
 *
 * Counts in Postgres through `rate_limit_hit` (057), which does the read, the
 * decision and the write in one statement — two simultaneous requests cannot
 * both read the old count and both write the same increment, which is the race
 * a select-then-update loses silently and under load.
 *
 * Service-role client on purpose, and the function is revoked from everyone
 * else: it is `security definer`, so an anonymous caller who could execute it
 * would be able to inflate the counter for any key — including someone else's
 * approval token, which is a way to lock a client out of approving their own
 * post.
 *
 * **Falls back to the in-memory window when the database does not answer.**
 * Failing closed here would mean a database blip turns into "nobody can
 * approve anything", on the one surface that has no login to explain it — and
 * the app cannot serve a page without Postgres anyway, so a limiter that
 * refuses everything adds nothing but a second outage. The in-memory window is
 * weaker, not absent, and the fallback is logged.
 */
export async function checkRateLimitShared(
  opts: Omit<RateLimitOptions, "peek">,
): Promise<RateLimitResult> {
  try {
    const { data, error } = await callHit({
      p_bucket: opts.key,
      p_window_ms: opts.windowMs,
      p_limit: opts.limit,
    });
    if (error || !data || data.length === 0) throw error ?? new Error("no row");
    const row = data[0];
    return {
      allowed: row.allowed,
      remaining: row.remaining,
      resetMs: row.reset_ms,
      limit: opts.limit,
    };
  } catch (err) {
    log.error("rate-limit", "shared_store_unavailable", {
      code: err instanceof Error ? err.message.slice(0, 80) : "unknown",
    });
    return checkRateLimit(opts);
  }
}

type HitArgs = { p_bucket: string; p_window_ms: number; p_limit: number };
type HitRow = { allowed: boolean; remaining: number; reset_ms: number };

/**
 * The one place that knows `rate_limit_hit` exists before the generated types
 * do.
 *
 * `database.gen.ts` is regenerated from the live database, so a function
 * introduced by a migration that has not been applied yet is not in it — and
 * this repository deliberately has no temporary casts left, because the last
 * round of them outlived the migrations they were waiting for and three
 * features shipped reading columns that no longer looked the way the cast
 * claimed.
 *
 * So the cast is here, once, and `tests/unit/rate-limit-contract.test.ts`
 * reads 057 and asserts the argument names, the argument order and the
 * returned column names against the types below. If the SQL changes and this
 * does not, that test fails — which is the thing a cast normally cannot do.
 *
 * Delete this and call `admin.rpc("rate_limit_hit", …)` directly once 057 is
 * applied and `npm run types:gen` has run.
 */
async function callHit(
  args: HitArgs,
): Promise<{ data: HitRow[] | null; error: unknown }> {
  const admin = createAdminClient();
  const rpc = (admin as unknown as {
    rpc: (fn: string, params: HitArgs) => PromiseLike<{
      data: HitRow[] | null;
      error: unknown;
    }>;
  }).rpc;
  return rpc.call(admin, "rate_limit_hit", args);
}
