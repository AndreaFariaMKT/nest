import { describe, expect, it } from "vitest";
import { parseVtt, wordCount } from "@/lib/vtt";

describe("parseVtt", () => {
  it("strips header, numeric cues, and timing lines", () => {
    const vtt = `WEBVTT

1
00:00:00.000 --> 00:00:05.000
Hello world.

2
00:00:05.500 --> 00:00:10.000
How are you?
`;
    expect(parseVtt(vtt)).toBe("Hello world.\nHow are you?");
  });

  it("handles comma decimal in timings (SRT-style)", () => {
    const vtt = `WEBVTT

00:00:00,000 --> 00:00:02,000
Olá.
`;
    expect(parseVtt(vtt)).toBe("Olá.");
  });

  it("skips NOTE blocks", () => {
    const vtt = `WEBVTT

NOTE this file was converted from mp4
by a tool

1
00:00:00.000 --> 00:00:05.000
Speaker says hi.
`;
    expect(parseVtt(vtt)).toBe("Speaker says hi.");
  });

  it("expands <v Name>text</v> to 'Name: text'", () => {
    const vtt = `WEBVTT

00:00:00.000 --> 00:00:05.000
<v Andréa>Olá, tudo bem?</v>
`;
    expect(parseVtt(vtt)).toBe("Andréa: Olá, tudo bem?");
  });

  it("keeps multi-line cues together", () => {
    const vtt = `WEBVTT

00:00:00.000 --> 00:00:05.000
First line.
Second line.
`;
    expect(parseVtt(vtt)).toBe("First line.\nSecond line.");
  });

  it("leaves plain text untouched", () => {
    const plain = "Just a plain transcript.\nNo metadata.";
    expect(parseVtt(plain)).toBe(plain);
  });

  it("strips inline color / timestamp tags", () => {
    const vtt = `WEBVTT

00:00:00.000 --> 00:00:05.000
<c.speaker1>Hello</c> <00:00:02.500>world<00:00:04.000>
`;
    expect(parseVtt(vtt)).toBe("Hello world");
  });
});

describe("wordCount", () => {
  it("counts whitespace-separated tokens", () => {
    expect(wordCount("Olá mundo pequeno")).toBe(3);
  });
  it("ignores excess whitespace", () => {
    expect(wordCount("   one   two   ")).toBe(2);
  });
  it("returns 0 for empty input", () => {
    expect(wordCount("")).toBe(0);
    expect(wordCount("   ")).toBe(0);
  });
});
