import { describe, expect, it } from "vitest";

import {
  byCategory,
  cashFlow,
  isOpen,
  isOverdue,
  monthResult,
  monthsOfRunway,
  openTotal,
  operatingBalance,
  rateOnOrBefore,
  reserveBalance,
  toBrlCents,
  workingCapital,
  type Entry,
  type FxRate,
} from "@/lib/finance";

const RATES: FxRate[] = [
  { day: "2026-08-19", base: "USD", quote: "BRL", rate: 5.3 },
  { day: "2026-08-21", base: "USD", quote: "BRL", rate: 5.37 },
];
const rateFor = (day: string) => rateOnOrBefore(RATES, day);

describe("currency conversion", () => {
  it("leaves BRL alone", () => {
    expect(toBrlCents({ amount_cents: 350000, currency: "BRL" }, rateFor, "2026-08-21")).toBe(350000);
  });

  it("converts USD at the day's rate", () => {
    // USD 4,110.00 at 5.37 = R$ 22,070.70
    expect(
      toBrlCents({ amount_cents: 411000, currency: "USD" }, rateFor, "2026-08-21"),
    ).toBe(2207070);
  });

  /**
   * The two tempting fallbacks — a hardcoded constant, or 1:1 — both produce a
   * number that looks like money and is wrong, silently, on a dashboard.
   */
  it("returns null rather than guessing when there is no rate", () => {
    expect(
      toBrlCents({ amount_cents: 411000, currency: "USD" }, () => null, "2026-08-21"),
    ).toBeNull();
  });

  it("carries the last rate forward over a weekend", () => {
    // The 22nd is a Saturday with no quote; the 21st still applies.
    expect(rateOnOrBefore(RATES, "2026-08-22")).toBe(5.37);
  });

  it("never uses a rate from after the day — that would be hindsight", () => {
    expect(rateOnOrBefore(RATES, "2026-08-20")).toBe(5.3);
    expect(rateOnOrBefore(RATES, "2026-08-01")).toBeNull();
  });
});

describe("balances", () => {
  const accounts = [
    { currency: "BRL", kind: "operacional", balance_cents: 27797 },
    { currency: "USD", kind: "operacional", balance_cents: 574453 },
    { currency: "BRL", kind: "reserva", balance_cents: 3122362 },
  ];

  /**
   * The reserve exists in order not to be spent. Folding it into the operating
   * total is how a studio believes it has four months of runway when it has
   * one.
   */
  it("keeps the reserve out of the operating balance", () => {
    const operating = operatingBalance(accounts, 5.37);
    expect(operating).toBe(27797 + Math.round(574453 * 5.37));
    // The reserve is more than ten times the operating balance, so if it ever
    // leaked in this assertion is the one that catches it.
    expect(operating).toBeLessThan(3122362);
  });

  it("reports the reserve on its own", () => {
    expect(reserveBalance(accounts, 5.37)).toBe(3122362);
  });
});

describe("workingCapital", () => {
  it("is cash plus owed to us minus what we owe", () => {
    expect(
      workingCapital({
        operating_cents: 100000,
        receivable_cents: 50000,
        payable_cents: 20000,
      }),
    ).toBe(130000);
  });

  it("can be negative, and says so", () => {
    expect(
      workingCapital({
        operating_cents: 1000,
        receivable_cents: 0,
        payable_cents: 5000,
      }),
    ).toBe(-4000);
  });
});

describe("monthsOfRunway", () => {
  it("divides cash by monthly cost", () => {
    expect(monthsOfRunway(3000000, 1000000)).toBe(3);
  });

  /**
   * A studio with no recorded costs has not achieved infinite runway; it has
   * an empty ledger. "∞ meses" on a dashboard is worse than an em dash.
   */
  it("returns null instead of Infinity when there is no cost", () => {
    expect(monthsOfRunway(3000000, 0)).toBeNull();
  });
});

describe("cash against accrual", () => {
  /**
   * The distinction the whole module exists for: August's invoice paid in
   * September is September's cash and August's revenue. Both are right.
   */
  const entries: Entry[] = [
    {
      amount_cents: 400000,
      currency: "BRL",
      date_cash: "2026-09-05",
      date_accrual: "2026-08-31",
      category_kind: "income",
    },
    {
      amount_cents: -155000,
      currency: "BRL",
      date_cash: "2026-08-05",
      date_accrual: "2026-08-05",
      category_kind: "expense",
    },
  ];

  it("counts the receipt in September's cash", () => {
    expect(cashFlow(entries, "2026-09").inflow).toBe(400000);
    expect(cashFlow(entries, "2026-08").inflow).toBe(0);
  });

  it("counts the same receipt in August's revenue", () => {
    expect(monthResult(entries, "2026-08").revenue).toBe(400000);
    expect(monthResult(entries, "2026-09").revenue).toBe(0);
  });

  it("reports profit and margin on the accrual side", () => {
    const r = monthResult(entries, "2026-08");
    expect(r.cost).toBe(155000);
    expect(r.profit).toBe(245000);
    expect(r.margin).toBe(61);
  });

  it("has no margin to report when there was no revenue", () => {
    const costOnly: Entry[] = [
      {
        amount_cents: -1000,
        currency: "BRL",
        date_cash: "2026-08-01",
        date_accrual: "2026-08-01",
        category_kind: "expense",
      },
    ];
    expect(monthResult(costOnly, "2026-08").margin).toBe(0);
  });
});

describe("transfers", () => {
  /**
   * Moving money to the reserve is not spending and moving it back is not
   * income. Counted, a month that topped up the reserve reads as the studio's
   * worst month on record.
   */
  const withTransfer: Entry[] = [
    {
      amount_cents: -1000000,
      currency: "BRL",
      date_cash: "2026-08-17",
      date_accrual: "2026-08-17",
      category_kind: "transfer",
    },
    {
      amount_cents: -155000,
      currency: "BRL",
      date_cash: "2026-08-05",
      date_accrual: "2026-08-05",
      category_kind: "expense",
    },
  ];

  it("leaves a reserve top-up out of the month's outflow", () => {
    expect(cashFlow(withTransfer, "2026-08").outflow).toBe(155000);
  });

  it("leaves it out of cost, and out of the category breakdown", () => {
    expect(monthResult(withTransfer, "2026-08").cost).toBe(155000);
    expect(byCategory(withTransfer, "2026-08")).toHaveLength(1);
  });
});

describe("open receivables and payables", () => {
  const today = "2026-09-07";
  const rows = [
    { amount_cents: 400000, currency: "BRL", due_on: "2026-08-20", paid_on: null, status: "open" },
    { amount_cents: 350000, currency: "BRL", due_on: "2026-08-10", paid_on: "2026-08-10", status: "paid" },
    { amount_cents: 75000, currency: "USD", due_on: "2026-08-21", paid_on: null, status: "open" },
    { amount_cents: 99900, currency: "BRL", due_on: "2026-08-01", paid_on: null, status: "cancelled" },
  ];

  it("counts only what is genuinely still owed", () => {
    expect(rows.filter(isOpen)).toHaveLength(2);
  });

  it("treats a cancelled row as closed, not as overdue", () => {
    expect(isOverdue(rows[3], today)).toBe(false);
  });

  it("flags an open row past its due date", () => {
    expect(isOverdue(rows[0], today)).toBe(true);
  });

  it("converts foreign rows at the due date's rate", () => {
    const { total_cents, unconverted } = openTotal(rows, rateFor);
    expect(unconverted).toBe(0);
    expect(total_cents).toBe(400000 + Math.round(75000 * 5.37));
  });

  /**
   * A receivable that silently becomes zero because nobody entered Tuesday's
   * rate is only discovered when the money does not arrive.
   */
  it("reports rows it could not convert instead of counting them as zero", () => {
    const { total_cents, unconverted } = openTotal(rows, () => null);
    expect(unconverted).toBe(1);
    expect(total_cents).toBe(400000);
  });
});

describe("byCategory", () => {
  it("totals spend per category, largest first", () => {
    const rows = [
      { amount_cents: -155000, currency: "BRL", date_cash: "2026-08-05", date_accrual: "2026-08-05", category_kind: "expense", category_slug: "equipe" },
      { amount_cents: -135000, currency: "BRL", date_cash: "2026-08-05", date_accrual: "2026-08-05", category_kind: "expense", category_slug: "fornecedores" },
      { amount_cents: -37500, currency: "BRL", date_cash: "2026-08-27", date_accrual: "2026-08-27", category_kind: "expense", category_slug: "equipe" },
    ];
    expect(byCategory(rows, "2026-08")).toEqual([
      { slug: "equipe", total_cents: 192500 },
      { slug: "fornecedores", total_cents: 135000 },
    ]);
  });

  it("files an uncategorised expense rather than dropping it", () => {
    const rows = [
      { amount_cents: -20325, currency: "BRL", date_cash: "2026-08-17", date_accrual: "2026-08-17", category_kind: "expense", category_slug: null },
    ];
    expect(byCategory(rows, "2026-08")).toEqual([
      { slug: "sem-categoria", total_cents: 20325 },
    ]);
  });
});
