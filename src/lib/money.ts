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
  }
  // Only a dot (or no separator) → treated as decimal / plain integer.

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
