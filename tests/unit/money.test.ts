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
