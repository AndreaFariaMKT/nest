// Pure helpers for the transcript → tasks extraction pipeline.
//
// Used by the transcript-pull cron after a transcript lands. Claude (Haiku
// for cost — see ModelKind=extract) sees the transcript + light meeting
// context and returns a JSON list of action items. We persist them as `tasks`
// rows linked to the meeting's client.
//
// All exports here are pure: prompt builders + a strict response parser.
// IO (Claude call + Supabase insert) lives in the cron route.

import type { TaskPriority } from "@/types/database";

export const VALID_PRIORITIES: TaskPriority[] = [
  "low",
  "medium",
  "high",
  "urgent",
];

export type ExtractedTask = {
  title: string;
  priority: TaskPriority | null;
  /** ISO 8601 timestamp; null when the transcript doesn't fix a date. */
  dueAt: string | null;
  /** Free-text speaker name from the transcript; null when unattributed. */
  assigneeHint: string | null;
};

export type MeetingContext = {
  meetingTitle: string;
  clientName: string | null;
  /**
   * Reference time for relative date resolution ("next Tuesday" → ISO).
   * Defaults to "now" at call site; passed in for deterministic tests.
   */
  nowIso: string;
  language: "pt-BR" | "en";
};

// ───────────────────────────────────────────────────────────────────────────
// Prompt builders
// ───────────────────────────────────────────────────────────────────────────

export function buildTaskExtractionSystem(language: "pt-BR" | "en"): string {
  const promptLanguage =
    language === "pt-BR" ? "Portuguese (Brazil)" : "English";
  return `You extract action items from meeting transcripts. Output ONLY raw JSON, no prose, no markdown fences.

Shape:
{
  "tasks": [
    {
      "title": "short imperative phrase in ${promptLanguage}, max 120 chars",
      "priority": "low" | "medium" | "high" | "urgent" | null,
      "due_at": "ISO 8601 timestamp" | null,
      "assignee_hint": "speaker name or null"
    }
  ]
}

Rules:
- Only include items that are clearly actionable commitments. Skip generic statements, opinions, or "nice to have" musings.
- "title" must be a verb phrase ("Send invoice to client X", "Review draft contract"), not a paragraph.
- "due_at" — only fill when the transcript fixes a specific date or a relative reference resolvable from the meeting time. Otherwise null.
- "priority" — fill only when explicitly framed as urgent / blocking / soon / whenever. Otherwise null.
- Return tasks: [] (empty array) when no action items are present. Never invent.
- Output strictly the JSON object above. No commentary, no fences.`;
}

export function buildTaskExtractionUser(
  transcript: string,
  ctx: MeetingContext,
): string {
  const clientLine = ctx.clientName ? `Client: ${ctx.clientName}\n` : "";
  return `${clientLine}Meeting title: ${ctx.meetingTitle}
Reference time (for relative dates): ${ctx.nowIso}

<transcript>
${transcript}
</transcript>

Return the JSON now.`;
}

// ───────────────────────────────────────────────────────────────────────────
// Response parser
// ───────────────────────────────────────────────────────────────────────────

export class TaskExtractionParseError extends Error {}

const TITLE_MAX = 120;

export function parseExtractedTasks(raw: string): ExtractedTask[] {
  const stripped = raw
    .replace(/^\s*```(?:json|JSON)?\s*/m, "")
    .replace(/```\s*$/m, "")
    .trim();
  if (!stripped) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripped);
  } catch {
    throw new TaskExtractionParseError("not valid JSON");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new TaskExtractionParseError("top level must be an object");
  }
  const root = parsed as Record<string, unknown>;
  if (!Array.isArray(root.tasks)) {
    throw new TaskExtractionParseError("missing tasks[]");
  }

  const out: ExtractedTask[] = [];
  for (const entry of root.tasks) {
    if (!entry || typeof entry !== "object") continue;
    const row = entry as Record<string, unknown>;
    const title = typeof row.title === "string" ? row.title.trim() : "";
    if (!title) continue;

    const trimmed = title.length > TITLE_MAX ? title.slice(0, TITLE_MAX) : title;

    const priorityRaw =
      typeof row.priority === "string" ? row.priority.toLowerCase() : "";
    const priority: TaskPriority | null = (
      VALID_PRIORITIES as string[]
    ).includes(priorityRaw)
      ? (priorityRaw as TaskPriority)
      : null;

    const dueAtRaw = typeof row.due_at === "string" ? row.due_at.trim() : "";
    let dueAt: string | null = null;
    if (dueAtRaw) {
      const t = Date.parse(dueAtRaw);
      if (!Number.isNaN(t)) dueAt = new Date(t).toISOString();
    }

    const assigneeHint =
      typeof row.assignee_hint === "string" && row.assignee_hint.trim()
        ? row.assignee_hint.trim()
        : null;

    out.push({ title: trimmed, priority, dueAt, assigneeHint });
  }
  return out;
}
