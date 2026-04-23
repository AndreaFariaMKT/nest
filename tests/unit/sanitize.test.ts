import { describe, expect, it } from "vitest";
import {
  cleanLine,
  cleanText,
  collapseInlineWhitespace,
  limitBlankLines,
  stripControlChars,
} from "@/lib/sanitize";

describe("stripControlChars", () => {
  it("removes NULL bytes", () => {
    expect(stripControlChars("hello\u0000world")).toBe("helloworld");
  });

  it("preserves \\n \\r \\t", () => {
    expect(stripControlChars("a\nb\tc\rd")).toBe("a\nb\tc\rd");
  });

  it("removes BOM", () => {
    expect(stripControlChars("\uFEFFhello")).toBe("hello");
  });

  it("removes bidi-override chars", () => {
    expect(stripControlChars("safe\u202Eattack")).toBe("safeattack");
  });

  it("removes zero-width joiners", () => {
    expect(stripControlChars("foo\u200Bbar")).toBe("foobar");
  });

  it("leaves ordinary unicode alone", () => {
    expect(stripControlChars("café — naïve 🚀")).toBe("café — naïve 🚀");
  });
});

describe("collapseInlineWhitespace", () => {
  it("collapses runs of spaces", () => {
    expect(collapseInlineWhitespace("hello     world")).toBe("hello world");
  });

  it("collapses tabs + mixed", () => {
    expect(collapseInlineWhitespace("a\t  \tb")).toBe("a b");
  });

  it("preserves newlines", () => {
    expect(collapseInlineWhitespace("a  b\nc  d")).toBe("a b\nc d");
  });

  it("trims trailing whitespace on each line", () => {
    expect(collapseInlineWhitespace("a   \nb  ")).toBe("a\nb");
  });
});

describe("limitBlankLines", () => {
  it("keeps up to 2 consecutive blank lines by default", () => {
    const input = "a\n\n\n\nb";
    // 4 newlines -> 3 (max 2 blanks means at most 3 \n in a row)
    expect(limitBlankLines(input)).toBe("a\n\n\nb");
  });

  it("respects custom max", () => {
    expect(limitBlankLines("a\n\n\nb", 1)).toBe("a\n\nb");
  });

  it("leaves short gaps untouched", () => {
    expect(limitBlankLines("a\nb\n\nc")).toBe("a\nb\n\nc");
  });
});

describe("cleanText", () => {
  it("chains: strips control + collapses + limits blanks + trims", () => {
    const dirty = "   \u0000hello   world\n\n\n\ngoodbye\n  \n";
    expect(cleanText(dirty)).toBe("hello world\n\n\ngoodbye");
  });

  it("truncates when maxLength is set", () => {
    expect(cleanText("abcdefghij", { maxLength: 5 })).toBe("abcde");
  });

  it("respects trim: false (leading collapsed-space kept, trailing per-line stripped)", () => {
    // collapseInlineWhitespace collapses the 2 leading spaces to 1 and
    // strips trailing whitespace per line. trim: false then skips the
    // outer .trim() step, preserving that single leading space.
    expect(cleanText("  hi  ", { trim: false })).toBe(" hi");
  });

  it("no-op on already-clean text", () => {
    expect(cleanText("Hello, world!")).toBe("Hello, world!");
  });
});

describe("cleanLine", () => {
  it("drops newlines and collapses whitespace", () => {
    expect(cleanLine("a\n   b\nc")).toBe("a b c");
  });

  it("strips control chars", () => {
    expect(cleanLine("hello\u0000world")).toBe("helloworld");
  });

  it("applies maxLength", () => {
    expect(cleanLine("abcdefghij", 4)).toBe("abcd");
  });

  it("returns empty string for whitespace-only input", () => {
    expect(cleanLine("   \n\t  ")).toBe("");
  });
});
