import { describe, expect, it } from "vitest";

import {
  DOCUMENT_CATEGORIES,
  EXPIRING_SOON_DAYS,
  addDays,
  expiryOf,
  validateDocument,
  type DocumentInput,
} from "@/lib/company-documents";

const TODAY = "2026-08-27";

const input = (over: Partial<DocumentInput> = {}): DocumentInput => ({
  title: "Contrato social",
  category: "legal",
  document_url: "",
  valid_until: "",
  notes: "",
  ...over,
});

describe("expiryOf", () => {
  it("says nothing about a document that does not expire", () => {
    expect(expiryOf(null, TODAY)).toBe("none");
  });

  it("marks yesterday expired and today still valid", () => {
    // A document is good through the day it expires on.
    expect(expiryOf("2026-08-26", TODAY)).toBe("expired");
    expect(expiryOf(TODAY, TODAY)).toBe("soon");
  });

  it("warns inside the renewal window and not outside it", () => {
    const edge = addDays(TODAY, EXPIRING_SOON_DAYS);
    expect(expiryOf(edge, TODAY)).toBe("soon");
    expect(expiryOf(addDays(TODAY, EXPIRING_SOON_DAYS + 1), TODAY)).toBe("ok");
  });

  it("compares calendar days, not instants", () => {
    // Parsing these into Date objects is what puts a document expiring today
    // into yesterday for three hours every night.
    expect(expiryOf("2026-12-31", "2026-12-31")).toBe("soon");
    expect(expiryOf("2027-01-01", "2026-12-31")).toBe("soon");
  });
});

describe("addDays", () => {
  it("crosses a month and a year", () => {
    expect(addDays("2026-08-27", 5)).toBe("2026-09-01");
    expect(addDays("2026-12-30", 3)).toBe("2027-01-02");
  });
  it("handles a leap day", () => {
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
  });
  it("returns the input unchanged when it cannot read it", () => {
    expect(addDays("not-a-day", 5)).toBe("not-a-day");
  });
});

describe("validateDocument", () => {
  it("accepts a minimal document and nulls the empty fields", () => {
    expect(validateDocument(input())).toEqual({
      ok: true,
      value: {
        title: "Contrato social",
        category: "legal",
        document_url: null,
        valid_until: null,
        notes: null,
      },
    });
  });

  it("trims everything it keeps", () => {
    const v = validateDocument(
      input({ title: "  Alvará  ", notes: "  renovar  " }),
    );
    expect(v).toMatchObject({
      ok: true,
      value: { title: "Alvará", notes: "renovar" },
    });
  });

  it("requires a title", () => {
    expect(validateDocument(input({ title: "   " }))).toEqual({
      ok: false,
      reason: "needsTitle",
    });
  });

  it("refuses a category the schema would refuse", () => {
    expect(validateDocument(input({ category: "tax" }))).toEqual({
      ok: false,
      reason: "unknownCategory",
    });
    for (const c of DOCUMENT_CATEGORIES) {
      expect(validateDocument(input({ category: c })).ok, c).toBe(true);
    }
  });

  it("accepts an http(s) link and refuses anything else", () => {
    expect(validateDocument(input({ document_url: "https://x.test/a.pdf" })).ok).toBe(
      true,
    );
    // The founder clicks this link. A javascript: href is the cheap version
    // of this going wrong, and the field is free text.
    for (const bad of ["javascript:alert(1)", "file:///etc/passwd", "not a url"]) {
      expect(validateDocument(input({ document_url: bad })), bad).toEqual({
        ok: false,
        reason: "badUrl",
      });
    }
  });

  it("refuses a date that is not a real day", () => {
    expect(validateDocument(input({ valid_until: "2026-02-31" }))).toEqual({
      ok: false,
      reason: "badDate",
    });
    expect(validateDocument(input({ valid_until: "27/08/2026" }))).toEqual({
      ok: false,
      reason: "badDate",
    });
    expect(validateDocument(input({ valid_until: "2028-02-29" })).ok).toBe(true);
  });
});
