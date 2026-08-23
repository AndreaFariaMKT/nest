import { describe, it, expect } from "vitest";

import { pseudonymiseSpeakers } from "@/lib/sanitize";

/**
 * Meeting transcripts leave this platform — to Anthropic to write carousels,
 * to Voyage to embed. They carry the verbatim speech of people who never
 * signed up for anything. These tests pin what is stripped and, just as
 * importantly, what is honestly NOT.
 */

describe("stripping speaker names before a transcript leaves", () => {
  it("replaces every name with a label", () => {
    const out = pseudonymiseSpeakers(
      "Andréa Faria: vamos publicar terça.\nJoão Pedro: fechado.",
    );
    expect(out).toBe("Speaker A: vamos publicar terça.\nSpeaker B: fechado.");
  });

  it("keeps one speaker as one label, so the conversation still reads", () => {
    const out = pseudonymiseSpeakers(
      ["Ana: primeiro isso.", "Bruno: certo.", "Ana: depois aquilo."].join("\n"),
    );
    expect(out.split("\n").map((l) => l.split(":")[0])).toEqual([
      "Speaker A",
      "Speaker B",
      "Speaker A",
    ]);
  });

  it("does not carry a label between transcripts", () => {
    // A pseudonym that followed someone across meetings would be an
    // identifier again. Each call starts over from A.
    const first = pseudonymiseSpeakers("Ana: oi.");
    const second = pseudonymiseSpeakers("Bruno: oi.");
    expect(first).toBe(second);
  });

  it("leaves a sentence that merely contains a colon alone", () => {
    const line = "Speaker A: o plano é este: publicar na terça.";
    expect(pseudonymiseSpeakers(line)).toBe(line);
  });

  it("does not touch a line with no speaker at all", () => {
    expect(pseudonymiseSpeakers("uma linha solta")).toBe("uma linha solta");
  });

  it("handles the Unknown speaker google-meet writes", () => {
    expect(pseudonymiseSpeakers("Unknown: algo")).toBe("Speaker A: algo");
  });

  it("goes past Z rather than colliding", () => {
    const lines = Array.from({ length: 27 }, (_, i) => `P${i}: fala ${i}`);
    const out = pseudonymiseSpeakers(lines.join("\n")).split("\n");
    expect(out[25]).toBe("Speaker Z: fala 25");
    expect(out[26]).toBe("Speaker AA: fala 26");
  });

  it("does NOT remove a name spoken inside a sentence", () => {
    // Stated as a test because it is the limit of the technique, not an
    // oversight: only the speaker position has a shape to match on.
    const out = pseudonymiseSpeakers("Ana: combinei isso com o Bruno ontem.");
    expect(out).toContain("Bruno");
  });
});
