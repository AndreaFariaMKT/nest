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
}

/**
 * Best-effort IP extraction from Next/Vercel request headers. Falls back to
 * "unknown" so the limiter still works (one shared bucket for unknown IPs).
 */
export function ipFromHeaders(headers: Headers): string {
  const xff = headers.get("x-forwarded-for");
  if (xff) {
    // First entry is the original client.
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = headers.get("x-real-ip");
  if (real) return real;
  return "unknown";
}
