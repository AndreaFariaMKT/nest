import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The env module reads process.env on access. We seed + clean each test.

const originalEnv = { ...process.env };

function setEnv(map: Record<string, string | undefined>) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const [k, v] of Object.entries(map)) {
    if (v === undefined) delete (process.env as Record<string, unknown>)[k];
    else (process.env as Record<string, unknown>)[k] = v;
  }
}

beforeEach(() => {
  // Strip every env var the module cares about so each test is isolated.
  for (const key of [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "NEXT_PUBLIC_APP_URL",
    "CRON_SECRET",
    "ANTHROPIC_API_KEY",
    "META_LONG_LIVED_TOKEN",
    "INSTAGRAM_BUSINESS_ACCOUNT_ID",
    "VOYAGE_API_KEY",
    "GOOGLE_OAUTH_CLIENT_ID",
    "GOOGLE_OAUTH_CLIENT_SECRET",
  ]) {
    delete (process.env as Record<string, unknown>)[key];
  }
  vi.resetModules();
});

afterEach(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  process.env = { ...originalEnv } as any;
});

async function freshEnvModule() {
  vi.resetModules();
  return await import("@/lib/env");
}

describe("auditEnv", () => {
  it("flags all required vars as missing when env is empty", async () => {
    const { auditEnv } = await freshEnvModule();
    const report = auditEnv();
    expect(report.ok).toBe(false);
    const names = report.missingRequired.map((i) => i.name);
    expect(names).toContain("NEXT_PUBLIC_SUPABASE_URL");
    expect(names).toContain("ANTHROPIC_API_KEY");
    expect(names).toContain("CRON_SECRET");
  });

  it("is ok when all required groups are set", async () => {
    setEnv({
      NEXT_PUBLIC_SUPABASE_URL: "http://x",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "k",
      SUPABASE_SERVICE_ROLE_KEY: "k",
      NEXT_PUBLIC_APP_URL: "http://x",
      CRON_SECRET: "at-least-eight-chars",
      ANTHROPIC_API_KEY: "k",
    });
    const { auditEnv } = await freshEnvModule();
    const report = auditEnv();
    expect(report.ok).toBe(true);
  });

  it("reports optional groups as inactive when fully empty", async () => {
    setEnv({
      NEXT_PUBLIC_SUPABASE_URL: "http://x",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "k",
      SUPABASE_SERVICE_ROLE_KEY: "k",
      NEXT_PUBLIC_APP_URL: "http://x",
      CRON_SECRET: "at-least-eight-chars",
      ANTHROPIC_API_KEY: "k",
    });
    const { auditEnv } = await freshEnvModule();
    const report = auditEnv();
    expect(report.inactiveOptional).toEqual(
      expect.arrayContaining(["meta", "voyage", "google"]),
    );
  });

  it("flags a partially-configured optional group as missing required", async () => {
    setEnv({
      NEXT_PUBLIC_SUPABASE_URL: "http://x",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "k",
      SUPABASE_SERVICE_ROLE_KEY: "k",
      NEXT_PUBLIC_APP_URL: "http://x",
      CRON_SECRET: "at-least-eight-chars",
      ANTHROPIC_API_KEY: "k",
      META_LONG_LIVED_TOKEN: "t",
      // INSTAGRAM_BUSINESS_ACCOUNT_ID intentionally missing
    });
    const { auditEnv } = await freshEnvModule();
    const report = auditEnv();
    expect(report.ok).toBe(false);
    const names = report.missingRequired.map((i) => i.name);
    expect(names).toContain("INSTAGRAM_BUSINESS_ACCOUNT_ID");
  });

  it("flags invalid values (CRON_SECRET too short)", async () => {
    setEnv({
      NEXT_PUBLIC_SUPABASE_URL: "http://x",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "k",
      SUPABASE_SERVICE_ROLE_KEY: "k",
      NEXT_PUBLIC_APP_URL: "http://x",
      CRON_SECRET: "short",
      ANTHROPIC_API_KEY: "k",
    });
    const { auditEnv } = await freshEnvModule();
    const report = auditEnv();
    expect(report.ok).toBe(false);
    expect(report.invalid[0].name).toBe("CRON_SECRET");
    expect(report.invalid[0].reason).toMatch(/8/);
  });

  it("treats whitespace-only env vars as missing", async () => {
    setEnv({
      ANTHROPIC_API_KEY: "   ",
    });
    const { auditEnv } = await freshEnvModule();
    const report = auditEnv();
    const names = report.missingRequired.map((i) => i.name);
    expect(names).toContain("ANTHROPIC_API_KEY");
  });
});

describe("validateStartupEnv", () => {
  it("throws on missing required vars with a list in the message", async () => {
    const { validateStartupEnv } = await freshEnvModule();
    expect(() => validateStartupEnv()).toThrow(/MISSING/);
  });

  it("passes silently when env is valid", async () => {
    setEnv({
      NEXT_PUBLIC_SUPABASE_URL: "http://x",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "k",
      SUPABASE_SERVICE_ROLE_KEY: "k",
      NEXT_PUBLIC_APP_URL: "http://x",
      CRON_SECRET: "at-least-eight-chars",
      ANTHROPIC_API_KEY: "k",
    });
    const { validateStartupEnv } = await freshEnvModule();
    expect(() => validateStartupEnv()).not.toThrow();
  });
});

describe("env accessor", () => {
  it("env.meta.ok reflects both Meta vars being set", async () => {
    setEnv({
      META_LONG_LIVED_TOKEN: "t",
      INSTAGRAM_BUSINESS_ACCOUNT_ID: "id",
    });
    const { env } = await freshEnvModule();
    expect(env.meta.ok).toBe(true);
  });

  it("env.meta.ok is false when only one Meta var is set", async () => {
    setEnv({ META_LONG_LIVED_TOKEN: "t" });
    const { env } = await freshEnvModule();
    expect(env.meta.ok).toBe(false);
  });

  it("env.voyage.ok is false when VOYAGE_API_KEY is absent", async () => {
    const { env } = await freshEnvModule();
    expect(env.voyage.ok).toBe(false);
  });

  it("env.supabase.url throws when unset", async () => {
    const { env } = await freshEnvModule();
    expect(() => env.supabase.url).toThrow(/Missing required env var/);
  });
});
