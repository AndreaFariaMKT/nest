import { describe, it, expect } from "vitest";

import {
  buildDigest,
  digestBody,
  type DigestPiece,
} from "@/lib/social-digest";

const piece = (over: Partial<DigestPiece> = {}): DigestPiece => ({
  id: "p1",
  title: "A piece",
  publish_on: "2026-09-11",
  sent_to_client_at: "2026-09-01T10:00:00.000Z",
  ...over,
});

const TODAY = "2026-09-04"; // the reply date for a piece publishing 2026-09-11

describe("what belongs in a digest", () => {
  it("counts a piece that reached the client since the last digest", () => {
    const d = buildDigest(
      [piece({ sent_to_client_at: "2026-09-03T09:00:00.000Z" })],
      TODAY,
      "2026-09-02T11:00:00.000Z",
    );
    expect(d.arrived).toHaveLength(1);
    expect(d.empty).toBe(false);
  });

  it("does not repeat a piece the client was already told about", () => {
    const d = buildDigest(
      [piece({ sent_to_client_at: "2026-09-01T09:00:00.000Z" })],
      "2026-10-01",
      "2026-09-02T11:00:00.000Z",
    );
    expect(d.arrived).toHaveLength(0);
  });

  it("picks up a day a missed run would otherwise have swallowed", () => {
    // The stamp is only written on success, so two days of arrivals are still
    // caught by the next run rather than being lost with the failed one.
    const d = buildDigest(
      [
        piece({ id: "a", sent_to_client_at: "2026-09-02T09:00:00.000Z" }),
        piece({ id: "b", sent_to_client_at: "2026-09-03T09:00:00.000Z" }),
      ],
      TODAY,
      "2026-09-01T11:00:00.000Z",
    );
    expect(d.arrived.map((p) => p.id)).toEqual(["a", "b"]);
  });

  it("treats everything as new on a client's first digest", () => {
    const d = buildDigest([piece(), piece({ id: "p2" })], TODAY, null);
    expect(d.arrived).toHaveLength(2);
  });

  it("flags the last day a reply still changes anything", () => {
    const d = buildDigest([piece()], TODAY, "2026-09-04T00:00:00.000Z");
    expect(d.dueToday).toHaveLength(1);
    expect(d.overdue).toHaveLength(0);
  });

  it("flags a piece that will now run as scheduled", () => {
    const d = buildDigest([piece()], "2026-09-07", "2026-09-06T00:00:00.000Z");
    expect(d.overdue).toHaveLength(1);
    expect(d.dueToday).toHaveLength(0);
  });

  it("ignores a piece that never reached the client", () => {
    const d = buildDigest([piece({ sent_to_client_at: null })], TODAY, null);
    expect(d.empty).toBe(true);
  });

  it("ignores a piece with no publish date for the deadline buckets", () => {
    const d = buildDigest([piece({ publish_on: null })], TODAY, null);
    expect(d.dueToday).toHaveLength(0);
    expect(d.overdue).toHaveLength(0);
    // It still counts as an arrival — the client should read it.
    expect(d.arrived).toHaveLength(1);
  });

  it("is empty when there is nothing to say", () => {
    expect(buildDigest([], TODAY, null).empty).toBe(true);
    // A digest that says "nothing happened" is how a digest becomes noise.
  });
});

describe("the digest sentence", () => {
  it("switches to the plural key past one", () => {
    const d = buildDigest(
      [
        piece({ id: "a", sent_to_client_at: "2026-09-03T09:00:00.000Z" }),
        piece({ id: "b", sent_to_client_at: "2026-09-03T10:00:00.000Z" }),
      ],
      TODAY,
      "2026-09-02T00:00:00.000Z",
    );
    expect(digestBody(d, (k, v) => (v ? `${k}:${v.n}` : k))).toContain(
      "arrivedOther:2",
    );
  });

  const t = (key: string, values?: Record<string, number>) =>
    values ? `${key}:${values.n}` : key;

  it("names only the buckets that have something in them", () => {
    const d = buildDigest(
      [piece({ sent_to_client_at: "2026-09-03T09:00:00.000Z" })],
      TODAY,
      "2026-09-02T00:00:00.000Z",
    );
    // Singular keys, because n === 1 — the common case, and the one the old
    // strings got wrong ("1 vencem hoje").
    expect(digestBody(d, t)).toBe("arrivedOne:1 · dueTodayOne:1");
  });

  it("says all three when all three apply", () => {
    const d = buildDigest(
      [
        piece({ id: "a", sent_to_client_at: "2026-09-06T09:00:00.000Z" }),
        piece({ id: "b", publish_on: "2026-09-14" }),
      ],
      "2026-09-07",
      "2026-09-05T00:00:00.000Z",
    );
    const body = digestBody(d, t);
    expect(body).toContain("arrivedOne:1");
    expect(body).toContain("dueTodayOne:1");
    expect(body).toContain("overdueOne:1");
  });

  it("is empty text for an empty digest", () => {
    expect(digestBody(buildDigest([], TODAY, null), t)).toBe("");
  });
});
