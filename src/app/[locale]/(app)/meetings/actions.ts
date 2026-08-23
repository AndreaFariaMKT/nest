"use server";

import { revalidatePath } from "next/cache";

import type { Database } from "@/types/database.gen";
import { redirect } from "next/navigation";
import type { Route } from "next";
import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import { currentTenantId } from "@/lib/tenant-server";
import type { MeetingStatus } from "@/types/database";
import { MEETING_STATUSES } from "@/types/database";
import {
  mirrorMeetingCreate,
  mirrorMeetingDelete,
  mirrorMeetingUpdate,
} from "@/lib/calendar-mirror";

export type MeetingFormState = {
  error?: string;
  fieldErrors?: Partial<Record<"title" | "starts_at", string>>;
};

function localePath(locale: string, path: string): Route {
  return (locale === "pt-BR" ? path : `/${locale}${path}`) as Route;
}

function readForm(formData: FormData) {
  const title = (formData.get("title") ?? "").toString().trim();
  const rawStatus = (formData.get("status") ?? "scheduled").toString();
  const status: MeetingStatus = (MEETING_STATUSES as string[]).includes(
    rawStatus,
  )
    ? (rawStatus as MeetingStatus)
    : "scheduled";
  const rawStarts = (formData.get("starts_at") ?? "").toString().trim();
  const startsAt = rawStarts ? new Date(rawStarts).toISOString() : null;
  const rawEnds = (formData.get("ends_at") ?? "").toString().trim();
  const endsAt = rawEnds ? new Date(rawEnds).toISOString() : null;
  const clientId =
    (formData.get("client_id") ?? "").toString().trim() || null;
  const googleMeetUrl =
    (formData.get("google_meet_url") ?? "").toString().trim() || null;
  const summary = (formData.get("summary") ?? "").toString().trim() || null;
  const agendaUrl =
    (formData.get("agenda_url") ?? "").toString().trim() || null;
  const transcriptUrl =
    (formData.get("transcript_url") ?? "").toString().trim() || null;
  // One decision per line — the part of a meeting that has to survive it.
  const decisions = (formData.get("decisions") ?? "")
    .toString()
    .split("\n")
    .map((d) => d.trim())
    .filter(Boolean);
  const locale = (formData.get("locale") ?? "pt-BR").toString();

  return {
    title,
    status,
    startsAt,
    rawStarts,
    endsAt,
    clientId,
    googleMeetUrl,
    summary,
    agendaUrl,
    transcriptUrl,
    decisions,
    locale,
  };
}

export async function createMeetingAction(
  _prev: MeetingFormState,
  formData: FormData,
): Promise<MeetingFormState> {
  const form = readForm(formData);
  if (form.title.length < 2) return { fieldErrors: { title: "tooShort" } };
  if (!form.rawStarts || !form.startsAt) {
    return { fieldErrors: { starts_at: "required" } };
  }

  const supabase = await createSupabaseClient();
  const tenantId = await currentTenantId();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: inserted, error } = await supabase
    .from("meetings")
    .insert({
      tenant_id: tenantId,
      client_id: form.clientId,
      title: form.title,
      starts_at: form.startsAt,
      ends_at: form.endsAt,
      status: form.status,
      google_meet_url: form.googleMeetUrl,
      summary: form.summary,
      agenda_url: form.agendaUrl,
      transcript_url: form.transcriptUrl,
      decisions: form.decisions,
      created_by: user?.id ?? null,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  // Best-effort Google Calendar mirror — silent no-op when the user hasn't
  // connected Google or env creds are missing. Failures are logged.
  if (user && inserted) {
    await mirrorMeetingCreate(user.id, {
      id: inserted.id,
      title: form.title,
      starts_at: form.startsAt,
      ends_at: form.endsAt,
    });
  }

  revalidatePath(`/${form.locale}/meetings`);
  redirect(localePath(form.locale, "/meetings"));
}

export async function updateMeetingAction(
  _prev: MeetingFormState,
  formData: FormData,
): Promise<MeetingFormState> {
  const meetingId = (formData.get("meetingId") ?? "").toString();
  if (!meetingId) return { error: "Missing meeting id." };

  const form = readForm(formData);
  if (form.title.length < 2) return { fieldErrors: { title: "tooShort" } };
  if (!form.rawStarts || !form.startsAt) {
    return { fieldErrors: { starts_at: "required" } };
  }

  const supabase = await createSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: existing } = await supabase
    .from("meetings")
    .select("google_event_id")
    .eq("id", meetingId)
    .maybeSingle();

  const { error } = await supabase
    .from("meetings")
    .update({
      client_id: form.clientId,
      title: form.title,
      starts_at: form.startsAt,
      ends_at: form.endsAt,
      status: form.status,
      google_meet_url: form.googleMeetUrl,
      summary: form.summary,
      agenda_url: form.agendaUrl,
      transcript_url: form.transcriptUrl,
      decisions: form.decisions,
    })
    .eq("id", meetingId);

  if (error) return { error: error.message };

  // Best-effort Google Calendar mirror — patch existing event if one was
  // created earlier; otherwise skip (we don't backfill on edit because the
  // user may have intentionally avoided creating a calendar event).
  if (user && existing?.google_event_id) {
    await mirrorMeetingUpdate(
      user.id,
      {
        id: meetingId,
        title: form.title,
        starts_at: form.startsAt,
        ends_at: form.endsAt,
      },
      existing.google_event_id,
    );
  }

  revalidatePath(`/${form.locale}/meetings`);
  revalidatePath(`/${form.locale}/meetings/${meetingId}`);
  redirect(localePath(form.locale, `/meetings/${meetingId}`));
}

export async function deleteMeetingAction(formData: FormData): Promise<void> {
  const meetingId = (formData.get("meetingId") ?? "").toString();
  const locale = (formData.get("locale") ?? "pt-BR").toString();
  if (!meetingId) return;

  const supabase = await createSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: existing } = await supabase
    .from("meetings")
    .select("google_event_id")
    .eq("id", meetingId)
    .maybeSingle();

  await supabase.from("meetings").delete().eq("id", meetingId);

  // Best-effort cleanup — keep going even if the calendar delete fails so
  // the user doesn't see a stale row in Nest.
  if (user && existing?.google_event_id) {
    await mirrorMeetingDelete(user.id, existing.google_event_id);
  }

  revalidatePath(`/${locale}/meetings`);
  redirect(localePath(locale, "/meetings"));
}

/**
 * Drop-to-reschedule: shifts a meeting to a new date, preserving the
 * original local time-of-day. Called from the calendar grid's drag handler.
 *
 * Input:
 *   meetingId — uuid
 *   newDate   — YYYY-MM-DD (the target calendar cell)
 *   locale    — for revalidation path
 */
export async function rescheduleMeetingAction(
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  const meetingId = (formData.get("meetingId") ?? "").toString();
  const newDate = (formData.get("newDate") ?? "").toString();
  const locale = (formData.get("locale") ?? "pt-BR").toString();
  if (!meetingId) return { ok: false, error: "missing_id" };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(newDate)) {
    return { ok: false, error: "bad_date" };
  }

  const supabase = await createSupabaseClient();
  const { data: existing } = await supabase
    .from("meetings")
    .select("starts_at, ends_at")
    .eq("id", meetingId)
    .maybeSingle();
  if (!existing) return { ok: false, error: "not_found" };

  // Preserve the local hour/minute; only replace the date portion.
  const oldStarts = new Date(existing.starts_at);
  const [y, m, d] = newDate.split("-").map((n) => Number.parseInt(n, 10));
  const newStarts = new Date(oldStarts);
  newStarts.setFullYear(y, m - 1, d);

  const patch: Database["public"]["Tables"]["meetings"]["Update"] = {
    starts_at: newStarts.toISOString(),
  };
  if (existing.ends_at) {
    const oldEnds = new Date(existing.ends_at);
    const deltaMs = newStarts.getTime() - oldStarts.getTime();
    const newEnds = new Date(oldEnds.getTime() + deltaMs);
    patch.ends_at = newEnds.toISOString();
  }

  const { error } = await supabase
    .from("meetings")
    .update(patch)
    .eq("id", meetingId);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/${locale}/calendar`);
  revalidatePath(`/${locale}/meetings`);
  revalidatePath(`/${locale}/meetings/${meetingId}`);
  return { ok: true };
}
