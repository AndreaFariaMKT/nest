import { describe, expect, it } from "vitest";

import {
  csvDate,
  detectDelimiter,
  decimalToCents,
  parseCsv,
  parseOfx,
  parseStatement,
  splitCsvLine,
} from "@/lib/bank-parse";

describe("decimalToCents", () => {
  it("reads a plain OFX amount", () => {
    expect(decimalToCents("-135.00")).toBe(-13500);
    expect(decimalToCents("3500.00")).toBe(350000);
    expect(decimalToCents("22070.70")).toBe(2207070);
  });

  /**
   * `Math.round(Number("8.07") * 100)` is 807 by luck; truncating the float is
   * 806. A cent lost on one line in a hundred is exactly the size of error
   * that makes a reconciliation *nearly* balance, which is the worst outcome —
   * it looks like a rounding quirk rather than a missing transaction.
   */
  it("does not lose a cent to float multiplication", () => {
    expect(decimalToCents("8.07")).toBe(807);
    expect(decimalToCents("1.005")).toBe(101);
    expect(decimalToCents("0.1")).toBe(10);
    expect(decimalToCents("815.99")).toBe(81599);
  });

  it("refuses anything that is not a number rather than guessing", () => {
    expect(decimalToCents("")).toBeNull();
    expect(decimalToCents("abc")).toBeNull();
    expect(decimalToCents("1.2.3")).toBeNull();
  });
});

describe("csvDate", () => {
  /**
   * These are Brazilian exports. Reading 05/08 as 8 May puts a payment three
   * months from where it happened.
   */
  it("reads a Brazilian date as day first", () => {
    expect(csvDate("05/08/2026")).toBe("2026-08-05");
    expect(csvDate("31/12/2026")).toBe("2026-12-31");
  });

  it("passes an ISO date through", () => {
    expect(csvDate("2026-08-05")).toBe("2026-08-05");
  });

  it("returns null for something it cannot read", () => {
    expect(csvDate("agosto")).toBeNull();
  });
});

describe("splitCsvLine", () => {
  it("respects quotes around a field containing the separator", () => {
    expect(splitCsvLine('05/08/2026,"PIX ENVIADO, PETRA",-135.00')).toEqual([
      "05/08/2026",
      "PIX ENVIADO, PETRA",
      "-135.00",
    ]);
  });

  it("handles a doubled quote as a literal one", () => {
    expect(splitCsvLine('a,"say ""hi""",b')).toEqual(["a", 'say "hi"', "b"]);
  });

  it("splits on the delimiter it is told to, not on both", () => {
    expect(splitCsvLine("a;b;c", ";")).toEqual(["a", "b", "c"]);
    // The same line under a comma delimiter is one field, which is what a
    // pt-BR decimal needs.
    expect(splitCsvLine("-1.350,50", ",")).toEqual(["-1.350", "50"]);
    expect(splitCsvLine("-1.350,50", ";")).toEqual(["-1.350,50"]);
  });
});

describe("parseOfx", () => {
  const ofx = `
OFXHEADER:100
<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKTRANLIST>
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20260805120000[-3:BRT]<TRNAMT>-1350.00<FITID>2284017742<NAME>PETRA MARIA SCHAUFF<MEMO>PIX ENVIADO</STMTTRN>
<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20260810<TRNAMT>3500.00<FITID>2294313583<NAME>N P PIMENTEL<MEMO>PIX RECEBIDO</STMTTRN>
</BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`;

  it("reads unclosed OFX tags, which is how banks actually write them", () => {
    const { lines, skipped } = parseOfx(ofx);
    expect(skipped).toBe(0);
    expect(lines).toHaveLength(2);
    expect(lines[0]).toEqual({
      external_ref: "2284017742",
      date: "2026-08-05",
      description: "PETRA MARIA SCHAUFF PIX ENVIADO",
      amount_cents: -135000,
    });
  });

  it("keeps both NAME and MEMO — the matcher needs the counterparty and the verb", () => {
    expect(parseOfx(ofx).lines[1].description).toBe("N P PIMENTEL PIX RECEBIDO");
  });

  /**
   * A statement that silently loses a row is worse than one that refuses to
   * load, so an unreadable line is counted rather than dropped in silence.
   */
  it("counts a transaction it could not read instead of inventing one", () => {
    const broken = `<STMTTRN><DTPOSTED>20260805<TRNAMT>nope<FITID>1</STMTTRN>`;
    const { lines, skipped } = parseOfx(broken);
    expect(lines).toHaveLength(0);
    expect(skipped).toBe(1);
  });
});

describe("parseCsv", () => {
  /**
   * Nubank and Wise disagree about column order and both change it between
   * exports. Finding columns by header survives that; counting from the left
   * does not.
   */
  it("finds columns by header name, whatever their order", () => {
    const csv = [
      "Identificador,Valor,Data,Descrição",
      "abc123,-1350.00,05/08/2026,PIX ENVIADO PETRA",
    ].join("\n");
    const { lines } = parseCsv(csv);
    expect(lines[0]).toEqual({
      external_ref: "abc123",
      date: "2026-08-05",
      description: "PIX ENVIADO PETRA",
      amount_cents: -135000,
    });
  });

  it("strips a thousands separator without eating the decimal", () => {
    const csv = ["Data,Valor,Descrição", "21/08/2026,\"22.070,70\",SOS"].join("\n");
    expect(parseCsv(csv).lines[0].amount_cents).toBe(2207070);
  });

  it("returns nothing rather than garbage when the headers are unrecognisable", () => {
    const { lines, skipped } = parseCsv("foo,bar\n1,2");
    expect(lines).toHaveLength(0);
    expect(skipped).toBe(1);
  });

  it("handles an empty file", () => {
    expect(parseCsv("")).toEqual({ lines: [], skipped: 0 });
  });
});

describe("parseStatement", () => {
  it("picks the parser from the file name", () => {
    const csv = "Data,Valor\n05/08/2026,-135.00";
    expect(parseStatement("extrato.csv", csv).lines).toHaveLength(1);
    expect(parseStatement("extrato.ofx", csv).lines).toHaveLength(0);
  });
});

describe("real-world CSV shapes", () => {
  /**
   * A pt-BR export is semicolon-separated AND uses the comma as its decimal
   * point. Treating both as delimiters at once read `-1.350,50` as `-1.350`
   * and lost fifty centavos — not counted as skipped, and then the line no
   * longer matched the payable it was meant to settle.
   */
  it("keeps the centavos in a semicolon-separated Brazilian export", () => {
    const csv = [
      "Data;Valor;Descrição",
      "21/08/2026;-1.350,50;PIX ENVIADO PETRA",
    ].join("\n");
    const { lines, skipped } = parseCsv(csv);
    expect(skipped).toBe(0);
    expect(lines[0].amount_cents).toBe(-135050);
  });

  it("picks the header it was named, not the first one containing it", () => {
    expect(detectDelimiter("Data;Valor")).toBe(";");
    expect(detectDelimiter("Date,Amount")).toBe(",");
  });

  /**
   * Wise ships both "Source fee amount" and "Target amount". Substring-first
   * matching picked the FEE column, so every transaction was read as its own
   * fee.
   */
  it("does not read a Wise fee column as the transaction amount", () => {
    const csv = [
      "Date,Source fee amount,Target amount,Description",
      "2026-08-21,12.50,4110.00,THE SOS AGENCY",
    ].join("\n");
    expect(parseCsv(csv).lines[0].amount_cents).toBe(411000);
  });

  /**
   * `includes("id")` matched "Cidade", turning a city into the bank reference —
   * after which every later line from the same city was silently dropped as an
   * already-imported duplicate.
   */
  it("does not mistake a Cidade column for the bank reference", () => {
    const csv = [
      "Data,Cidade,Valor,Descrição",
      "05/08/2026,Belo Horizonte,-1350.00,PIX",
    ].join("\n");
    expect(parseCsv(csv).lines[0].external_ref).toBeNull();
  });
});
