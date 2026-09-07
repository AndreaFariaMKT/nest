import { describe, expect, it } from "vitest";

import {
  dropAlreadyImported,
  namesCounterparty,
  normalise,
  reconcile,
  summarise,
  type BankLine,
  type Expected,
} from "@/lib/reconcile";

const expected: Expected[] = [
  {
    id: "petra",
    kind: "payable",
    amount_cents: -135000,
    date: "2026-08-05",
    counterparty: "Petra Maria Schauff Mendes",
    description: "Fornecedores",
  },
  {
    id: "nayara",
    kind: "receivable",
    amount_cents: 350000,
    date: "2026-08-10",
    counterparty: "Nayara Pimentel",
    description: "Retainer agosto",
  },
  {
    id: "das",
    kind: "payable",
    amount_cents: -81599,
    date: "2026-08-20",
    counterparty: "Receita Federal",
    description: "DAS",
  },
];

describe("normalise", () => {
  it("strips case, accents and punctuation from a shouted statement line", () => {
    expect(normalise("PIX ENVIADO PETRA MARIA SCHAUFF MENDES")).toBe(
      "pix enviado petra maria schauff mendes",
    );
    expect(normalise("Contabilidade · Ago/2026")).toBe("contabilidade ago 2026");
  });
});

describe("namesCounterparty", () => {
  it("finds a person named in full inside a bank description", () => {
    expect(
      namesCounterparty(
        "PIX ENVIADO PETRA MARIA SCHAUFF MENDES",
        "Petra Maria Schauff Mendes",
      ),
    ).toBe(true);
  });

  it("finds a short recorded name inside a longer legal one", () => {
    expect(
      namesCounterparty("PIX RECEBIDO N P PIMENTEL SOC IND ADV", "Pimentel"),
    ).toBe(true);
  });

  /**
   * One short common word matching is a coincidence, not a match. Without this
   * floor, "de" or "ltda" pairs a supplier with any line that mentions either.
   */
  it("does not match on a single short word", () => {
    expect(namesCounterparty("PIX ENVIADO ABC LTDA", "XYZ Ltda")).toBe(false);
  });

  it("is false when there is no counterparty recorded", () => {
    expect(namesCounterparty("QUALQUER COISA", null)).toBe(false);
  });
});

describe("reconcile", () => {
  it("marks a line as auto when amount, date and name all line up", () => {
    const lines: BankLine[] = [
      {
        external_ref: "1",
        date: "2026-08-05",
        description: "PIX ENVIADO PETRA MARIA SCHAUFF MENDES",
        amount_cents: -135000,
      },
    ];
    const [m] = reconcile(lines, expected);
    expect(m.kind).toBe("auto");
    expect(m.expected?.id).toBe("petra");
    expect(m.reasons).toEqual([]);
  });

  it("suggests rather than auto-files when the date is off by a day", () => {
    const lines: BankLine[] = [
      {
        external_ref: "2",
        date: "2026-08-06",
        description: "PIX ENVIADO PETRA MARIA SCHAUFF MENDES",
        amount_cents: -135000,
      },
    ];
    const [m] = reconcile(lines, expected);
    expect(m.kind).toBe("suggested");
    expect(m.reasons).toContain("dateDiffers");
  });

  it("suggests when the amount matches but nothing names the counterparty", () => {
    const lines: BankLine[] = [
      {
        external_ref: "3",
        date: "2026-08-05",
        description: "TRANSFER-2284017742",
        amount_cents: -135000,
      },
    ];
    const [m] = reconcile(lines, expected);
    expect(m.kind).toBe("suggested");
    expect(m.reasons).toContain("nameDiffers");
  });

  it("leaves a line with no matching amount unmatched", () => {
    const lines: BankLine[] = [
      {
        external_ref: "4",
        date: "2026-08-17",
        description: "TRANSFER REGUS ENIGMATIC SPACES",
        amount_cents: -20325,
      },
    ];
    const [m] = reconcile(lines, expected);
    expect(m.kind).toBe("unmatched");
    expect(m.expected).toBeNull();
  });

  it("refuses a match that is weeks away even at the same amount", () => {
    const lines: BankLine[] = [
      {
        external_ref: "5",
        date: "2026-09-20",
        description: "PIX ENVIADO PETRA MARIA SCHAUFF MENDES",
        amount_cents: -135000,
      },
    ];
    expect(reconcile(lines, expected)[0].kind).toBe("unmatched");
  });

  /**
   * The bug that makes a reconciliation silently under-count: two identical
   * payments in a month must consume two different expected rows, never the
   * same one twice.
   */
  it("consumes an expected row once, so duplicates do not both match it", () => {
    const twice: Expected[] = [
      { ...expected[0], id: "a" },
      { ...expected[0], id: "b" },
    ];
    const lines: BankLine[] = [
      { external_ref: "6", date: "2026-08-05", description: "PIX PETRA MARIA", amount_cents: -135000 },
      { external_ref: "7", date: "2026-08-05", description: "PIX PETRA MARIA", amount_cents: -135000 },
    ];
    const matched = reconcile(lines, twice);
    expect(matched[0].expected?.id).not.toBe(matched[1].expected?.id);
    expect(matched.every((m) => m.expected !== null)).toBe(true);
  });

  it("leaves the second of three identical lines unmatched when only two were expected", () => {
    const twice: Expected[] = [
      { ...expected[0], id: "a" },
      { ...expected[0], id: "b" },
    ];
    const lines: BankLine[] = Array.from({ length: 3 }, (_, i) => ({
      external_ref: String(i),
      date: "2026-08-05",
      description: "PIX PETRA MARIA",
      amount_cents: -135000,
    }));
    const matched = reconcile(lines, twice);
    expect(summarise(matched).unmatched).toBe(1);
  });

  it("counts the three outcomes", () => {
    const lines: BankLine[] = [
      { external_ref: "a", date: "2026-08-05", description: "PIX ENVIADO PETRA MARIA SCHAUFF MENDES", amount_cents: -135000 },
      { external_ref: "b", date: "2026-08-11", description: "PIX RECEBIDO N P PIMENTEL", amount_cents: 350000 },
      { external_ref: "c", date: "2026-08-17", description: "REGUS", amount_cents: -20325 },
    ];
    expect(summarise(reconcile(lines, expected))).toEqual({
      auto: 1,
      suggested: 1,
      unmatched: 1,
    });
  });
});

describe("dropAlreadyImported", () => {
  /**
   * Pulling the month to date twice is normal. Without this, the second import
   * doubles every line it overlaps.
   */
  it("skips lines whose bank reference was already imported", () => {
    const lines: BankLine[] = [
      { external_ref: "known", date: "2026-08-05", description: "x", amount_cents: -100 },
      { external_ref: "new", date: "2026-08-06", description: "y", amount_cents: -200 },
    ];
    const { fresh, skipped } = dropAlreadyImported(lines, new Set(["known"]));
    expect(skipped).toBe(1);
    expect(fresh).toHaveLength(1);
    expect(fresh[0].external_ref).toBe("new");
  });

  it("keeps lines with no reference — they cannot be deduplicated this way", () => {
    const lines: BankLine[] = [
      { external_ref: null, date: "2026-08-05", description: "x", amount_cents: -100 },
    ];
    expect(dropAlreadyImported(lines, new Set(["known"])).fresh).toHaveLength(1);
  });
});

describe("normalise · accents", () => {
  /**
   * Statements and the studio's own records disagree about accents all the
   * time — "Serviços" in the app, "SERVICOS" from the bank. Stripping the
   * combining marks is what lets those compare equal.
   */
  it("strips accents so an accented name matches an unaccented statement", () => {
    expect(normalise("Serviços Gráficos")).toBe("servicos graficos");
    expect(normalise("PIX ENVIADO SERVICOS GRAFICOS")).toContain(
      "servicos graficos",
    );
    expect(
      namesCounterparty("PIX ENVIADO SERVICOS GRAFICOS", "Serviços Gráficos"),
    ).toBe(true);
  });
});
