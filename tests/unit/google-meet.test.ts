import { describe, expect, it } from "vitest";
import { entriesToPlainText, extractMeetingCode } from "@/lib/google-meet";

describe("extractMeetingCode", () => {
  it("returns the path code for a standard Meet URL", () => {
    expect(extractMeetingCode("https://meet.google.com/abc-defg-hij")).toBe(
      "abc-defg-hij",
    );
  });

  it("ignores query strings and trailing path segments", () => {
    expect(
      extractMeetingCode("https://meet.google.com/abc-defg-hij?authuser=0"),
    ).toBe("abc-defg-hij");
    expect(extractMeetingCode("https://meet.google.com/abc-defg-hij/extra")).toBe(
      "abc-defg-hij",
    );
  });

  it("handles /lookup/ prefix", () => {
    expect(extractMeetingCode("https://meet.google.com/lookup/abc123")).toBe(
      "abc123",
    );
  });

  it("returns null for unrelated hosts", () => {
    expect(extractMeetingCode("https://zoom.us/j/123456")).toBeNull();
    expect(extractMeetingCode("https://example.com/abc-defg-hij")).toBeNull();
  });

  it("returns null for null/empty/invalid", () => {
    expect(extractMeetingCode(null)).toBeNull();
    expect(extractMeetingCode("")).toBeNull();
    expect(extractMeetingCode(undefined)).toBeNull();
    expect(extractMeetingCode("not a url")).toBeNull();
  });
});

describe("entriesToPlainText", () => {
  it("emits one `Speaker: text` line per non-empty entry", () => {
    const text = entriesToPlainText([
      { name: "x/entries/1", participant: "x/participants/Andrea", text: "Vamos começar." },
      { name: "x/entries/2", participant: "x/participants/Nayara", text: "Pode mandar." },
    ]);
    expect(text).toBe("Andrea: Vamos começar.\nNayara: Pode mandar.");
  });

  it("falls back to Unknown when no participant", () => {
    const text = entriesToPlainText([
      { name: "x/entries/1", text: "Hello." },
    ]);
    expect(text).toBe("Unknown: Hello.");
  });

  it("drops empty / whitespace-only entries", () => {
    const text = entriesToPlainText([
      { name: "x/entries/1", text: "  " },
      { name: "x/entries/2", text: "real" },
      { name: "x/entries/3", text: "" },
    ]);
    expect(text).toBe("Unknown: real");
  });

  it("returns an empty string for an empty array", () => {
    expect(entriesToPlainText([])).toBe("");
  });
});
