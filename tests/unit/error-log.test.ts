import { describe, it, expect } from "vitest";

import { newRef, isFrameworkControlFlow, scrubStack } from "@/lib/error-log";

/**
 * The pure parts of the error log. What is NOT tested here is the insert —
 * that needs a database. What is tested is everything that decides whether a
 * row is safe to keep and legible to a person.
 */

describe("the code a person reads over the phone", () => {
  it("has a stable, quotable shape", () => {
    expect(newRef()).toMatch(/^NST-[A-Z0-9]{6}$/);
  });

  it("leaves out the glyphs people mishear", () => {
    // I/L/O and 0/1 are the pairs that turn a phone call into three attempts.
    const refs = Array.from({ length: 200 }, () => newRef()).join("");
    expect(refs).not.toMatch(/[ILO01]/);
  });

  it("does not repeat itself in a batch", () => {
    const seen = new Set(Array.from({ length: 500 }, () => newRef()));
    expect(seen.size).toBe(500);
  });
});

describe("what must never be recorded as an error", () => {
  it("recognises a redirect, which Next signals by throwing", () => {
    // Recording these would fill the log with the framework working, and
    // swallowing them would break the redirect itself.
    expect(isFrameworkControlFlow({ digest: "NEXT_REDIRECT;push;/today;307" })).toBe(true);
    expect(isFrameworkControlFlow({ digest: "NEXT_NOT_FOUND" })).toBe(true);
    expect(isFrameworkControlFlow({ digest: "DYNAMIC_SERVER_USAGE" })).toBe(true);
  });

  it("lets a real error through", () => {
    expect(isFrameworkControlFlow(new Error("boom"))).toBe(false);
    expect(isFrameworkControlFlow({ digest: "something-else" })).toBe(false);
    expect(isFrameworkControlFlow(null)).toBe(false);
  });
});

describe("scrubbing a stack before it is stored", () => {
  it("strips a bearer token", () => {
    const out = scrubStack("at fetch (Authorization: Bearer sk_live_abc123def456)");
    expect(out).not.toContain("sk_live_abc123def456");
    expect(out).toContain("[redacted]");
  });

  it("strips a token in a query string", () => {
    const out = scrubStack("at GET https://x.co/a?token=e3b0c44298fc1c14&y=1");
    expect(out).not.toContain("e3b0c44298fc1c14");
    expect(out).toContain("y=1");
  });

  it("strips a long opaque blob, which is what a Meta token looks like", () => {
    const token = "EAAG" + "x".repeat(120);
    expect(scrubStack(`at post (${token})`)).not.toContain(token);
  });

  it("leaves an ordinary stack readable", () => {
    const stack =
      "Error: boom\n    at listPieces (src/app/social/_data.ts:118:5)\n    at Page";
    const out = scrubStack(stack);
    expect(out).toContain("listPieces");
    expect(out).toContain("_data.ts:118:5");
  });

  it("is a reduction, not a guarantee — a short secret survives", () => {
    // Stated as a test so nobody mistakes this for redaction. The real
    // protections are that Postgres errors never reach here and that the
    // table is founder-only.
    expect(scrubStack("at f (pw=hunter2)")).toContain("hunter2");
  });
});
