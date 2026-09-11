import type { BankLine } from "@/lib/reconcile";

/**
 * Reading a bank statement.
 *
 * OFX and CSV, because those are what Nubank and Wise export. Both parsers are
 * deliberately forgiving about layout and strict about money: a line whose
 * amount cannot be read is dropped and counted, never guessed at. A statement
 * that silently loses a row is worse than one that refuses to load.
 */

export type ParseResult = {
  lines: BankLine[];
  /** Rows that looked like data and could not be read. */
  skipped: number;
};

/** "2026-08-05", from OFX's YYYYMMDD[HHMMSS][tz]. */
function ofxDate(raw: string): string | null {
  const m = /^(\d{4})(\d{2})(\d{2})/.exec(raw.trim());
  if (!m) return null;
  return `${m[1]}-${m[2]}-${m[3]}`;
}

/**
 * OFX amounts are plain decimals with a dot and a leading sign: -135.00.
 *
 * Rounded rather than truncated, and via a string split rather than
 * `Math.round(Number(x) * 100)` — the float multiply turns 8.07 into 806.9999…
 * and truncation would lose a cent on roughly one line in a hundred, which is
 * exactly the size of error that makes a reconciliation nearly balance.
 */
export function decimalToCents(raw: string): number | null {
  const s = raw.trim().replace(/\s/g, "").replace(",", ".");
  if (!/^-?\d+(\.\d+)?$/.test(s)) return null;
  const negative = s.startsWith("-");
  const [whole, frac = ""] = s.replace("-", "").split(".");
  const cents =
    Number(whole) * 100 + Number((frac + "00").slice(0, 2)) +
    // Third decimal place rounds the second.
    (Number(frac[2] ?? "0") >= 5 ? 1 : 0);
  if (!Number.isFinite(cents)) return null;
  return negative ? -cents : cents;
}

function tag(block: string, name: string): string | null {
  // OFX tags are frequently unclosed — <NAME>foo followed by the next tag —
  // which is why this stops at a newline or the next '<' rather than looking
  // for a closing tag that may not be there.
  const m = new RegExp(`<${name}>([^<\\r\\n]*)`, "i").exec(block);
  return m ? m[1].trim() : null;
}

export function parseOfx(text: string): ParseResult {
  const lines: BankLine[] = [];
  let skipped = 0;

  const blocks = text.split(/<STMTTRN>/i).slice(1);
  for (const block of blocks) {
    const date = ofxDate(tag(block, "DTPOSTED") ?? "");
    const amount = decimalToCents(tag(block, "TRNAMT") ?? "");
    if (!date || amount === null) {
      skipped += 1;
      continue;
    }
    lines.push({
      external_ref: tag(block, "FITID"),
      date,
      // MEMO is the human description; NAME is the counterparty. Either alone
      // loses half of what the matcher needs, so both go in.
      description: [tag(block, "NAME"), tag(block, "MEMO")]
        .filter(Boolean)
        .join(" ")
        .trim() || "—",
      amount_cents: amount,
    });
  }

  return { lines, skipped };
}

/**
 * Which character separates the fields.
 *
 * Treating "," and ";" as delimiters at the same time is the trap: a pt-BR
 * export is semicolon-separated AND uses the comma as its decimal point, so
 * `21/08/2026;-1.350,50;PIX` split on both yields ["21/08/2026", "-1.350",
 * "50", "PIX"] — the amount reads as -1.350 and fifty centavos vanish without
 * being counted as skipped. Exactly the "nearly balances" error the cents
 * parser was written to avoid.
 *
 * Decided per file from the header, where a decimal comma cannot appear.
 */
export function detectDelimiter(headerLine: string): "," | ";" {
  const semis = (headerLine.match(/;/g) ?? []).length;
  const commas = (headerLine.match(/,/g) ?? []).length;
  return semis > commas ? ";" : ",";
}

/** Split a CSV line, respecting double quotes. */
export function splitCsvLine(line: string, delimiter: "," | ";" = ","): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      // "" inside a quoted field is a literal quote.
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

/** "05/08/2026" or "2026-08-05" → "2026-08-05". */
export function csvDate(raw: string): string | null {
  const s = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = /^(\d{2})[/-](\d{2})[/-](\d{4})$/.exec(s);
  // Day first: these are Brazilian exports, and reading 05/08 as 8 May puts a
  // payment three months from where it happened.
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

/**
 * CSV, by header name rather than column position.
 *
 * Nubank and Wise disagree about column order and both change it between
 * exports. Finding the columns by their headers survives that; counting from
 * the left does not.
 */
export function parseCsv(text: string): ParseResult {
  const rows = text
    .split(/\r?\n/)
    .map((r) => r.trim())
    .filter(Boolean);
  if (rows.length < 2) return { lines: [], skipped: 0 };

  const delimiter = detectDelimiter(rows[0]);
  const header = splitCsvLine(rows[0], delimiter).map((h) => h.toLowerCase());

  /**
   * Find a column by header, preferring the most specific match.
   *
   * Two real exports break the obvious `includes`:
   *
   * - Wise ships both "Source fee amount" and "Target amount". A plain
   *   substring match takes whichever comes first in the file, which is the
   *   FEE — so every transaction is read as its own fee.
   * - `includes("id")` matches "Cidade", turning a city into the bank
   *   reference, after which every later line from that city is discarded as
   *   an already-imported duplicate.
   *
   * So: exact header first; then the name as a whole WORD (which "cidade"
   * fails and "target amount" passes); and among several word matches the
   * shortest header wins, because the extra words are what makes
   * "source fee amount" the wrong one.
   */
  const find = (...names: string[]) => {
    for (const n of names) {
      const exact = header.findIndex((h) => h === n);
      if (exact >= 0) return exact;
    }
    for (const n of names) {
      const word = new RegExp(`(^|[^a-z0-9])${n}([^a-z0-9]|$)`);
      const hits = header
        .map((h, i) => ({ h, i }))
        .filter(({ h }) => word.test(h));
      if (hits.length === 0) continue;
      hits.sort((a, b) => a.h.length - b.h.length);
      return hits[0].i;
    }
    // Last: the name as the START of a word.
    //
    // "descri" is a stem, not a word — it was written to cover "descrição",
    // "descricao" and "description" at once, and the whole-word rule above
    // (added to stop "id" matching "Cidade") quietly killed it: after
    // "descri" comes "c", so the boundary never matched and EVERY Brazilian
    // CSV lost its description. The reconcile screen showed "—" on every line
    // and `namesCounterparty` had nothing to compare, so a statement could
    // essentially never auto-match.
    //
    // Anchoring at a word START keeps the bug this was all built around out:
    // in "cidade" the "id" is preceded by "c", so it still does not match.
    for (const n of names) {
      const prefix = new RegExp(`(^|[^a-z0-9])${n}`);
      const hits = header
        .map((h, i) => ({ h, i }))
        .filter(({ h }) => prefix.test(h));
      if (hits.length === 0) continue;
      hits.sort((a, b) => a.h.length - b.h.length);
      return hits[0].i;
    }
    return -1;
  };

  const iDate = find("data", "date");
  const iDesc = find("descri", "description", "memo", "histor");
  const iAmount = find("valor", "amount", "value");
  // "identificador" first: a bare "id" is the substring that matched "Cidade".
  const iRef = find("identificador", "reference", "id");

  if (iDate < 0 || iAmount < 0) return { lines: [], skipped: rows.length - 1 };

  const lines: BankLine[] = [];
  let skipped = 0;

  for (const row of rows.slice(1)) {
    const cells = splitCsvLine(row, delimiter);
    const date = csvDate(cells[iDate] ?? "");
    const amount = decimalToCents(
      (cells[iAmount] ?? "").replace(/[R$\s]/g, "").replace(/\.(?=\d{3}\b)/g, ""),
    );
    if (!date || amount === null) {
      skipped += 1;
      continue;
    }
    lines.push({
      external_ref: iRef >= 0 ? cells[iRef] || null : null,
      date,
      description: (iDesc >= 0 ? cells[iDesc] : "") || "—",
      amount_cents: amount,
    });
  }

  return { lines, skipped };
}

/**
 * Give every line an identifier, inventing one only where the bank gave none.
 *
 * An OFX carries a FITID and a good CSV carries an "identificador" column.
 * Plenty of CSVs carry neither — and a line with `external_ref: null` slipped
 * through `dropAlreadyImported`, past the partial unique index on
 * `fin_import_lines`, and staged a second time. Pulling the month to date
 * twice, which is the normal way to use this screen, doubled every line in the
 * overlap; confirming them doubled the month.
 *
 * The synthetic key is the movement itself — date, amount, description — plus
 * how many identical ones came before it in the file. The ordinal is what
 * keeps this from being too clever: two genuinely separate R$ 50 PIX payments
 * to the same person on the same day are #0 and #1, and both survive, while a
 * re-export of the same file produces the same two keys and neither is staged
 * again.
 *
 * Prefixed so it can never be mistaken for something a bank issued.
 */
function fillMissingRefs(lines: BankLine[]): BankLine[] {
  const seen = new Map<string, number>();
  return lines.map((line) => {
    if (line.external_ref) return line;
    const body = [
      line.date,
      line.amount_cents,
      line.description.trim().toLowerCase().replace(/\s+/g, " "),
    ].join("|");
    const n = seen.get(body) ?? 0;
    seen.set(body, n + 1);
    return { ...line, external_ref: `derived:${body}#${n}` };
  });
}

export function parseStatement(filename: string, text: string): ParseResult {
  const parsed = filename.toLowerCase().endsWith(".csv")
    ? parseCsv(text)
    : parseOfx(text);
  return { ...parsed, lines: fillMissingRefs(parsed.lines) };
}
