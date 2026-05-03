import { describe, expect, it } from "vitest";
import {
  buildPostBody,
  DEFAULT_API_VERSION,
  hasCredentials,
  readCredentials,
} from "@/lib/linkedin";

describe("readCredentials", () => {
  it("reports missing env vars by name", () => {
    const result = readCredentials({});
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.missing).toEqual([
        "LINKEDIN_ACCESS_TOKEN",
        "LINKEDIN_ORGANIZATION_URN",
      ]);
    }
  });

  it("treats whitespace-only values as missing", () => {
    const result = readCredentials({
      LINKEDIN_ACCESS_TOKEN: "  ",
      LINKEDIN_ORGANIZATION_URN: "urn:li:organization:1",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.missing).toEqual(["LINKEDIN_ACCESS_TOKEN"]);
    }
  });

  it("defaults LINKEDIN_API_VERSION to a supported pinned version", () => {
    const result = readCredentials({
      LINKEDIN_ACCESS_TOKEN: "tok",
      LINKEDIN_ORGANIZATION_URN: "urn:li:organization:1",
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.creds.apiVersion).toBe(DEFAULT_API_VERSION);
  });

  it("respects an override for LINKEDIN_API_VERSION", () => {
    const result = readCredentials({
      LINKEDIN_ACCESS_TOKEN: "tok",
      LINKEDIN_ORGANIZATION_URN: "urn:li:organization:1",
      LINKEDIN_API_VERSION: "202401",
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.creds.apiVersion).toBe("202401");
  });
});

describe("hasCredentials", () => {
  it("delegates to readCredentials", () => {
    expect(hasCredentials({})).toBe(false);
    expect(
      hasCredentials({
        LINKEDIN_ACCESS_TOKEN: "a",
        LINKEDIN_ORGANIZATION_URN: "b",
      }),
    ).toBe(true);
  });
});

describe("buildPostBody", () => {
  const orgUrn = "urn:li:organization:42";
  const caption = "Hello world";

  it("emits PUBLIC visibility + MAIN_FEED distribution + lifecycle PUBLISHED by default", () => {
    const body = buildPostBody({
      organizationUrn: orgUrn,
      caption,
      images: [],
    });
    expect(body.author).toBe(orgUrn);
    expect(body.commentary).toBe(caption);
    expect(body.visibility).toBe("PUBLIC");
    expect(body.lifecycleState).toBe("PUBLISHED");
    expect(body.distribution.feedDistribution).toBe("MAIN_FEED");
    expect(body.isReshareDisabledByAuthor).toBe(false);
  });

  it("respects custom visibility", () => {
    const body = buildPostBody({
      organizationUrn: orgUrn,
      caption,
      images: [],
      visibility: "CONNECTIONS",
    });
    expect(body.visibility).toBe("CONNECTIONS");
  });

  it("omits content when zero images (text-only post)", () => {
    const body = buildPostBody({
      organizationUrn: orgUrn,
      caption,
      images: [],
    });
    expect(body.content).toBeUndefined();
  });

  it("uses single-media `content.media` for exactly one image", () => {
    const body = buildPostBody({
      organizationUrn: orgUrn,
      caption,
      images: [{ id: "urn:li:image:abc", altText: "alt" }],
    });
    expect(body.content).toEqual({
      media: { id: "urn:li:image:abc", altText: "alt" },
    });
  });

  it("uses `multiImage` when 2-9 images", () => {
    const images = Array.from({ length: 5 }, (_, i) => ({
      id: `urn:li:image:${i}`,
    }));
    const body = buildPostBody({
      organizationUrn: orgUrn,
      caption,
      images,
    });
    expect(body.content).toEqual({ multiImage: { images } });
  });

  it("clamps multiImage to LinkedIn's 9-image cap", () => {
    const images = Array.from({ length: 12 }, (_, i) => ({
      id: `urn:li:image:${i}`,
    }));
    const body = buildPostBody({
      organizationUrn: orgUrn,
      caption,
      images,
    });
    if (body.content && "multiImage" in body.content) {
      expect(body.content.multiImage.images).toHaveLength(9);
      expect(body.content.multiImage.images[0].id).toBe("urn:li:image:0");
      expect(body.content.multiImage.images[8].id).toBe("urn:li:image:8");
    } else {
      throw new Error("expected multiImage content");
    }
  });
});
