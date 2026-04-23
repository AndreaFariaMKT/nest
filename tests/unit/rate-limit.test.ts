import { afterEach, describe, expect, it, vi } from "vitest";
import {
  _resetRateLimitStore,
  checkRateLimit,
  ipFromHeaders,
} from "@/lib/rate-limit";

afterEach(() => {
  _resetRateLimitStore();
  vi.useRealTimers();
});

describe("checkRateLimit", () => {
  it("allows requests below the limit", () => {
    const res1 = checkRateLimit({ key: "a", limit: 3, windowMs: 60_000 });
    expect(res1.allowed).toBe(true);
    expect(res1.remaining).toBe(2);

    const res2 = checkRateLimit({ key: "a", limit: 3, windowMs: 60_000 });
    expect(res2.allowed).toBe(true);
    expect(res2.remaining).toBe(1);

    const res3 = checkRateLimit({ key: "a", limit: 3, windowMs: 60_000 });
    expect(res3.allowed).toBe(true);
    expect(res3.remaining).toBe(0);
  });

  it("rejects the (limit+1)th request", () => {
    for (let i = 0; i < 3; i++) {
      checkRateLimit({ key: "b", limit: 3, windowMs: 60_000 });
    }
    const blocked = checkRateLimit({ key: "b", limit: 3, windowMs: 60_000 });
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
  });

  it("buckets are keyed independently", () => {
    for (let i = 0; i < 3; i++) {
      checkRateLimit({ key: "x", limit: 3, windowMs: 60_000 });
    }
    const other = checkRateLimit({ key: "y", limit: 3, windowMs: 60_000 });
    expect(other.allowed).toBe(true);
  });

  it("allows new requests once the window rolls forward", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-23T12:00:00Z"));
    for (let i = 0; i < 3; i++) {
      checkRateLimit({ key: "c", limit: 3, windowMs: 60_000 });
    }
    expect(
      checkRateLimit({ key: "c", limit: 3, windowMs: 60_000 }).allowed,
    ).toBe(false);

    // Jump past the window.
    vi.setSystemTime(new Date("2026-04-23T12:01:01Z"));
    expect(
      checkRateLimit({ key: "c", limit: 3, windowMs: 60_000 }).allowed,
    ).toBe(true);
  });

  it("peek does not consume a slot", () => {
    const peek1 = checkRateLimit({
      key: "d",
      limit: 3,
      windowMs: 60_000,
      peek: true,
    });
    expect(peek1.allowed).toBe(true);
    expect(peek1.remaining).toBe(3);

    const real = checkRateLimit({ key: "d", limit: 3, windowMs: 60_000 });
    expect(real.remaining).toBe(2);
  });

  it("reports resetMs > 0 when bucket has hits", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-23T12:00:00Z"));
    checkRateLimit({ key: "e", limit: 3, windowMs: 60_000 });
    vi.setSystemTime(new Date("2026-04-23T12:00:30Z"));
    const res = checkRateLimit({ key: "e", limit: 3, windowMs: 60_000 });
    expect(res.resetMs).toBeGreaterThan(0);
  });
});

describe("ipFromHeaders", () => {
  it("reads the first entry of x-forwarded-for", () => {
    const h = new Headers({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" });
    expect(ipFromHeaders(h)).toBe("1.2.3.4");
  });

  it("falls back to x-real-ip", () => {
    const h = new Headers({ "x-real-ip": "10.0.0.1" });
    expect(ipFromHeaders(h)).toBe("10.0.0.1");
  });

  it("returns 'unknown' when no header is set", () => {
    expect(ipFromHeaders(new Headers())).toBe("unknown");
  });
});
