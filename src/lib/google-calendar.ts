// Google Calendar v3 wrapper — list/create/update/delete events on the user's
// primary calendar, with automatic Meet link generation via `conferenceData`.
//
// Pattern mirrors src/lib/google.ts and src/lib/instagram.ts: pure mappers
// (Nest meeting ↔ Calendar event resource) carry the unit tests; the IO
// functions (fetch wrappers) are smoke-only.
//
// Auth model: callers pass a fresh access token. `getFreshAccessToken` below
// is the canonical way to get one — it refreshes via the refresh token when
// the persisted access token is stale, and writes the new pair back to
// `profiles`. All write paths must use service-role for the persistence step
// because `profiles.google_*` columns are server-managed.

import {
  GoogleApiError,
  isAccessTokenStale,
  refreshAccessToken,
  type GoogleOAuthCreds,
  expiresAtIso,
} from "@/lib/google";

export const CALENDAR_BASE = "https://www.googleapis.com/calendar/v3";

// ───────────────────────────────────────────────────────────────────────────
// Auth helper — refresh stale access tokens automatically
// ───────────────────────────────────────────────────────────────────────────

export type ProfileGoogleSlice = {
  id: string;
  google_refresh_token: string | null;
  google_access_token: string | null;
  google_token_expires_at: string | null;
};

// Loose structural type — matches the bits of @supabase/supabase-js we use
// without dragging the full SupabaseClient generic into this file. The
// Supabase chain is a thenable (PromiseLike), not a true Promise, so we
// declare `then` instead of returning `Promise<...>`.
export type SupabaseAdminLike = {
  from: (table: string) => {
    update: (values: Record<string, unknown>) => {
      eq: (column: string, value: unknown) => PromiseLike<unknown>;
    };
  };
};

/**
 * Returns a usable access token. Refreshes via the refresh token when the
 * persisted access token is missing or within the 60s lead window. The fresh
 * pair is written back to `profiles` so subsequent calls hit the cache.
 *
 * Throws when the user has not connected Google (no refresh token) — callers
 * should treat that as "feature off for this user", not as an error.
 */
export async function getFreshAccessToken(
  profile: ProfileGoogleSlice,
  creds: GoogleOAuthCreds,
  admin: SupabaseAdminLike,
  now: Date = new Date(),
): Promise<string> {
  if (!profile.google_refresh_token) {
    throw new GoogleApiError({
      message: "Profile has no Google refresh token",
      code: "not_connected",
      httpStatus: 0,
      origin: "auth",
      raw: { profileId: profile.id },
    });
  }
  if (
    profile.google_access_token &&
    !isAccessTokenStale(profile.google_token_expires_at, now)
  ) {
    return profile.google_access_token;
  }
  const refreshed = await refreshAccessToken(creds, profile.google_refresh_token);
  await admin
    .from("profiles")
    .update({
      google_access_token: refreshed.accessToken,
      google_token_expires_at: expiresAtIso(refreshed.expiresInSec, now),
    })
    .eq("id", profile.id);
  return refreshed.accessToken;
}

// ───────────────────────────────────────────────────────────────────────────
// Event resource mappers (pure)
// ───────────────────────────────────────────────────────────────────────────

export type NestMeetingForMirror = {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string | null;
  description?: string | null;
};

export type CalendarEventResource = {
  summary: string;
  description?: string;
  start: { dateTime: string };
  end: { dateTime: string };
  conferenceData?: {
    createRequest: {
      requestId: string;
      conferenceSolutionKey: { type: "hangoutsMeet" };
    };
  };
};

const ONE_HOUR_MS = 60 * 60 * 1000;

/**
 * Translate a Nest meeting into a Calendar event resource. When `ends_at` is
 * null we synthesize a 1h end time — Google requires both start and end. The
 * `conferenceData.createRequest` triggers Google to allocate a fresh Meet
 * link; the `requestId` MUST be stable for retries to be idempotent.
 */
export function buildEventResource(
  meeting: NestMeetingForMirror,
  options: { withMeet?: boolean } = {},
): CalendarEventResource {
  const startsAt = meeting.starts_at;
  const endsAt =
    meeting.ends_at ??
    new Date(new Date(startsAt).getTime() + ONE_HOUR_MS).toISOString();

  const resource: CalendarEventResource = {
    summary: meeting.title,
    start: { dateTime: startsAt },
    end: { dateTime: endsAt },
  };
  if (meeting.description) resource.description = meeting.description;
  if (options.withMeet) {
    resource.conferenceData = {
      createRequest: {
        requestId: `nest-meeting-${meeting.id}`,
        conferenceSolutionKey: { type: "hangoutsMeet" },
      },
    };
  }
  return resource;
}

// ───────────────────────────────────────────────────────────────────────────
// Event response shape (pure parser)
// ───────────────────────────────────────────────────────────────────────────

export type CalendarEventResponse = {
  id: string;
  summary?: string;
  description?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  hangoutLink?: string;
  conferenceData?: {
    entryPoints?: Array<{ entryPointType?: string; uri?: string }>;
  };
  htmlLink?: string;
};

export type ParsedCalendarEvent = {
  id: string;
  title: string;
  startsAt: string | null;
  endsAt: string | null;
  meetUrl: string | null;
  htmlLink: string | null;
};

/**
 * Pull the fields Nest cares about. Prefers `hangoutLink` (a top-level
 * shortcut) but falls back to scanning `conferenceData.entryPoints` for
 * `entryPointType === "video"` so we still capture the Meet link on
 * recurring events that omit `hangoutLink`.
 */
export function parseEventResponse(raw: CalendarEventResponse): ParsedCalendarEvent {
  const startsAt = raw.start?.dateTime ?? raw.start?.date ?? null;
  const endsAt = raw.end?.dateTime ?? raw.end?.date ?? null;
  let meetUrl: string | null = raw.hangoutLink ?? null;
  if (!meetUrl && raw.conferenceData?.entryPoints) {
    const video = raw.conferenceData.entryPoints.find(
      (e) => e.entryPointType === "video" && typeof e.uri === "string",
    );
    if (video?.uri) meetUrl = video.uri;
  }
  return {
    id: raw.id,
    title: raw.summary ?? "",
    startsAt: startsAt ? new Date(startsAt).toISOString() : null,
    endsAt: endsAt ? new Date(endsAt).toISOString() : null,
    meetUrl,
    htmlLink: raw.htmlLink ?? null,
  };
}

// ───────────────────────────────────────────────────────────────────────────
// IO — Calendar API endpoints
// ───────────────────────────────────────────────────────────────────────────

const CALENDAR_ID = "primary";

async function callCalendar<T>(
  accessToken: string,
  path: string,
  init: RequestInit & { searchParams?: Record<string, string> } = {},
): Promise<T> {
  const { searchParams, ...rest } = init;
  const url = new URL(`${CALENDAR_BASE}${path}`);
  if (searchParams) {
    for (const [k, v] of Object.entries(searchParams)) {
      url.searchParams.set(k, v);
    }
  }
  const response = await fetch(url, {
    ...rest,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(rest.headers ?? {}),
    },
  });

  // 204 No Content (events.delete) — treat as ok, return empty.
  if (response.status === 204) return undefined as T;

  const text = await response.text();
  let body: unknown;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    throw new GoogleApiError({
      message: `Non-JSON Calendar response (${response.status})`,
      code: "non_json",
      httpStatus: response.status,
      origin: `calendar:${path}`,
      raw: text,
    });
  }
  if (!response.ok) {
    const err = body as { error?: { message?: string; errors?: unknown[] } };
    throw new GoogleApiError({
      message: err.error?.message ?? `Calendar error (${response.status})`,
      code: response.status === 401 ? "unauthorized" : `http_${response.status}`,
      httpStatus: response.status,
      origin: `calendar:${path}`,
      raw: body,
    });
  }
  return body as T;
}

export type ListEventsParams = {
  timeMin: string; // RFC3339
  timeMax: string;
  maxResults?: number;
};

export async function listEvents(
  accessToken: string,
  params: ListEventsParams,
): Promise<ParsedCalendarEvent[]> {
  const body = await callCalendar<{ items?: CalendarEventResponse[] }>(
    accessToken,
    `/calendars/${encodeURIComponent(CALENDAR_ID)}/events`,
    {
      method: "GET",
      searchParams: {
        timeMin: params.timeMin,
        timeMax: params.timeMax,
        singleEvents: "true",
        orderBy: "startTime",
        maxResults: String(params.maxResults ?? 50),
      },
    },
  );
  return (body.items ?? []).map(parseEventResponse);
}

export async function createEvent(
  accessToken: string,
  meeting: NestMeetingForMirror,
  options: { withMeet?: boolean } = { withMeet: true },
): Promise<ParsedCalendarEvent> {
  const resource = buildEventResource(meeting, options);
  const search: Record<string, string> = {};
  if (options.withMeet) search.conferenceDataVersion = "1";
  const body = await callCalendar<CalendarEventResponse>(
    accessToken,
    `/calendars/${encodeURIComponent(CALENDAR_ID)}/events`,
    {
      method: "POST",
      body: JSON.stringify(resource),
      searchParams: search,
    },
  );
  return parseEventResponse(body);
}

export async function updateEvent(
  accessToken: string,
  eventId: string,
  meeting: NestMeetingForMirror,
): Promise<ParsedCalendarEvent> {
  const resource = buildEventResource(meeting, { withMeet: false });
  const body = await callCalendar<CalendarEventResponse>(
    accessToken,
    `/calendars/${encodeURIComponent(CALENDAR_ID)}/events/${encodeURIComponent(eventId)}`,
    { method: "PATCH", body: JSON.stringify(resource) },
  );
  return parseEventResponse(body);
}

export async function deleteEvent(
  accessToken: string,
  eventId: string,
): Promise<void> {
  await callCalendar<void>(
    accessToken,
    `/calendars/${encodeURIComponent(CALENDAR_ID)}/events/${encodeURIComponent(eventId)}`,
    { method: "DELETE" },
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Time helpers (pure)
// ───────────────────────────────────────────────────────────────────────────

/** Returns the [now, now+days] window as RFC3339 ISO strings. */
export function next30DaysWindow(
  now: Date = new Date(),
  days: number = 30,
): { timeMin: string; timeMax: string } {
  const min = now.toISOString();
  const max = new Date(now.getTime() + days * 24 * ONE_HOUR_MS).toISOString();
  return { timeMin: min, timeMax: max };
}
