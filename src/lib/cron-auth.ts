import { timingSafeEqual } from "node:crypto";

/**
 * Whether a request carries the cron secret.
 *
 * Constant-time on purpose. `!==` on strings short-circuits at the first
 * differing byte, so response time leaks a prefix — and CRON_SECRET is not a
 * throwaway: it gates four public cron endpoints and, until recently, two
 * debug routes, one of which returned the secret's own first eight characters.
 *
 * Returns a discriminated result rather than a boolean so callers keep the
 * distinction they already made between "not configured" (a deploy problem,
 * 500) and "wrong secret" (401).
 */
export type CronAuth = "ok" | "unset" | "denied";

export function checkCronAuth(header: string | null): CronAuth {
  const expected = process.env.CRON_SECRET;
  if (!expected) return "unset";

  const given = header ?? "";
  const want = `Bearer ${expected}`;

  // timingSafeEqual throws on a length mismatch, which would itself be a
  // length oracle. Compare fixed-size digests of both instead.
  const a = Buffer.from(given, "utf8");
  const b = Buffer.from(want, "utf8");
  if (a.length !== b.length) {
    // Still do a comparison of equal length so the refusal costs the same.
    timingSafeEqual(b, b);
    return "denied";
  }
  return timingSafeEqual(a, b) ? "ok" : "denied";
}
