// Google Meet REST API v2 wrapper — used by the transcript-pull cron to
// fetch the transcript of a finished meeting.
//
// Auth model: same access token as src/lib/google-calendar.ts (callers must
// have granted the meetings.space.readonly scope).
//
// Pricing/tier note: Meet transcripts are a Google Workspace Business
// Standard or higher feature. For accounts on lower tiers, the transcripts
// list comes back empty — callers treat that as "no transcript for this
// meeting" and move on.

import { GoogleApiError } from "@/lib/google";

export const MEET_BASE = "https://meet.googleapis.com/v2";

// ───────────────────────────────────────────────────────────────────────────
// Pure helpers
// ───────────────────────────────────────────────────────────────────────────

/**
 * Extract the meeting space code from a Google Meet URL.
 *
 *   https://meet.google.com/abc-defg-hij → abc-defg-hij
 *   https://meet.google.com/abc-defg-hij?authuser=0 → abc-defg-hij
 *   https://meet.google.com/lookup/xyz123 → xyz123
 *
 * Returns null when the URL doesn't match the expected shape.
 */
export function extractMeetingCode(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.endsWith("meet.google.com")) return null;
    // Strip leading "/" and any "/lookup/" prefix.
    const path = parsed.pathname.replace(/^\//, "").replace(/^lookup\//, "");
    const first = path.split("/")[0];
    return first || null;
  } catch {
    return null;
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Conference records + transcripts API shapes
// ───────────────────────────────────────────────────────────────────────────

export type ConferenceRecord = {
  /** Resource name, e.g. `conferenceRecords/abc-123` */
  name: string;
  startTime?: string;
  endTime?: string;
  /** `spaces/{space_id}` */
  space?: string;
};

export type Transcript = {
  /** `conferenceRecords/{conf}/transcripts/{tid}` */
  name: string;
  state?: "STATE_UNSPECIFIED" | "STARTED" | "ENDED" | "FILE_GENERATED";
  startTime?: string;
  endTime?: string;
};

export type TranscriptEntry = {
  name: string;
  participant?: string;
  text?: string;
  languageCode?: string;
  startTime?: string;
  endTime?: string;
};

// ───────────────────────────────────────────────────────────────────────────
// IO
// ───────────────────────────────────────────────────────────────────────────

async function callMeet<T>(
  accessToken: string,
  path: string,
  searchParams?: Record<string, string>,
): Promise<T> {
  const url = new URL(`${MEET_BASE}${path}`);
  if (searchParams) {
    for (const [k, v] of Object.entries(searchParams)) {
      url.searchParams.set(k, v);
    }
  }
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const text = await response.text();
  let body: unknown;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    throw new GoogleApiError({
      message: `Non-JSON Meet response (${response.status})`,
      code: "non_json",
      httpStatus: response.status,
      origin: `meet:${path}`,
      raw: text,
    });
  }
  if (!response.ok) {
    const err = body as { error?: { message?: string } };
    throw new GoogleApiError({
      message: err.error?.message ?? `Meet error (${response.status})`,
      code: response.status === 401 ? "unauthorized" : `http_${response.status}`,
      httpStatus: response.status,
      origin: `meet:${path}`,
      raw: body,
    });
  }
  return body as T;
}

/**
 * Find conference records for a given meeting code. Meet's filter syntax
 * uses `space.meeting_code = "abc-defg-hij"`. Returns at most `pageSize`
 * results, newest first.
 */
export async function listConferenceRecordsByCode(
  accessToken: string,
  meetingCode: string,
  pageSize: number = 10,
): Promise<ConferenceRecord[]> {
  const body = await callMeet<{ conferenceRecords?: ConferenceRecord[] }>(
    accessToken,
    "/conferenceRecords",
    {
      filter: `space.meeting_code = "${meetingCode}"`,
      pageSize: String(pageSize),
    },
  );
  return body.conferenceRecords ?? [];
}

export async function listTranscripts(
  accessToken: string,
  conferenceRecordName: string,
): Promise<Transcript[]> {
  const body = await callMeet<{ transcripts?: Transcript[] }>(
    accessToken,
    `/${conferenceRecordName}/transcripts`,
  );
  return body.transcripts ?? [];
}

export async function listTranscriptEntries(
  accessToken: string,
  transcriptName: string,
): Promise<TranscriptEntry[]> {
  // Paginate through entries until we exhaust them. The default page size is
  // 100; meetings rarely exceed a few hundred entries so we keep this simple.
  const all: TranscriptEntry[] = [];
  let pageToken: string | undefined;
  for (let i = 0; i < 50; i++) {
    const params: Record<string, string> = { pageSize: "100" };
    if (pageToken) params.pageToken = pageToken;
    const body = await callMeet<{
      transcriptEntries?: TranscriptEntry[];
      nextPageToken?: string;
    }>(accessToken, `/${transcriptName}/entries`, params);
    all.push(...(body.transcriptEntries ?? []));
    if (!body.nextPageToken) break;
    pageToken = body.nextPageToken;
  }
  return all;
}

// ───────────────────────────────────────────────────────────────────────────
// Entry → text (pure)
// ───────────────────────────────────────────────────────────────────────────

/**
 * Concatenate transcript entries into the plain-text format already accepted
 * by the content engine (see `src/lib/vtt.ts`'s output): one line per entry,
 * speaker name (or "Unknown") followed by the text. Empty entries are
 * dropped.
 */
export function entriesToPlainText(entries: TranscriptEntry[]): string {
  const lines: string[] = [];
  for (const entry of entries) {
    const text = (entry.text ?? "").trim();
    if (!text) continue;
    const speaker = entry.participant ? short(entry.participant) : "Unknown";
    lines.push(`${speaker}: ${text}`);
  }
  return lines.join("\n");
}

function short(participantResource: string): string {
  // `conferenceRecords/{conf}/participants/{pid}` → last segment, useful for
  // de-anonymising "everyone is Unknown" when names aren't available.
  const parts = participantResource.split("/");
  return parts[parts.length - 1] ?? "Unknown";
}
