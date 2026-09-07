import { describe, expect, it } from "vitest";

import {
  addBusinessDays,
  invoiceDueOn,
  invoiceQueue,
  isExport,
  isInvoiceLate,
  needsInvoice,
} from "@/lib/invoicing";

describe("isExport", () => {
  /**
   * Billing an export as domestic revenue puts it in the wrong bracket and
   * generates tax that was never owed — the specific mistake the studio's
   * manual exists to stop.
   */
  it("treats any non-BR client as an export", () => {
    expect(isExport("US")).toBe(true);
    expect(isExport("BR")).toBe(false);
    expect(isExport(null)).toBe(false);
  });
});

describe("needsInvoice", () => {
  it("does not ask for a nota against money that has not arrived", () => {
    expect(
      needsInvoice({ paid_on: null, invoice_status: "pending", country: "BR" }),
    ).toBe(false);
  });

  it("asks once the payment is confirmed", () => {
    expect(
      needsInvoice({ paid_on: "2026-08-10", invoice_status: "pending", country: "BR" }),
    ).toBe(true);
  });

  it("never asks for an export", () => {
    expect(
      needsInvoice({ paid_on: "2026-08-21", invoice_status: "pending", country: "US" }),
    ).toBe(false);
  });

  it("stops asking once it is issued", () => {
    expect(
      needsInvoice({ paid_on: "2026-08-10", invoice_status: "issued", country: "BR" }),
    ).toBe(false);
  });
});

describe("addBusinessDays", () => {
  it("skips the weekend", () => {
    // 2026-08-10 is a Monday; five business days lands on the Monday after.
    expect(addBusinessDays("2026-08-10", 5)).toBe("2026-08-17");
  });

  it("counts from a Friday into the next week", () => {
    // 2026-08-14 is a Friday.
    expect(addBusinessDays("2026-08-14", 1)).toBe("2026-08-17");
  });

  it("counts from a Saturday to the following Monday", () => {
    expect(addBusinessDays("2026-08-15", 1)).toBe("2026-08-17");
  });
});

describe("the five-day deadline", () => {
  it("is five business days from the receipt", () => {
    expect(invoiceDueOn("2026-08-10")).toBe("2026-08-17");
  });

  it("is late only after the deadline has passed", () => {
    expect(isInvoiceLate("2026-08-10", "2026-08-17")).toBe(false);
    expect(isInvoiceLate("2026-08-10", "2026-08-18")).toBe(true);
  });
});

describe("invoiceQueue", () => {
  const rows = [
    { id: "nayara", paid_on: "2026-08-10", invoice_status: "pending", country: "BR" },
    { id: "sos", paid_on: "2026-08-21", invoice_status: "pending", country: "US" },
    { id: "francisquini", paid_on: "2026-09-01", invoice_status: "requested", country: "BR" },
    { id: "unpaid", paid_on: null, invoice_status: "pending", country: "BR" },
    { id: "done", paid_on: "2026-07-10", invoice_status: "issued", country: "BR" },
  ];

  it("queues only what is paid, domestic and still owed, most overdue first", () => {
    const { due } = invoiceQueue(rows, "2026-09-07");
    expect(due.map((d) => d.id)).toEqual(["nayara", "francisquini"]);
  });

  it("flags the one past its deadline", () => {
    const { due } = invoiceQueue(rows, "2026-09-07");
    expect(due[0].late).toBe(true);
    expect(due[1].late).toBe(false);
  });

  /**
   * A row that simply vanishes from a to-do list looks like a row that was
   * forgotten, so exports are returned to be shown, not filtered away.
   */
  it("returns exports separately instead of dropping them", () => {
    const { exports } = invoiceQueue(rows, "2026-09-07");
    expect(exports.map((e) => e.id)).toEqual(["sos"]);
  });
});
