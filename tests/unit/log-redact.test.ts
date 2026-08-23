import { describe, it, expect } from "vitest";

import { redact } from "@/lib/log";

/**
 * The logger's header has always promised that sensitive fields are redacted
 * by name. It was true and materially incomplete: the set matched key names
 * exactly, so the columns this app actually moves around went through in the
 * clear. These tests pin the columns, not the abstraction.
 */

const asRecord = (v: unknown) => v as Record<string, unknown>;

describe("what never reaches a log line", () => {
  it("covers the Google columns by their real names", () => {
    // The old set had bare `access_token` / `refresh_token`, which do not match
    // these — and calendar-mirror and transcript-pull select exactly these.
    const out = asRecord(
      redact({
        google_refresh_token: "1//abc",
        google_access_token: "ya29.abc",
        google_token_expires_at: "2026-01-01T00:00:00Z",
      }),
    );
    expect(out.google_refresh_token).toBe("[redacted]");
    expect(out.google_access_token).toBe("[redacted]");
  });

  it("covers the encrypted client password and its wire parts", () => {
    const out = asRecord(redact({ secret_enc: "v1.a.b.c", iv: "abc" }));
    expect(out.secret_enc).toBe("[redacted]");
  });

  it("covers the portal and approval tokens", () => {
    const out = asRecord(redact({ portal_token: "e3b0", token: "abc" }));
    expect(out.portal_token).toBe("[redacted]");
    expect(out.token).toBe("[redacted]");
  });

  it("covers camelCase, which the exact-match set never did", () => {
    const out = asRecord(
      redact({ refreshToken: "x", clientSecret: "y", apiKey: "z" }),
    );
    expect(out.refreshToken).toBe("[redacted]");
    expect(out.clientSecret).toBe("[redacted]");
    expect(out.apiKey).toBe("[redacted]");
  });

  it("covers personal data the platform holds under LGPD", () => {
    const out = asRecord(
      redact({ email: "a@b.com", phone: "+5511", cpf: "000", cnpj: "111" }),
    );
    for (const k of ["email", "phone", "cpf", "cnpj"]) {
      expect(out[k]).toBe("[redacted]");
    }
  });

  it("reaches into nested objects and arrays", () => {
    const out = asRecord(
      redact({ profile: { google_refresh_token: "x" }, rows: [{ token: "y" }] }),
    );
    expect(asRecord(out.profile).google_refresh_token).toBe("[redacted]");
    expect(asRecord((out.rows as unknown[])[0]).token).toBe("[redacted]");
  });

  it("leaves the fields that make a log line worth reading", () => {
    const out = asRecord(redact({ code: "23505", clientId: "abc", count: 3 }));
    expect(out.code).toBe("23505");
    expect(out.clientId).toBe("abc");
    expect(out.count).toBe(3);
  });
});

describe("what used to take the request down", () => {
  it("survives a cycle instead of overflowing the stack", () => {
    const a: Record<string, unknown> = { name: "a" };
    a.self = a;
    expect(() => redact(a)).not.toThrow();
    expect(asRecord(redact(a)).self).toBe("[circular]");
  });

  it("survives an Error's cause chain", () => {
    const err = new Error("outer", { cause: new Error("inner") });
    const out = asRecord(redact({ err }));
    expect(asRecord(out.err).message).toBe("outer");
  });

  it("stops at a depth rather than walking forever", () => {
    let deep: Record<string, unknown> = { end: true };
    for (let i = 0; i < 12; i++) deep = { next: deep };
    expect(() => redact(deep)).not.toThrow();
    expect(JSON.stringify(redact(deep))).toContain("[depth]");
  });

  it("does not turn an Error into an empty object", () => {
    // Object.entries(new Error("boom")) is [], so an unhandled Error used to
    // log as {} — the log line that tells you nothing at all.
    const out = asRecord(redact({ err: new Error("boom") }));
    expect(asRecord(out.err).message).toBe("boom");
  });
});
