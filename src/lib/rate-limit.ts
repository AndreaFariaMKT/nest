// Simple in-memory rate limiter.
//
// Sliding-window counter: each key tracks the last N request timestamps and
// rejects when more than `limit` fall inside the active window. Good enough
// for a single-process dev box; for horizontal scale we'll swap the store
// for Upstash Redis (same API, promise-based).
//
// ⚠ In-memory state resets on restart. For anything where that matters
// (billing, abuse prevention) wait until the Redis swap lands.

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
