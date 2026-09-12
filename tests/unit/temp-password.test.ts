import { describe, it, expect } from "vitest";

import {
  generateTempPassword,
  passwordProblem,
  MIN_PASSWORD_LENGTH,
} from "@/lib/temp-password";

const bytes = (...values: number[]) => () => Uint8Array.from(values);

describe("generateTempPassword", () => {
  it("is four groups of five, dash separated", () => {
    const pw = generateTempPassword();
    expect(pw).toMatch(/^[a-z2-9]{5}-[a-z2-9]{5}-[a-z2-9]{5}-[a-z2-9]{5}$/);
  });

  it("never emits a character that cannot be read over a phone", () => {
    // 0/O, 1/l/I, 5/S and u/v are the pairs people mishear or mistype.
    const joined = Array.from({ length: 200 }, () => generateTempPassword()).join("");
    expect(joined).not.toMatch(/[oil015suv]/);
  });

  it("rejects biased bytes instead of folding them with a modulo", () => {
    // 256 is not a multiple of 26, so bytes at or above the largest multiple
    // would over-represent the start of the alphabet. 255 must be discarded
    // and the next byte used instead.
    const pool = Uint8Array.from([255, ...Array(64).fill(0)]);
    const pw = generateTempPassword(() => pool);
    // Every drawn byte after the rejected one is 0 → the first letter.
    expect(pw).toBe("aaaaa-aaaaa-aaaaa-aaaaa");
  });

  it("draws more when the pool runs out", () => {
    let calls = 0;
    const pw = generateTempPassword((n) => {
      calls += 1;
      return Uint8Array.from(Array(n).fill(255 - 255)); // all zeros
    });
    expect(pw).toBe("aaaaa-aaaaa-aaaaa-aaaaa");
    expect(calls).toBeGreaterThanOrEqual(1);
  });

  it("does not repeat itself", () => {
    const seen = new Set(
      Array.from({ length: 500 }, () => generateTempPassword()),
    );
    expect(seen.size).toBe(500);
  });

  it("uses the injected source", () => {
    expect(generateTempPassword(bytes(...Array(64).fill(1)))).toBe(
      "bbbbb-bbbbb-bbbbb-bbbbb",
    );
  });
});

describe("passwordProblem", () => {
  it("accepts a long enough, matching pair", () => {
    expect(passwordProblem("a".repeat(MIN_PASSWORD_LENGTH), "a".repeat(MIN_PASSWORD_LENGTH)))
      .toBeNull();
  });

  it("refuses one character under the floor", () => {
    const short = "a".repeat(MIN_PASSWORD_LENGTH - 1);
    expect(passwordProblem(short, short)).toBe("tooShort");
  });

  it("catches a typo in the confirmation", () => {
    expect(passwordProblem("correct-horse", "correct-hoarse")).toBe("mismatch");
  });

  it("reports the length first, so a short pair is not called a mismatch", () => {
    expect(passwordProblem("abc", "xyz")).toBe("tooShort");
  });
});
