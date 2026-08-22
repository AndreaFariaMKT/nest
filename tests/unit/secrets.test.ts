import { describe, it, expect, afterEach } from "vitest";
import { randomBytes } from "node:crypto";

import {
  SecretKeyError,
  decryptSecret,
  encryptSecret,
  secretsAvailable,
} from "@/lib/secrets";

const KEY = randomBytes(32).toString("base64");
const OTHER = randomBytes(32).toString("base64");

afterEach(() => {
  delete process.env.SOCIAL_SECRET_KEY;
});

describe("encryptSecret / decryptSecret", () => {
  it("round-trips a password", () => {
    const payload = encryptSecret("HFsocial-2026!aq", KEY);
    expect(decryptSecret(payload, KEY)).toBe("HFsocial-2026!aq");
  });

  it("never stores the plaintext in the payload", () => {
    const payload = encryptSecret("hunter2", KEY);
    expect(payload).not.toContain("hunter2");
    expect(Buffer.from(payload.split(".")[3], "base64url").toString("utf8")).not.toBe(
      "hunter2",
    );
  });

  it("produces a different payload every time", () => {
    // A fresh nonce per write, so two accounts with the same password do not
    // produce the same ciphertext.
    expect(encryptSecret("same", KEY)).not.toBe(encryptSecret("same", KEY));
  });

  it("handles unicode and long secrets", () => {
    const long = "ção-🔐-" + "x".repeat(500);
    expect(decryptSecret(encryptSecret(long, KEY), KEY)).toBe(long);
  });

  it("accepts a hex key as well as base64", () => {
    const hex = randomBytes(32).toString("hex");
    expect(decryptSecret(encryptSecret("abc", hex), hex)).toBe("abc");
  });

  it("returns null under a different key rather than throwing", () => {
    expect(decryptSecret(encryptSecret("abc", KEY), OTHER)).toBeNull();
  });

  it("returns null when the ciphertext was tampered with", () => {
    const payload = encryptSecret("abc", KEY);
    const parts = payload.split(".");
    const ct = Buffer.from(parts[3], "base64url");
    ct[0] ^= 0xff;
    parts[3] = ct.toString("base64url");
    expect(decryptSecret(parts.join("."), KEY)).toBeNull();
  });

  it("returns null when the auth tag was tampered with", () => {
    const parts = encryptSecret("abc", KEY).split(".");
    const tag = Buffer.from(parts[2], "base64url");
    tag[0] ^= 0xff;
    parts[2] = tag.toString("base64url");
    expect(decryptSecret(parts.join("."), KEY)).toBeNull();
  });

  it("returns null for junk, empty and null input", () => {
    expect(decryptSecret(null, KEY)).toBeNull();
    expect(decryptSecret("", KEY)).toBeNull();
    expect(decryptSecret("not-a-payload", KEY)).toBeNull();
    expect(decryptSecret("v9.a.b.c", KEY)).toBeNull();
  });
});

describe("key handling", () => {
  it("refuses a key that is not 32 bytes", () => {
    expect(() => encryptSecret("x", "too-short")).toThrow(SecretKeyError);
  });

  it("refuses to encrypt with no key configured", () => {
    expect(() => encryptSecret("x")).toThrow(SecretKeyError);
  });

  it("reports availability from the environment", () => {
    expect(secretsAvailable()).toBe(false);
    process.env.SOCIAL_SECRET_KEY = KEY;
    expect(secretsAvailable()).toBe(true);
    process.env.SOCIAL_SECRET_KEY = "nope";
    expect(secretsAvailable()).toBe(false);
  });

  it("reads the key from the environment when none is passed", () => {
    process.env.SOCIAL_SECRET_KEY = KEY;
    expect(decryptSecret(encryptSecret("env-key"))).toBe("env-key");
  });
});
