import { describe, it, expect } from "vitest";

import {
  refFromUrl,
  refFromKey,
  keyMismatches,
} from "@/lib/supabase-key-ref";

/** A legacy Supabase key is an unsigned-readable JWT; only `ref` is read. */
function jwt(payload: Record<string, unknown>): string {
  const b64 = (o: unknown) =>
    Buffer.from(JSON.stringify(o))
      .toString("base64")
      .replace(/=+$/, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");
  return `eyJhbGciOiJIUzI1NiJ9.${b64(payload)}.signature-not-checked`;
}

const SP = "eorvzmvjmxmfejujbgiu";
const OLD = "wntrsavneabdcrztwudf";

describe("refFromUrl", () => {
  it("reads the project from the API URL", () => {
    expect(refFromUrl(`https://${SP}.supabase.co`)).toBe(SP);
  });

  it("is null for anything that is not one", () => {
    expect(refFromUrl(undefined)).toBeNull();
    expect(refFromUrl("")).toBeNull();
    expect(refFromUrl("http://localhost:54321")).toBeNull();
  });
});

describe("refFromKey", () => {
  it("reads the project a legacy key was issued for", () => {
    expect(refFromKey(jwt({ ref: SP, role: "service_role" }))).toBe(SP);
  });

  it("says nothing about the new key format", () => {
    // sb_secret_… carries no readable claims. Null means "cannot tell", which
    // has to stay distinct from "mismatch".
    expect(refFromKey("sb_secret_abc123")).toBeNull();
    expect(refFromKey("sb_publishable_abc123")).toBeNull();
  });

  it("survives a malformed key without throwing", () => {
    expect(refFromKey("eyJnonsense")).toBeNull();
    expect(refFromKey("eyJa.eyJb")).toBeNull();
    expect(refFromKey(undefined)).toBeNull();
  });
});

describe("keyMismatches", () => {
  it("names the variable holding a key from another project", () => {
    // The cutover to São Paulo, exactly: the public pair moved and the service
    // key did not. Every other signal said the configuration was fine.
    expect(
      keyMismatches(`https://${SP}.supabase.co`, [
        { variable: "NEXT_PUBLIC_SUPABASE_ANON_KEY", value: jwt({ ref: SP }) },
        { variable: "SUPABASE_SERVICE_ROLE_KEY", value: jwt({ ref: OLD }) },
      ]),
    ).toEqual([
      { variable: "SUPABASE_SERVICE_ROLE_KEY", keyRef: OLD, urlRef: SP },
    ]);
  });

  it("is quiet when everything agrees", () => {
    expect(
      keyMismatches(`https://${SP}.supabase.co`, [
        { variable: "SUPABASE_SERVICE_ROLE_KEY", value: jwt({ ref: SP }) },
      ]),
    ).toEqual([]);
  });

  it("never guesses when a ref cannot be read", () => {
    // A new-format key and an unparseable URL must both produce silence, not a
    // warning that sends someone to rotate a key that was fine.
    expect(
      keyMismatches(`https://${SP}.supabase.co`, [
        { variable: "SUPABASE_SERVICE_ROLE_KEY", value: "sb_secret_x" },
      ]),
    ).toEqual([]);
    expect(
      keyMismatches("http://localhost:54321", [
        { variable: "SUPABASE_SERVICE_ROLE_KEY", value: jwt({ ref: OLD }) },
      ]),
    ).toEqual([]);
  });
});
