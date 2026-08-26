import { describe, expect, it } from "vitest";
import { formatCentsAsBrl, parseBrlToCents, sumCents } from "@/lib/money";

describe("parseBrlToCents", () => {
  it("parses plain integers as whole reais", () => {
    expect(parseBrlToCents("4500")).toBe(450000);
  });

  it("parses comma decimal", () => {
    expect(parseBrlToCents("4500,50")).toBe(450050);
  });

  it("parses dot decimal", () => {
    expect(parseBrlToCents("4500.50")).toBe(450050);
  });

  it("parses thousand separators with comma decimal", () => {
    expect(parseBrlToCents("4.500,50")).toBe(450050);
  });

  it("tolerates R$ prefix and whitespace", () => {
    expect(parseBrlToCents("R$ 1.200,00")).toBe(120000);
  });

  it("rejects negatives", () => {
    expect(parseBrlToCents("-100")).toBeNull();
  });

  it("rejects non-numeric input", () => {
    expect(parseBrlToCents("oi")).toBeNull();
    expect(parseBrlToCents("")).toBeNull();
  });
});

describe("formatCentsAsBrl", () => {
  it("formats zero as R$ 0,00", () => {
    expect(formatCentsAsBrl(0)).toMatch(/R\$\s*0,00/);
  });

  it("formats thousand separator", () => {
    expect(formatCentsAsBrl(450050)).toMatch(/R\$\s*4\.500,50/);
  });

  it("renders em-dash for null / undefined", () => {
    expect(formatCentsAsBrl(null)).toBe("—");
    expect(formatCentsAsBrl(undefined)).toBe("—");
  });

  it("accepts bigint inputs", () => {
    expect(formatCentsAsBrl(BigInt(120000))).toMatch(/R\$\s*1\.200,00/);
  });
});

describe("sumCents", () => {
  it("ignores nulls and sums the rest", () => {
    expect(sumCents([100, null, 250, undefined, BigInt(50)])).toBe(400);
  });
  it("returns zero for empty input", () => {
    expect(sumCents([])).toBe(0);
  });
});

describe("a dot with no comma", () => {
  /**
   * The dot used to be read as a decimal point always. In Brazil it is the
   * thousands separator, so a R$ 12.000 retainer typed the way the founder
   * writes it stored R$ 12,00 — every MRR figure on /finance, /today and the
   * client page wrong by a factor of a thousand, silently, in the direction
   * that still looks like money.
   */
  it("reads groups of three as thousands", () => {
    expect(parseBrlToCents("12.000")).toBe(1_200_000);
    expect(parseBrlToCents("1.500")).toBe(150_000);
    expect(parseBrlToCents("1.234.567")).toBe(123_456_700);
  });

  /**
   * And only then. Someone typing on a habit from another locale still gets
   * what they meant, because a decimal point is never followed by exactly
   * three digits in a price.
   */
  it("still reads anything else as a decimal point", () => {
    expect(parseBrlToCents("4500.50")).toBe(450_050);
    expect(parseBrlToCents("0.5")).toBe(50);
    expect(parseBrlToCents("1.50")).toBe(150);
  });

  it("leaves the unambiguous forms alone", () => {
    expect(parseBrlToCents("4.500,50")).toBe(450_050);
    expect(parseBrlToCents("4500,50")).toBe(450_050);
    expect(parseBrlToCents("4500")).toBe(450_000);
  });
});
