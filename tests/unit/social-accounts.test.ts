import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/secrets", () => ({
  secretsAvailable: () => mockKeyPresent,
  decryptSecret: (v: string) => (v === "GOOD" ? "plaintext-token" : null),
}));

let mockKeyPresent = true;

const { resolveAccount, accountIndex, accountKey } = await import(
  "@/lib/social-accounts"
);
type Row = Parameters<typeof resolveAccount>[0];

const row = (over: Partial<NonNullable<Row>> = {}): NonNullable<Row> => ({
  client_id: "c1",
  platform: "instagram",
  account_ref: "17841400000000000",
  secret_enc: "GOOD",
  api_version: null,
  publish_mode: "inbox",
  enabled: true,
  ...over,
});

beforeEach(() => {
  mockKeyPresent = true;
});

/**
 * The publish path used to hold one set of credentials for the whole
 * deployment, so a second client's approved post would have gone live on the
 * first client's feed. These tests pin the states that decide whether a piece
 * publishes at all — and, above everything, that it never publishes as someone
 * it was not registered against.
 */

describe("when an account may publish", () => {
  it("resolves a registered, enabled account with a readable token", () => {
    const r = resolveAccount(row());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.platform).toBe("instagram");
    expect(r.creds).toEqual({
      token: "plaintext-token",
      igBusinessAccountId: "17841400000000000",
      apiVersion: "v21.0",
    });
  });

  it("refuses when the client has no account at all", () => {
    // The state every client is in before onboarding. It must read as "wait",
    // never as "use whatever credential the deployment happens to hold".
    const r = resolveAccount(null);
    expect(r).toEqual({ ok: false, problem: "no_account" });
  });

  it("refuses a registered account that is switched off", () => {
    const r = resolveAccount(row({ enabled: false }));
    expect(r).toEqual({ ok: false, problem: "not_enabled" });
  });

  it("reports not_enabled before no_secret, because that is the real state", () => {
    // A half-finished onboarding is off AND tokenless. Saying "no token" would
    // send someone to paste a token that still would not publish.
    const r = resolveAccount(row({ enabled: false, secret_enc: null }));
    expect(r).toEqual({ ok: false, problem: "not_enabled" });
  });

  it("refuses an enabled account with no token", () => {
    const r = resolveAccount(row({ secret_enc: null }));
    expect(r).toEqual({ ok: false, problem: "no_secret" });
  });

  it("tells a rotated key apart from a missing one", () => {
    // Both leave the studio unable to publish, but the fixes are different:
    // one is a deploy variable, the other is re-entering every token.
    mockKeyPresent = false;
    expect(resolveAccount(row())).toEqual({
      ok: false,
      problem: "no_secret_key",
    });
    mockKeyPresent = true;
    expect(resolveAccount(row({ secret_enc: "TAMPERED" }))).toEqual({
      ok: false,
      problem: "secret_unreadable",
    });
  });
});

describe("what each network needs to be posted to", () => {
  it("will not publish to Instagram without a business account id", () => {
    const r = resolveAccount(row({ account_ref: null }));
    expect(r).toEqual({ ok: false, problem: "no_account_ref" });
  });

  it("will not publish to LinkedIn without an organization URN", () => {
    const r = resolveAccount(row({ platform: "linkedin", account_ref: null }));
    expect(r).toEqual({ ok: false, problem: "no_account_ref" });
  });

  it("does not demand a reference for TikTok, whose token names the account", () => {
    const r = resolveAccount(row({ platform: "tiktok", account_ref: null }));
    expect(r.ok).toBe(true);
  });

  it("defaults TikTok to the mode a human finalises", () => {
    const r = resolveAccount(row({ platform: "tiktok", publish_mode: "junk" }));
    expect(r.ok && r.platform === "tiktok" && r.creds.publishMode).toBe("inbox");
  });

  it("honours direct mode when it was chosen deliberately", () => {
    const r = resolveAccount(row({ platform: "tiktok", publish_mode: "direct" }));
    expect(r.ok && r.platform === "tiktok" && r.creds.publishMode).toBe("direct");
  });

  it("pins the API version per account when one is set", () => {
    const r = resolveAccount(row({ api_version: "v22.0" }));
    expect(r.ok && r.platform === "instagram" && r.creds.apiVersion).toBe("v22.0");
  });

  it("treats a blank API version as unset rather than as a version", () => {
    const r = resolveAccount(row({ api_version: "   " }));
    expect(r.ok && r.platform === "instagram" && r.creds.apiVersion).toBe("v21.0");
  });
});

describe("looking an account up for a batch", () => {
  it("keys on client AND platform, so one client's token cannot serve another", () => {
    const idx = accountIndex([
      row({ client_id: "a", platform: "instagram", account_ref: "A" }),
      row({ client_id: "b", platform: "instagram", account_ref: "B" }),
    ]);
    const a = resolveAccount(idx.get(accountKey("a", "instagram")));
    const b = resolveAccount(idx.get(accountKey("b", "instagram")));
    expect(a.ok && a.platform === "instagram" && a.creds.igBusinessAccountId).toBe("A");
    expect(b.ok && b.platform === "instagram" && b.creds.igBusinessAccountId).toBe("B");
  });

  it("returns nothing for a client with no row, rather than a neighbour's", () => {
    const idx = accountIndex([row({ client_id: "a" })]);
    expect(resolveAccount(idx.get(accountKey("z", "instagram")))).toEqual({
      ok: false,
      problem: "no_account",
    });
  });

  it("does not let one platform's account answer for another", () => {
    const idx = accountIndex([row({ client_id: "a", platform: "instagram" })]);
    expect(resolveAccount(idx.get(accountKey("a", "tiktok")))).toEqual({
      ok: false,
      problem: "no_account",
    });
  });
});
