import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

async function freshSentry() {
  vi.resetModules();
  return await import("@/lib/sentry");
}

beforeEach(() => {
  delete (process.env as Record<string, unknown>).SENTRY_DSN;
});

afterEach(() => {
  vi.restoreAllMocks();
  delete (process.env as Record<string, unknown>).SENTRY_DSN;
});

describe("sentry (opt-in)", () => {
  it("isSentryConfigured = false without DSN", async () => {
    const { isSentryConfigured } = await freshSentry();
    expect(isSentryConfigured()).toBe(false);
  });

  it("isSentryConfigured = true with a valid DSN", async () => {
    (process.env as Record<string, unknown>).SENTRY_DSN =
      "https://key@o1.ingest.sentry.io/123";
    const { isSentryConfigured } = await freshSentry();
    expect(isSentryConfigured()).toBe(true);
  });

  it("isSentryConfigured = false for a malformed DSN", async () => {
    (process.env as Record<string, unknown>).SENTRY_DSN = "not-a-dsn";
    const { isSentryConfigured } = await freshSentry();
    expect(isSentryConfigured()).toBe(false);
  });

  it("captureException is a no-op when DSN is absent", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response("", { status: 200 }),
    );
    const { captureException } = await freshSentry();
    const result = await captureException(new Error("boom"));
    expect(result).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("captureException posts to the envelope endpoint when DSN is set", async () => {
    (process.env as Record<string, unknown>).SENTRY_DSN =
      "https://abc@o1.ingest.sentry.io/42";
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response("", { status: 200 }),
    );
    const { captureException } = await freshSentry();
    const id = await captureException(new Error("boom"), {
      tags: { area: "test" },
    });
    expect(id).toMatch(/^[a-f0-9]{32}$/);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("o1.ingest.sentry.io/api/42/envelope/");
    expect(init.headers).toMatchObject({
      "content-type": "application/x-sentry-envelope",
    });
    const body = init.body as string;
    expect(body).toContain('"type":"event"');
    expect(body).toContain("boom");
  });

  it("survives a fetch failure silently (returns null)", async () => {
    (process.env as Record<string, unknown>).SENTRY_DSN =
      "https://abc@o1.ingest.sentry.io/42";
    vi.spyOn(global, "fetch").mockRejectedValue(new Error("network"));
    const { captureMessage } = await freshSentry();
    const id = await captureMessage("hello");
    expect(id).toBeNull();
  });

  it("captureMessage supplies the message envelope", async () => {
    (process.env as Record<string, unknown>).SENTRY_DSN =
      "https://abc@o1.ingest.sentry.io/42";
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response("", { status: 200 }),
    );
    const { captureMessage } = await freshSentry();
    await captureMessage("hello world", { level: "warning" });
    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const body = init.body as string;
    expect(body).toContain("hello world");
    expect(body).toContain('"level":"warning"');
  });
});
