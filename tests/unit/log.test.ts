import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The log module reads process.env.LOG_LEVEL + NODE_ENV at call time, so each
// test resets them. We re-import to reset any cached state.

async function freshLog() {
  vi.resetModules();
  return (await import("@/lib/log")).log;
}

describe("log", () => {
  let spies: {
    log: ReturnType<typeof vi.spyOn>;
    error: ReturnType<typeof vi.spyOn>;
  };
  const originalEnv = { ...process.env };

  beforeEach(() => {
    spies = {
      log: vi.spyOn(console, "log").mockImplementation(() => {}),
      error: vi.spyOn(console, "error").mockImplementation(() => {}),
    };
  });

  afterEach(() => {
    spies.log.mockRestore();
    spies.error.mockRestore();
    process.env = { ...originalEnv };
  });

  it("emits info in dev mode with pretty output", async () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = "development";
    process.env.LOG_LEVEL = "info";
    const log = await freshLog();
    log.info("test", "hello world");
    expect(spies.log).toHaveBeenCalledTimes(1);
    const line = String(spies.log.mock.calls[0][0]);
    expect(line).toContain("test: hello world");
    expect(line).toContain("[INFO]");
  });

  it("emits JSON line in production", async () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    process.env.LOG_LEVEL = "info";
    const log = await freshLog();
    log.info("area", "msg", { foo: 1 });
    const line = String(spies.log.mock.calls[0][0]);
    const parsed = JSON.parse(line);
    expect(parsed).toMatchObject({
      level: "info",
      area: "area",
      msg: "msg",
      foo: 1,
    });
    expect(typeof parsed.ts).toBe("string");
  });

  it("redacts known-sensitive fields", async () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    const log = await freshLog();
    log.info("auth", "login", {
      token: "abc123",
      nested: { password: "hunter2", harmless: "ok" },
    });
    const parsed = JSON.parse(String(spies.log.mock.calls[0][0]));
    expect(parsed.token).toBe("[redacted]");
    expect(parsed.nested.password).toBe("[redacted]");
    expect(parsed.nested.harmless).toBe("ok");
  });

  it("routes warn + error to console.error", async () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    const log = await freshLog();
    log.warn("x", "y");
    log.error("x", "z");
    expect(spies.error).toHaveBeenCalledTimes(2);
  });

  it("filters below LOG_LEVEL", async () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    process.env.LOG_LEVEL = "warn";
    const log = await freshLog();
    log.debug("a", "b");
    log.info("a", "b");
    log.warn("a", "b");
    expect(spies.log).not.toHaveBeenCalled();
    expect(spies.error).toHaveBeenCalledTimes(1);
  });

  it("timed() logs elapsed + rethrows on error", async () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    const log = await freshLog();

    const ok = await log.timed("t", "success", async () => 42);
    expect(ok).toBe(42);
    const okLine = JSON.parse(String(spies.log.mock.calls[0][0]));
    expect(okLine.msg).toMatch(/ok/);
    expect(typeof okLine.elapsedMs).toBe("number");

    await expect(
      log.timed("t", "fail", async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    const failLine = JSON.parse(String(spies.error.mock.calls[0][0]));
    expect(failLine.msg).toMatch(/fail/);
    expect(failLine.err).toBe("boom");
  });
});
