import { describe, it, expect } from "vitest";

import {
  signedAmount,
  accrualFor,
  obligationStatus,
  initialInvoiceStatus,
  parseRate,
} from "@/lib/finance-entry";

describe("signedAmount", () => {
  it("makes an expense negative and income positive", () => {
    expect(signedAmount("out", 35000)).toBe(-35000);
    expect(signedAmount("in", 35000)).toBe(35000);
  });

  it("does not let a typed minus flip an expense into income", () => {
    // "out of -350" is not income. The sign belongs to the direction the
    // person picked, not to the characters they typed in the amount.
    expect(signedAmount("out", -35000)).toBe(-35000);
    expect(signedAmount("in", -35000)).toBe(35000);
  });
});

describe("accrualFor", () => {
  it("defaults to the cash date, not to today", () => {
    expect(accrualFor("2026-09-28", null)).toBe("2026-09-28");
    expect(accrualFor("2026-09-28", "")).toBe("2026-09-28");
    expect(accrualFor("2026-09-28", "   ")).toBe("2026-09-28");
  });

  it("keeps a typed accrual, which is the whole point of the column", () => {
    // August's retainer paid on 5 September: September's cash, August's
    // revenue.
    expect(accrualFor("2026-09-05", "2026-08-31")).toBe("2026-08-31");
  });
});

describe("obligationStatus", () => {
  const today = "2026-09-11";

  it("reads late from the due date rather than from the column", () => {
    expect(
      obligationStatus(
        { paid_on: null, status: "open", due_on: "2026-08-20" },
        today,
      ),
    ).toBe("late");
  });

  it("is open on the due date itself", () => {
    expect(
      obligationStatus(
        { paid_on: null, status: "open", due_on: today },
        today,
      ),
    ).toBe("open");
  });

  it("paid beats overdue", () => {
    expect(
      obligationStatus(
        { paid_on: "2026-09-02", status: "open", due_on: "2026-08-20" },
        today,
      ),
    ).toBe("paid");
  });

  it("cancelled beats everything", () => {
    expect(
      obligationStatus(
        { paid_on: "2026-09-02", status: "cancelled", due_on: "2026-08-20" },
        today,
      ),
    ).toBe("cancelled");
  });
});

describe("initialInvoiceStatus", () => {
  it("starts an export as an export, so it never enters the nota queue", () => {
    expect(initialInvoiceStatus("US")).toBe("export");
  });

  it("starts a Brazilian client pending", () => {
    expect(initialInvoiceStatus("BR")).toBe("pending");
  });

  it("treats an unknown country as domestic", () => {
    // Guessing "export" for a missing country would suppress a nota the studio
    // does owe. Pending is the safe direction: it shows up in a queue someone
    // reads, rather than disappearing from one.
    expect(initialInvoiceStatus(null)).toBe("pending");
  });
});

describe("parseRate", () => {
  it("reads both separators as a decimal point", () => {
    expect(parseRate("5,37")).toBe(5.37);
    expect(parseRate("5.37")).toBe(5.37);
  });

  it("never reads a dot as thousands, unlike money", () => {
    // parseBrlToCents turns "5.370" into 5370 cents because in Brazil the dot
    // groups thousands. Applied to a rate that is 5370 reais to the dollar,
    // and the Wise balance converts into the billions.
    expect(parseRate("5.370")).toBe(5.37);
  });

  it("refuses what cannot be a rate", () => {
    expect(parseRate("")).toBeNull();
    expect(parseRate("0")).toBeNull();
    expect(parseRate("-5")).toBeNull();
    expect(parseRate("abc")).toBeNull();
    expect(parseRate("5.3.7")).toBeNull();
    expect(parseRate("5370")).toBeNull();
  });

  it("rounds to the six decimals the column stores", () => {
    expect(parseRate("5,3712345")).toBe(5.371235);
  });
});
