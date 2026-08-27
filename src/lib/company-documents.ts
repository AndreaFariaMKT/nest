/**
 * The studio's own paperwork: what counts as valid input, and what is about to
 * expire.
 *
 * Expiry is the reason this screen is worth having. Half of these documents
 * have a date on them — an alvará, an insurance policy, a certidão — and a
 * document nobody noticed expiring is exactly the failure the screen exists to
 * prevent. So "expiring" is a state the domain names, not a colour the
 * component picks.
 */

export const DOCUMENT_CATEGORIES = [
  "legal",
  "finance",
  "insurance",
  "plan",
  "other",
] as const;
export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number];

export function isDocumentCategory(v: string): v is DocumentCategory {
  return (DOCUMENT_CATEGORIES as readonly string[]).includes(v);
}

/** Far enough ahead to renew something without rushing. */
export const EXPIRING_SOON_DAYS = 30;

export type Expiry = "none" | "expired" | "soon" | "ok";

/**
 * Both dates are plain `YYYY-MM-DD` in the studio's calendar. Compared as
 * strings on purpose: parsing them into Date objects is what puts a document
 * that expires today into yesterday for three hours every night.
 */
export function expiryOf(validUntil: string | null, today: string): Expiry {
  if (!validUntil) return "none";
  if (validUntil < today) return "expired";

  const limit = addDays(today, EXPIRING_SOON_DAYS);
  return validUntil <= limit ? "soon" : "ok";
}

/** `YYYY-MM-DD` plus n days, staying in the same calendar. */
export function addDays(day: string, n: number): string {
  const at = new Date(`${day}T00:00:00Z`);
  if (Number.isNaN(at.getTime())) return day;
  at.setUTCDate(at.getUTCDate() + n);
  return at.toISOString().slice(0, 10);
}

/** Expired first, then expiring, then everything else — the order to act in. */
export const EXPIRY_ORDER: Record<Expiry, number> = {
  expired: 0,
  soon: 1,
  ok: 2,
  none: 3,
};

export const DOCUMENT_REFUSALS = [
  "needsTitle",
  "unknownCategory",
  "badUrl",
  "badDate",
] as const;
export type DocumentRefusal = (typeof DOCUMENT_REFUSALS)[number];

export type DocumentInput = {
  title: string;
  category: string;
  document_url: string;
  valid_until: string;
  notes: string;
};

export type DocumentVerdict =
  | {
      ok: true;
      value: {
        title: string;
        category: DocumentCategory;
        document_url: string | null;
        valid_until: string | null;
        notes: string | null;
      };
    }
  | { ok: false; reason: DocumentRefusal };

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export function validateDocument(input: DocumentInput): DocumentVerdict {
  const title = input.title.trim();
  if (!title) return { ok: false, reason: "needsTitle" };
  if (!isDocumentCategory(input.category)) {
    return { ok: false, reason: "unknownCategory" };
  }

  const url = input.document_url.trim();
  if (url) {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return { ok: false, reason: "badUrl" };
    }
    // http(s) only. A `javascript:` href on a link the founder clicks is the
    // cheap version of this going wrong, and the field is free text.
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return { ok: false, reason: "badUrl" };
    }
  }

  const day = input.valid_until.trim();
  if (day) {
    if (!DAY.test(day)) return { ok: false, reason: "badDate" };
    const at = new Date(`${day}T00:00:00Z`);
    // Catches 2026-02-31, which matches the pattern and is not a day.
    if (Number.isNaN(at.getTime()) || at.toISOString().slice(0, 10) !== day) {
      return { ok: false, reason: "badDate" };
    }
  }

  const notes = input.notes.trim();
  return {
    ok: true,
    value: {
      title,
      category: input.category,
      document_url: url || null,
      valid_until: day || null,
      notes: notes || null,
    },
  };
}
