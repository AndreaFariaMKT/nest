// Pure helpers for the monthly report generator.
//
// We hand Claude an aggregate view of a client's month — drafts produced,
// posts published, tasks closed, meetings held, approvals collected — and it
// returns a structured narrative report with highlights, lessons, and
// suggested pillars for the next cycle.

export type ReportPeriod = {
  year: number;
  month: number;
  label: string; // e.g. "April 2026" or "Abril 2026"
};

export type ReportCounts = {
  draftsCreated: number;
  draftsApproved: number;
  postsPublished: number;
  tasksCompleted: number;
  tasksOpen: number;
  meetingsHeld: number;
  approvalsSent: number;
  approvalsApproved: number;
  approvalsRejected: number;
};

export type ReportDraftHighlight = {
  title: string;
  pillar: string | null;
  status: string;
};

export type ReportInput = {
  clientName: string;
  clientIndustry: string | null;
  period: ReportPeriod;
  counts: ReportCounts;
  topDrafts: ReportDraftHighlight[]; // up to 10, most recent first
  pillars: Array<{ name: string; count: number }>; // pillars used in the period
};

export type MonthlyReportPayload = {
  summary: string;
  highlights: string[];
  lessons: string[];
  nextPillars: string[];
};

const LANG_LABEL = (code: string) =>
  code.toLowerCase().startsWith("pt")
    ? "Portuguese (Brazil)"
    : code.toLowerCase().startsWith("en")
      ? "English"
      : code;

export function buildReportSystem(language: string): string {
  const lang = LANG_LABEL(language);
  return `You are a senior content strategist writing a monthly recap report for a social-media client.

Language of output: ${lang}. Write naturally in that language — the report will be sent directly to the client's CEO.

Output format: raw JSON only. No markdown code fences, no prose before or after.

Shape:
{
  "summary": "2-3 sentence executive summary of the month",
  "highlights": ["specific win 1", "specific win 2", ...],
  "lessons": ["pattern we saw worth calling out", ...],
  "nextPillars": ["pillar or theme to explore next month", ...]
}

Rules:
- Highlights must reference real numbers or drafts from the input — no vague claims.
- Lessons should be concrete and actionable, not platitudes.
- nextPillars is 3-5 items, ordered by how high-impact they'd be.
- Write with warmth and authority — Andréa's studio voice.
- Never invent metrics Meta hasn't produced yet — if the input shows 0 published posts, say so honestly.
- Never include markdown fences (\`\`\`) in your output.`;
}

export function buildReportUser(input: ReportInput, language: string): string {
  const lang = LANG_LABEL(language);
  const pillarLines =
    input.pillars.length > 0
      ? input.pillars
          .map((p) => `  - ${p.name}: ${p.count} drafts`)
          .join("\n")
      : "  (no pillars recorded)";

  const draftLines =
    input.topDrafts.length > 0
      ? input.topDrafts
          .map(
            (d) =>
              `  - "${d.title}" — pillar: ${d.pillar ?? "—"} · status: ${d.status}`,
          )
          .join("\n")
      : "  (no drafts produced)";

  return `Language: ${lang}.

<client>
${input.clientName}${input.clientIndustry ? ` — ${input.clientIndustry}` : ""}
</client>

<period>
${input.period.label} (${input.period.year}-${String(input.period.month).padStart(2, "0")})
</period>

<counts>
drafts created: ${input.counts.draftsCreated}
drafts approved: ${input.counts.draftsApproved}
posts published: ${input.counts.postsPublished}
tasks completed: ${input.counts.tasksCompleted}
tasks still open: ${input.counts.tasksOpen}
meetings held: ${input.counts.meetingsHeld}
approvals sent to client: ${input.counts.approvalsSent}
approvals approved: ${input.counts.approvalsApproved}
changes requested: ${input.counts.approvalsRejected}
</counts>

<pillars_used>
${pillarLines}
</pillars_used>

<recent_drafts>
${draftLines}
</recent_drafts>

Write the monthly recap JSON now.`;
}

// ───────────────────────────────────────────────────────────────────────────
// Response parsing
// ───────────────────────────────────────────────────────────────────────────

export class MonthlyReportParseError extends Error {}

export function parseReportPayload(raw: string): MonthlyReportPayload {
  const stripped = raw
    .replace(/^\s*```(?:json|JSON)?\s*/m, "")
    .replace(/```\s*$/m, "")
    .replace(/\r\n/g, "\n")
    .trim();
  if (!stripped) throw new MonthlyReportParseError("empty response");

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripped);
  } catch {
    throw new MonthlyReportParseError("not valid JSON");
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new MonthlyReportParseError("top level must be an object");
  }
  const root = parsed as Record<string, unknown>;

  const summary =
    typeof root.summary === "string" ? root.summary.trim() : "";
  if (summary.length < 10) {
    throw new MonthlyReportParseError("summary too short");
  }

  const readStringArray = (v: unknown, field: string): string[] => {
    if (!Array.isArray(v)) {
      throw new MonthlyReportParseError(`${field} must be an array`);
    }
    return (v as unknown[])
      .filter((x): x is string => typeof x === "string")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  };

  const highlights = readStringArray(root.highlights, "highlights");
  const lessons = readStringArray(root.lessons, "lessons");
  const nextPillars = readStringArray(root.nextPillars, "nextPillars");

  if (highlights.length === 0) {
    throw new MonthlyReportParseError("highlights must not be empty");
  }

  return { summary, highlights, lessons, nextPillars };
}

// ───────────────────────────────────────────────────────────────────────────
// Period helpers
// ───────────────────────────────────────────────────────────────────────────

export function monthBounds(year: number, month: number): {
  startISO: string;
  endISO: string;
} {
  // UTC-bounded to match Postgres `timestamptz` comparison.
  const startISO = `${year}-${String(month).padStart(2, "0")}-01T00:00:00.000Z`;
  const next = month === 12 ? { y: year + 1, m: 1 } : { y: year, m: month + 1 };
  const endISO = `${next.y}-${String(next.m).padStart(2, "0")}-01T00:00:00.000Z`;
  return { startISO, endISO };
}

export function monthLabel(
  year: number,
  month: number,
  locale: string,
): string {
  const d = new Date(year, month - 1, 1);
  return new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric",
  }).format(d);
}
