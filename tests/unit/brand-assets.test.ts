import { describe, expect, it } from "vitest";
import {
  buildAssetPath,
  detectAssetKind,
  isAllowedMimeType,
  MAX_ASSET_BYTES,
  validateAssetFile,
} from "@/lib/brand-assets";

describe("isAllowedMimeType", () => {
  it("accepts common image mimes", () => {
    expect(isAllowedMimeType("image/png")).toBe(true);
    expect(isAllowedMimeType("image/jpeg")).toBe(true);
    expect(isAllowedMimeType("image/svg+xml")).toBe(true);
    expect(isAllowedMimeType("image/webp")).toBe(true);
  });

  it("rejects unsafe mimes", () => {
    expect(isAllowedMimeType("application/pdf")).toBe(false);
    expect(isAllowedMimeType("text/html")).toBe(false);
    expect(isAllowedMimeType("application/x-executable")).toBe(false);
  });
});

describe("detectAssetKind", () => {
  it("detects svg by mime", () => {
    expect(detectAssetKind("mark.img", "image/svg+xml")).toBe("svg");
  });

  it("detects svg by extension even if mime is generic", () => {
    expect(detectAssetKind("LOGO.SVG", "application/octet-stream")).toBe("svg");
  });

  it("detects logo from filename hint", () => {
    expect(detectAssetKind("nayara-logo.png", "image/png")).toBe("logo");
  });

  it("defaults images to photo", () => {
    expect(detectAssetKind("sunset.jpg", "image/jpeg")).toBe("photo");
  });

  it("detects font from mime prefix", () => {
    expect(detectAssetKind("manier.otf", "font/otf")).toBe("font");
  });

  it("falls back to photo for unknown types", () => {
    expect(detectAssetKind("mystery.bin", "application/octet-stream")).toBe(
      "photo",
    );
  });
});

describe("buildAssetPath", () => {
  it("prefixes with kit id + timestamp + slug", () => {
    expect(buildAssetPath("abc", "Hello World.png")).toMatch(
      /^abc\/\d+-hello-world\.png$/,
    );
  });

  it("strips diacritics and collapses separators", () => {
    expect(buildAssetPath("k", "Nayára — Selfie.JPEG")).toMatch(
      /^k\/\d+-nayara-selfie\.jpeg$/,
    );
  });

  it("caps basename at 40 chars", () => {
    const long = "a".repeat(100);
    const path = buildAssetPath("k", `${long}.png`);
    // everything after the timestamp dash up to .png should be ≤40 chars
    const match = path.match(/^k\/\d+-(.+?)\.png$/);
    expect(match).not.toBeNull();
    expect(match![1].length).toBeLessThanOrEqual(40);
  });

  it("falls back to 'asset' when basename is entirely invalid", () => {
    expect(buildAssetPath("k", "___.png")).toMatch(/^k\/\d+-asset\.png$/);
  });
});

describe("validateAssetFile", () => {
  it("rejects files exceeding MAX_ASSET_BYTES", () => {
    expect(
      validateAssetFile({ size: MAX_ASSET_BYTES + 1, type: "image/png" }),
    ).toEqual({ ok: false, error: "tooLarge" });
  });

  it("rejects disallowed mimes", () => {
    expect(validateAssetFile({ size: 1000, type: "application/pdf" })).toEqual({
      ok: false,
      error: "invalidMime",
    });
  });

  it("accepts files under the cap with allowed mime", () => {
    expect(validateAssetFile({ size: 1000, type: "image/png" })).toEqual({
      ok: true,
    });
  });
});
