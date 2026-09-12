import { describe, it, expect, vi, beforeEach } from "vitest";

const rpc = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ rpc }),
}));
vi.mock("@/lib/log", () => ({
  log: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

const { checkRateLimitShared, _resetRateLimitStore } = await import(
  "@/lib/rate-limit"
);

beforeEach(() => {
  rpc.mockReset();
  _resetRateLimitStore();
});

describe("checkRateLimitShared", () => {
  it("reports what Postgres decided", async () => {
    rpc.mockResolvedValue({
      data: [{ allowed: false, remaining: 0, reset_ms: 42_000 }],
      error: null,
    });
    const r = await checkRateLimitShared({ key: "k", limit: 10, windowMs: 60_000 });
    expect(r).toEqual({ allowed: false, remaining: 0, resetMs: 42_000, limit: 10 });
    expect(rpc).toHaveBeenCalledWith("rate_limit_hit", {
      p_bucket: "k",
      p_window_ms: 60_000,
      p_limit: 10,
    });
  });

  /**
   * The fallback is the whole reason this wrapper exists rather than a bare
   * rpc call, so it is worth pinning: a database blip must not turn into
   * "nobody can approve anything" on the one surface that has no login to
   * explain itself.
   */
  it("falls back to the in-memory window when the call errors", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "boom" } });
    const first = await checkRateLimitShared({ key: "x", limit: 2, windowMs: 60_000 });
    expect(first.allowed).toBe(true);
  });

  it("falls back when the call rejects outright", async () => {
    rpc.mockRejectedValue(new Error("socket hang up"));
    expect(
      (await checkRateLimitShared({ key: "y", limit: 1, windowMs: 60_000 })).allowed,
    ).toBe(true);
  });

  it("falls back when the function answers with no row", async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    expect(
      (await checkRateLimitShared({ key: "z", limit: 1, windowMs: 60_000 })).allowed,
    ).toBe(true);
  });

  /**
   * Weaker, not absent. While the shared store is down the in-memory window
   * still counts, so a flood against one instance is still stopped by it.
   */
  it("still limits while falling back", async () => {
    rpc.mockRejectedValue(new Error("down"));
    const opts = { key: "flood", limit: 2, windowMs: 60_000 };
    expect((await checkRateLimitShared(opts)).allowed).toBe(true);
    expect((await checkRateLimitShared(opts)).allowed).toBe(true);
    expect((await checkRateLimitShared(opts)).allowed).toBe(false);
  });
});
