// BRL-first money helpers. Values live in the DB as `bigint` cents.

export function parseBrlToCents(input: string): number | null {
  let s = input.replace(/R\$/gi, "").replace(/\s+/g, "");
  if (s === "") return null;

  const hasComma = s.includes(",");
  const hasDot = s.includes(".");

  if (hasComma && hasDot) {
    // "4.500,50" → PT-BR: dots are thousand separators, comma is decimal.
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (hasComma) {
    // "4500,50" → comma is decimal.
    s = s.replace(",", ".");
  } else if (hasDot) {
    // A lone dot is ambiguous, and this used to read it as a decimal point
    // always. In Brazil it is the thousands separator — so a R$ 12.000
    // retainer typed exactly as the founder writes it was stored as R$ 12,00,
    // and every MRR figure on /finance, /today and the client page was wrong
    // by a factor of a thousand, silently, in the direction that looks
    // plausible.
    //
    // Groups of exactly three digits after every dot is what a thousands
    // separator looks like and what a decimal never does: "12.000",
    // "1.234.567". Anything else — "4500.50", "0.5" — stays a decimal point,
    // so a keyboard habit from another locale still works.
    const thousands = /^\d{1,3}(\.\d{3})+$/.test(s);
    if (thousands) s = s.replace(/\./g, "");
  }

  const n = Number(s);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

export function formatCentsAsBrl(
  cents: number | bigint | null | undefined,
): string {
  if (cents === null || cents === undefined) return "—";
  const numeric = typeof cents === "bigint" ? Number(cents) : cents;
  if (!Number.isFinite(numeric)) return "—";
  return (numeric / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function sumCents(
  values: readonly (number | bigint | null | undefined)[],
): number {
  let total = 0;
  for (const v of values) {
    if (v === null || v === undefined) continue;
    total += typeof v === "bigint" ? Number(v) : v;
  }
  return total;
}
