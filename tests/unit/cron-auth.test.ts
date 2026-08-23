import { describe, it, expect, afterEach } from "vitest";

import { checkCronAuth } from "@/lib/cron-auth";

const SECRET = "s3cr3t-value-long-enough-to-matter";

afterEach(() => {
  delete process.env.CRON_SECRET;
});

describe("who may call a cron route", () => {
  it("tells an unconfigured deploy apart from a wrong secret", () => {
    // The distinction is load-bearing: callers answer 500 for one and 401 for
    // the other, and collapsing them hides a broken deploy behind "denied".
    expect(checkCronAuth("Bearer anything")).toBe("unset");
    process.env.CRON_SECRET = SECRET;
    expect(checkCronAuth("Bearer anything")).toBe("denied");
  });

  it("accepts the exact header", () => {
    process.env.CRON_SECRET = SECRET;
    expect(checkCronAuth(`Bearer ${SECRET}`)).toBe("ok");
  });

  it("refuses a missing header without throwing", () => {
    process.env.CRON_SECRET = SECRET;
    expect(checkCronAuth(null)).toBe("denied");
    expect(checkCronAuth("")).toBe("denied");
  });

  it("refuses a correct prefix", () => {
    // The case a timing attack builds toward, one byte at a time.
    process.env.CRON_SECRET = SECRET;
    expect(checkCronAuth(`Bearer ${SECRET.slice(0, -1)}`)).toBe("denied");
    expect(checkCronAuth(`Bearer ${SECRET}x`)).toBe("denied");
  });

  it("refuses the secret without its scheme", () => {
    process.env.CRON_SECRET = SECRET;
    expect(checkCronAuth(SECRET)).toBe("denied");
  });

  it("does not throw on a length mismatch", () => {
    // timingSafeEqual throws on unequal lengths, which would turn the guard
    // itself into a length oracle — and a 500 instead of a 401.
    process.env.CRON_SECRET = SECRET;
    expect(() => checkCronAuth("Bearer a")).not.toThrow();
    expect(checkCronAuth("Bearer a")).toBe("denied");
  });
});
