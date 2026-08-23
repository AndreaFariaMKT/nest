import { describe, expect, it } from "vitest";
import {
  buildTaskExtractionSystem,
  buildTaskExtractionUser,
  parseExtractedTasks,
  TaskExtractionParseError,
} from "@/lib/transcript-tasks";

describe("buildTaskExtractionSystem", () => {
  it("includes the language hint and the four valid priorities", () => {
    const sys = buildTaskExtractionSystem("pt-BR");
    expect(sys).toContain("Portuguese (Brazil)");
    for (const p of ["low", "medium", "high", "urgent"]) {
      expect(sys).toContain(p);
    }
  });

  it("produces an English variant for the en locale", () => {
    expect(buildTaskExtractionSystem("en")).toContain("English");
  });

  it("explicitly forbids markdown fences", () => {
    expect(buildTaskExtractionSystem("pt-BR")).toMatch(/no markdown fences/i);
  });
});

describe("buildTaskExtractionUser", () => {
  it("wraps the transcript in a single <transcript> block + meeting context", () => {
    const user = buildTaskExtractionUser("Speaker: hello", {
      meetingTitle: "Strategy review",
      clientName: "Studio X",
      nowIso: "2026-05-10T14:00:00.000Z",
      language: "pt-BR",
    });
    expect(user).toContain("Client: Studio X");
    expect(user).toContain("Meeting title: Strategy review");
    expect(user).toContain("Reference time (for relative dates): 2026-05-10T14:00:00.000Z");
    // The name is stripped on the way out — see pseudonymise.test.ts. The
    // transcript reaches Anthropic with labels, not with who was in the room.
    expect(user).toContain("<transcript>\nSpeaker A: hello\n</transcript>");
  });

  it("omits the Client line when clientName is null", () => {
    const user = buildTaskExtractionUser("speaker", {
      meetingTitle: "Sync",
      clientName: null,
      nowIso: "2026-05-10T14:00:00.000Z",
      language: "pt-BR",
    });
    expect(user).not.toContain("Client:");
  });
});

describe("parseExtractedTasks", () => {
  it("returns empty for empty input (no error)", () => {
    expect(parseExtractedTasks("")).toEqual([]);
    expect(parseExtractedTasks("   \n  ")).toEqual([]);
  });

  it("strips ```json fences before parsing", () => {
    const raw = "```json\n{\"tasks\":[{\"title\":\"Send invoice\"}]}\n```";
    const out = parseExtractedTasks(raw);
    expect(out).toHaveLength(1);
    expect(out[0].title).toBe("Send invoice");
  });

  it("normalizes priority to a valid TaskPriority or null", () => {
    const out = parseExtractedTasks(
      JSON.stringify({
        tasks: [
          { title: "A", priority: "URGENT" },
          { title: "B", priority: "weird" },
          { title: "C" },
        ],
      }),
    );
    expect(out.map((t) => t.priority)).toEqual(["urgent", null, null]);
  });

  it("normalizes due_at to ISO when parseable, null otherwise", () => {
    const out = parseExtractedTasks(
      JSON.stringify({
        tasks: [
          { title: "A", due_at: "2026-05-15T18:00:00Z" },
          { title: "B", due_at: "tomorrow" },
          { title: "C", due_at: "" },
        ],
      }),
    );
    expect(out[0].dueAt).toBe("2026-05-15T18:00:00.000Z");
    expect(out[1].dueAt).toBeNull();
    expect(out[2].dueAt).toBeNull();
  });

  it("clamps title to 120 chars", () => {
    const longTitle = "x".repeat(200);
    const out = parseExtractedTasks(
      JSON.stringify({ tasks: [{ title: longTitle }] }),
    );
    expect(out[0].title.length).toBe(120);
  });

  it("drops tasks without a title", () => {
    const out = parseExtractedTasks(
      JSON.stringify({
        tasks: [
          { title: "" },
          { title: "   " },
          { title: "real one" },
          { priority: "high" },
        ],
      }),
    );
    expect(out).toHaveLength(1);
    expect(out[0].title).toBe("real one");
  });

  it("captures assignee_hint when present and non-empty", () => {
    const out = parseExtractedTasks(
      JSON.stringify({
        tasks: [
          { title: "A", assignee_hint: "Andrea" },
          { title: "B", assignee_hint: "" },
          { title: "C" },
        ],
      }),
    );
    expect(out[0].assigneeHint).toBe("Andrea");
    expect(out[1].assigneeHint).toBeNull();
    expect(out[2].assigneeHint).toBeNull();
  });

  it("throws on non-JSON input", () => {
    expect(() => parseExtractedTasks("not json")).toThrow(TaskExtractionParseError);
  });

  it("throws when top-level is an array or scalar", () => {
    expect(() => parseExtractedTasks("[]")).toThrow(TaskExtractionParseError);
    expect(() => parseExtractedTasks("42")).toThrow(TaskExtractionParseError);
  });

  it("throws when tasks key is missing or non-array", () => {
    expect(() => parseExtractedTasks("{}")).toThrow(TaskExtractionParseError);
    expect(() =>
      parseExtractedTasks(JSON.stringify({ tasks: "not array" })),
    ).toThrow(TaskExtractionParseError);
  });
});
