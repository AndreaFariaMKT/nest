import { NextResponse, type NextRequest } from "next/server";
import { createClient as createAdminSupabase } from "@supabase/supabase-js";
import {
  GoogleApiError,
  readCredentials as readGoogleCreds,
  type GoogleOAuthCreds,
} from "@/lib/google";
import { getFreshAccessToken } from "@/lib/google-calendar";
import {
  entriesToPlainText,
  extractMeetingCode,
  listConferenceRecordsByCode,
  listTranscriptEntries,
  listTranscripts,
} from "@/lib/google-meet";
import { generate } from "@/lib/claude";
import {
  buildTaskExtractionSystem,
  buildTaskExtractionUser,
  parseExtractedTasks,
  TaskExtractionParseError,
} from "@/lib/transcript-tasks";
import { log } from "@/lib/log";
import { checkRateLimit, ipFromHeaders } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * Cron endpoint — pulls Meet transcripts for finished meetings, persists them,
 * and extracts action items as `tasks` rows.
 *
 * Per run (LIMIT BATCH_SIZE meetings):
 *   1. Find meetings with `ends_at` in the [-7d, -5min] window that have a
 *      `google_meet_url` and no transcript yet.
 *   2. For each: refresh the creator's Google access token, find the
 *      conference record by space code, list transcripts, and concatenate
 *      entries to plain text.
 *   3. Insert a `transcripts` row, then call Claude Haiku to extract tasks.
 *   4. Bulk-insert the extracted tasks linked to the meeting's client.
 *
 * Auth: `Authorization: Bearer <CRON_SECRET>`.
 *
 * Skip behaviors (logged, non-fatal, NOT counted as errors):
 *   - Creator hasn't connected Google
 *   - No conference record for the meeting code (didn't actually happen)
 *   - No transcripts on the conference record (Workspace tier doesn't have
 *     transcripts, or recording was off)
 *   - Empty transcript text after concatenation
 */

const BATCH_SIZE = 5;
const LOOKBACK_DAYS = 7;

type MeetingCandidate = {
  id: string;
  title: string;
  client_id: string | null;
  starts_at: string;
  ends_at: string | null;
  google_meet_url: string | null;
  created_by: string | null;
};

async function handler(request: NextRequest) {
  const ip = ipFromHeaders(request.headers);
  const rl = checkRateLimit({
    key: `cron.transcript-pull:${ip}`,
    limit: 6,
    windowMs: 60_000,
  });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "rate_limited", resetMs: rl.resetMs },
      { status: 429 },
    );
  }

  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return NextResponse.json({ error: "no_cron_secret" }, { status: 500 });
  }
  if (request.headers.get("authorization") !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const missing: string[] = [];
  const googleCredsResult = readGoogleCreds();
  if (!googleCredsResult.ok) missing.push(...googleCredsResult.missing);
  if (!process.env.ANTHROPIC_API_KEY?.trim()) missing.push("ANTHROPIC_API_KEY");
  if (missing.length > 0) {
    log.warn("cron.transcript-pull", "missing env", { missing });
    return NextResponse.json(
      { error: "creds_missing", missing },
      { status: 503 },
    );
  }
  const googleCreds: GoogleOAuthCreds = googleCredsResult.ok
    ? googleCredsResult.creds
    : ({} as GoogleOAuthCreds);

  const admin = createAdminSupabase(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  const lookbackIso = new Date(
    Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();
  const recentlyEndedIso = new Date(Date.now() - 5 * 60 * 1000).toISOString();

  const { data: candidates } = await admin
    .from("meetings")
    .select(
      "id, title, client_id, starts_at, ends_at, google_meet_url, created_by, transcripts(id)",
    )
    .gte("ends_at", lookbackIso)
    .lte("ends_at", recentlyEndedIso)
    .not("google_meet_url", "is", null)
    .not("created_by", "is", null)
    .limit(BATCH_SIZE * 4);

  // Filter out meetings that already have a transcript. We over-fetch and
  // filter in JS because Supabase's PostgREST doesn't expose a clean
  // `where transcripts.id is null` join filter for nested selects.
  const todo: MeetingCandidate[] = (
    (candidates ?? []) as Array<MeetingCandidate & { transcripts: { id: string }[] }>
  )
    .filter((m) => !m.transcripts || m.transcripts.length === 0)
    .slice(0, BATCH_SIZE);

  const summary = {
    candidates: todo.length,
    transcribed: 0,
    skipped: 0,
    failed: 0,
    tasksCreated: 0,
  };

  for (const meeting of todo) {
    try {
      const result = await processMeeting(meeting, googleCreds, admin);
      if (result.skipped) summary.skipped += 1;
      else {
        summary.transcribed += 1;
        summary.tasksCreated += result.tasksCreated;
      }
    } catch (err) {
      summary.failed += 1;
      log.error("cron.transcript-pull", "meeting_failed", {
        meetingId: meeting.id,
        message: err instanceof Error ? err.message : "unknown",
      });
    }
  }

  return NextResponse.json({ ok: true, summary });
}

type ProcessResult =
  | { skipped: true; reason: string }
  | { skipped: false; tasksCreated: number };

// `admin` is untyped (`any`) so we can call .from(table) on Postgres tables
// the generated types don't surface — same pattern as src/app/api/cron/publish.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function processMeeting(
  meeting: MeetingCandidate,
  googleCreds: GoogleOAuthCreds,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
): Promise<ProcessResult> {
  const { data: profile } = await admin
    .from("profiles")
    .select(
      "id, google_refresh_token, google_access_token, google_token_expires_at, locale",
    )
    .eq("id", meeting.created_by!)
    .maybeSingle();
  if (!profile?.google_refresh_token) {
    return { skipped: true, reason: "creator_not_connected" };
  }

  const meetingCode = extractMeetingCode(meeting.google_meet_url);
  if (!meetingCode) return { skipped: true, reason: "no_meeting_code" };

  const accessToken = await getFreshAccessToken(profile, googleCreds, admin);

  let confs;
  try {
    confs = await listConferenceRecordsByCode(accessToken, meetingCode, 5);
  } catch (err) {
    if (err instanceof GoogleApiError && err.code === "http_403") {
      return { skipped: true, reason: "scope_or_tier" };
    }
    throw err;
  }
  if (confs.length === 0) return { skipped: true, reason: "no_conference_record" };

  // Pick the conference record whose endTime is closest to the meeting's
  // ends_at (or starts_at) — covers the case where a Meet code has been
  // reused across separate meetings.
  const target =
    pickClosestConference(confs, meeting.ends_at ?? meeting.starts_at) ?? confs[0];

  const transcripts = await listTranscripts(accessToken, target.name);
  const ready = transcripts.find((t) => t.state === "FILE_GENERATED") ?? transcripts[0];
  if (!ready) return { skipped: true, reason: "no_transcripts_yet" };

  const entries = await listTranscriptEntries(accessToken, ready.name);
  const text = entriesToPlainText(entries).trim();
  if (!text) return { skipped: true, reason: "empty_transcript" };

  // Persist the transcript first so we always have the raw content even if
  // Claude task extraction blows up later.
  const language = (profile.locale ?? "pt-BR") as "pt-BR" | "en";
  const { data: inserted, error: insertErr } = await admin
    .from("transcripts")
    .insert({
      meeting_id: meeting.id,
      content: text,
      source: "google_meet",
      language,
    })
    .select("id")
    .single();
  if (insertErr || !inserted) {
    throw new Error(`transcript_insert_failed: ${insertErr?.message ?? "unknown"}`);
  }

  // Mark the meeting as completed if it isn't already — the transcript
  // arriving is conclusive proof.
  await admin
    .from("meetings")
    .update({ status: "completed" })
    .eq("id", meeting.id);

  // Extract tasks via Claude Haiku.
  const tasksCreated = await extractAndInsertTasks({
    admin,
    meetingId: meeting.id,
    clientId: meeting.client_id,
    creatorId: meeting.created_by!,
    transcript: text,
    meetingTitle: meeting.title,
    language,
  });

  return { skipped: false, tasksCreated };
}

function pickClosestConference<
  T extends { name: string; endTime?: string; startTime?: string },
>(confs: T[], anchorIso: string): T | null {
  const anchor = Date.parse(anchorIso);
  if (Number.isNaN(anchor) || confs.length === 0) return confs[0] ?? null;
  let best: T | null = null;
  let bestDelta = Number.POSITIVE_INFINITY;
  for (const c of confs) {
    const t = c.endTime ?? c.startTime;
    if (!t) continue;
    const delta = Math.abs(Date.parse(t) - anchor);
    if (delta < bestDelta) {
      bestDelta = delta;
      best = c;
    }
  }
  return best ?? confs[0];
}

async function extractAndInsertTasks(params: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any;
  meetingId: string;
  clientId: string | null;
  creatorId: string;
  transcript: string;
  meetingTitle: string;
  language: "pt-BR" | "en";
}): Promise<number> {
  const { admin, clientId, creatorId, transcript, meetingTitle, language } = params;

  // Lookup client name (best-effort) for the prompt context.
  let clientName: string | null = null;
  if (clientId) {
    const { data: client } = await admin
      .from("clients")
      .select("name")
      .eq("id", clientId)
      .maybeSingle();
    clientName = client?.name ?? null;
  }

  const system = buildTaskExtractionSystem(language);
  const user = buildTaskExtractionUser(transcript, {
    meetingTitle,
    clientName,
    nowIso: new Date().toISOString(),
    language,
  });

  let extracted;
  try {
    const result = await generate({
      kind: "extract",
      system,
      messages: [{ role: "user", content: user }],
      maxTokens: 4_000,
    });
    extracted = parseExtractedTasks(result.text);
  } catch (err) {
    if (err instanceof TaskExtractionParseError) {
      log.warn("cron.transcript-pull", "task_parse_failed", {
        message: err.message,
      });
      return 0;
    }
    throw err;
  }

  if (extracted.length === 0) return 0;

  const rows = extracted.map((t) => ({
    client_id: clientId,
    title: t.title,
    description: t.assigneeHint
      ? `From transcript · mentioned: ${t.assigneeHint}`
      : null,
    status: "todo" as const,
    priority: t.priority ?? "medium",
    due_at: t.dueAt,
    created_by: creatorId,
  }));
  const { error } = await admin.from("tasks").insert(rows);
  if (error) {
    log.error("cron.transcript-pull", "tasks_insert_failed", {
      message: error.message,
    });
    return 0;
  }
  return rows.length;
}

export { handler as GET, handler as POST };
