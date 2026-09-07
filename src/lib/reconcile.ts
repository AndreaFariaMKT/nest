/**
 * Matching a bank statement against what the studio expected.
 *
 * The prototype names three outcomes and they are the right three:
 *
 *   auto        — amount, date and counterparty all line up. Safe to propose
 *                 as already reconciled.
 *   suggested   — close enough to be almost certainly the same movement, but
 *                 something differs. Needs a person to agree.
 *   unmatched   — nothing corresponds. Someone has to classify it.
 *
 * Nothing here writes. The whole module is a function from (statement lines,
 * expected rows) to a proposal, which is what makes it testable — and what
 * makes the rule "nada é lançado sem a sua confirmação" enforceable rather
 * than aspirational.
 */

export type BankLine = {
  /** The bank's own identifier for the movement, when the format carries one. */
  external_ref: string | null;
  date: string;
  description: string;
  amount_cents: number;
};

export type Expected = {
  id: string;
  kind: "receivable" | "payable" | "entry";
  /** Signed the same way a bank line is: negative leaves the account. */
  amount_cents: number;
  date: string;
  /** Supplier or client name, as the studio records it. */
  counterparty: string | null;
  description: string;
};

export type MatchKind = "auto" | "suggested" | "unmatched";

export type Match = {
  line: BankLine;
  expected: Expected | null;
  kind: MatchKind;
  /** Why it is not `auto`, for the screen to explain itself. */
  reasons: string[];
};

/** Days either side of the expected date that still count as the same movement. */
const DATE_TOLERANCE_DAYS = 3;

function daysApart(a: string, b: string): number {
  const ms = Math.abs(Date.parse(`${a}T12:00:00Z`) - Date.parse(`${b}T12:00:00Z`));
  return Math.round(ms / 86_400_000);
}

/**
 * Normalise a bank description enough to compare it to a name.
 *
 * Statements shout ("PIX ENVIADO PETRA MARIA SCHAUFF MENDES"), carry the
 * transaction type as a prefix, and drop accents. Comparing raw strings finds
 * nothing; comparing these finds the person.
 */
export function normalise(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Does the statement line name this counterparty?
 *
 * Word containment rather than string similarity: bank descriptions carry a
 * prefix and often the full legal name where the studio recorded a short one
 * ("Petra" against "PETRA MARIA SCHAUFF MENDES"). Requiring two matching words
 * — or one long distinctive one — is what separates that from a coincidence.
 */
export function namesCounterparty(
  description: string,
  counterparty: string | null,
): boolean {
  if (!counterparty) return false;
  const haystack = normalise(description);
  const words = normalise(counterparty)
    .split(" ")
    .filter((w) => w.length >= 3);
  if (words.length === 0) return false;

  const hits = words.filter((w) => haystack.includes(w));
  if (hits.length >= 2) return true;
  // A single word only counts when it is long enough to be a name rather than
  // "de", "ltda" or "servicos".
  return hits.length === 1 && hits[0].length >= 6;
}

/**
 * Propose a match for each statement line.
 *
 * An expected row is consumed once: two identical R$ 1.550 payments in a month
 * must match two different rows, not the same one twice. That is the bug that
 * makes a reconciliation silently under-count a month.
 */
export function reconcile(
  lines: readonly BankLine[],
  expected: readonly Expected[],
): Match[] {
  const available = new Map(expected.map((e) => [e.id, e]));

  return lines.map((line) => {
    const candidates = [...available.values()].filter(
      (e) => e.amount_cents === line.amount_cents,
    );

    if (candidates.length === 0) {
      return { line, expected: null, kind: "unmatched" as const, reasons: ["noAmount"] };
    }

    // Prefer the closest date, then a named counterparty.
    const scored = candidates
      .map((e) => ({
        expected: e,
        days: daysApart(e.date, line.date),
        named: namesCounterparty(line.description, e.counterparty),
      }))
      .sort((a, b) => (a.days - b.days) || Number(b.named) - Number(a.named));

    const best = scored[0];
    if (best.days > DATE_TOLERANCE_DAYS) {
      return {
        line,
        expected: null,
        kind: "unmatched" as const,
        reasons: ["dateTooFar"],
      };
    }

    available.delete(best.expected.id);

    const reasons: string[] = [];
    if (best.days !== 0) reasons.push("dateDiffers");
    if (!best.named) reasons.push("nameDiffers");

    return {
      line,
      expected: best.expected,
      // Everything lining up is the only route to `auto`. Anything else is a
      // proposal a person confirms — the difference between a tool that files
      // the month and one that quietly mis-files it.
      kind: reasons.length === 0 ? ("auto" as const) : ("suggested" as const),
      reasons,
    };
  });
}

export function summarise(matches: readonly Match[]): Record<MatchKind, number> {
  return {
    auto: matches.filter((m) => m.kind === "auto").length,
    suggested: matches.filter((m) => m.kind === "suggested").length,
    unmatched: matches.filter((m) => m.kind === "unmatched").length,
  };
}

/**
 * Lines already imported before, by the bank's own reference.
 *
 * Re-importing an overlapping statement is normal — the studio pulls the month
 * to date more than once — and without this every re-import doubles the month.
 */
export function dropAlreadyImported(
  lines: readonly BankLine[],
  knownRefs: ReadonlySet<string>,
): { fresh: BankLine[]; skipped: number } {
  const fresh = lines.filter(
    (l) => !l.external_ref || !knownRefs.has(l.external_ref),
  );
  return { fresh, skipped: lines.length - fresh.length };
}
