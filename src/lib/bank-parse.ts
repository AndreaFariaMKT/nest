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

/** Split a CSV line, respecting double quotes. */
export function splitCsvLine(line: string): string[] {
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
    } else if ((ch === "," || ch === ";") && !inQuotes) {
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

  const header = splitCsvLine(rows[0]).map((h) => h.toLowerCase());
  const find = (...names: string[]) =>
    header.findIndex((h) => names.some((n) => h.includes(n)));

  const iDate = find("data", "date");
  const iDesc = find("descri", "description", "memo", "histor");
  const iAmount = find("valor", "amount", "value");
  const iRef = find("id", "identificador", "reference");

  if (iDate < 0 || iAmount < 0) return { lines: [], skipped: rows.length - 1 };

  const lines: BankLine[] = [];
  let skipped = 0;

  for (const row of rows.slice(1)) {
    const cells = splitCsvLine(row);
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

export function parseStatement(filename: string, text: string): ParseResult {
  return filename.toLowerCase().endsWith(".csv")
    ? parseCsv(text)
    : parseOfx(text);
}
