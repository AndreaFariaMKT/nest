// Best-effort mirror layer: when a Nest meeting is created/updated/deleted,
// reflect the change to the creator's Google Calendar (if they've connected
// Google). Failures are logged but do NOT block the user-facing action — a
// missing mirror is better than a refused save.
//
// All persistence here uses service-role because:
//   1. We update profiles.google_access_token / google_token_expires_at on
//      refresh, and those columns are server-managed (no RLS write policy).
//   2. We update meetings.google_event_id / google_meet_url after a successful
//      mirror; the meeting's RLS policy is owner-write but service-role short-
//      circuits it for this server-only flow.

import { createClient as createAdminSupabase } from "@supabase/supabase-js";
import {
  createEvent,
  deleteEvent,
  getFreshAccessToken,
  updateEvent,
  type NestMeetingForMirror,
} from "@/lib/google-calendar";
import { readCredentials, type GoogleOAuthCreds } from "@/lib/google";
import { log } from "@/lib/log";

function adminClient() {
  return createAdminSupabase(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

async function loadCredsAndProfile(
  userId: string,
): Promise<
  | {
      ok: true;
      creds: GoogleOAuthCreds;
      profile: {
        id: string;
        google_refresh_token: string | null;
        google_access_token: string | null;
        google_token_expires_at: string | null;
      };
    }
  | { ok: false; reason: string }
> {
  const credsResult = readCredentials();
  if (!credsResult.ok) {
    return { ok: false, reason: `creds_missing:${credsResult.missing.join(",")}` };
  }
  const admin = adminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select(
      "id, google_refresh_token, google_access_token, google_token_expires_at",
    )
    .eq("id", userId)
    .maybeSingle();
  if (!profile) return { ok: false, reason: "profile_not_found" };
  if (!profile.google_refresh_token) {
    return { ok: false, reason: "user_not_connected" };
  }
  return { ok: true, creds: credsResult.creds, profile };
}

export async function mirrorMeetingCreate(
  userId: string,
  meeting: NestMeetingForMirror,
): Promise<{ eventId: string; meetUrl: string | null } | null> {
  const ctx = await loadCredsAndProfile(userId);
  if (!ctx.ok) {
    log.info("calendar-mirror.create", "skipped", { reason: ctx.reason });
    return null;
  }
  try {
    const admin = adminClient();
    const accessToken = await getFreshAccessToken(ctx.profile, ctx.creds, admin);
    const event = await createEvent(accessToken, meeting, { withMeet: true });
    await admin
      .from("meetings")
      .update({
        google_event_id: event.id,
        google_meet_url: event.meetUrl,
      })
      .eq("id", meeting.id);
    return { eventId: event.id, meetUrl: event.meetUrl };
  } catch (err) {
    log.error("calendar-mirror.create", "failed", {
      meetingId: meeting.id,
      message: err instanceof Error ? err.message : "unknown",
    });
    return null;
  }
}

export async function mirrorMeetingUpdate(
  userId: string,
  meeting: NestMeetingForMirror,
  googleEventId: string,
): Promise<boolean> {
  const ctx = await loadCredsAndProfile(userId);
  if (!ctx.ok) {
    log.info("calendar-mirror.update", "skipped", { reason: ctx.reason });
    return false;
  }
  try {
    const admin = adminClient();
    const accessToken = await getFreshAccessToken(ctx.profile, ctx.creds, admin);
    await updateEvent(accessToken, googleEventId, meeting);
    return true;
  } catch (err) {
    log.error("calendar-mirror.update", "failed", {
      meetingId: meeting.id,
      googleEventId,
      message: err instanceof Error ? err.message : "unknown",
    });
    return false;
  }
}

export async function mirrorMeetingDelete(
  userId: string,
  googleEventId: string,
): Promise<boolean> {
  const ctx = await loadCredsAndProfile(userId);
  if (!ctx.ok) {
    log.info("calendar-mirror.delete", "skipped", { reason: ctx.reason });
    return false;
  }
  try {
    const admin = adminClient();
    const accessToken = await getFreshAccessToken(ctx.profile, ctx.creds, admin);
    await deleteEvent(accessToken, googleEventId);
    return true;
  } catch (err) {
    log.error("calendar-mirror.delete", "failed", {
      googleEventId,
      message: err instanceof Error ? err.message : "unknown",
    });
    return false;
  }
}
