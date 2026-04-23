"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Route } from "next";
import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import type { MeetingStatus } from "@/types/database";
import { MEETING_STATUSES } from "@/types/database";

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
  const locale = (formData.get("locale") ?? "pt-BR").toString();

  return {
    title,
    status,
    startsAt,
    rawStarts,
    endsAt,
    clientId,
    googleMeetUrl,
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
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("meetings").insert({
    client_id: form.clientId,
    title: form.title,
    starts_at: form.startsAt,
    ends_at: form.endsAt,
    status: form.status,
    google_meet_url: form.googleMeetUrl,
    created_by: user?.id ?? null,
  });

  if (error) return { error: error.message };

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
  const { error } = await supabase
    .from("meetings")
    .update({
      client_id: form.clientId,
      title: form.title,
      starts_at: form.startsAt,
      ends_at: form.endsAt,
      status: form.status,
      google_meet_url: form.googleMeetUrl,
    })
    .eq("id", meetingId);

  if (error) return { error: error.message };

  revalidatePath(`/${form.locale}/meetings`);
  revalidatePath(`/${form.locale}/meetings/${meetingId}`);
  redirect(localePath(form.locale, `/meetings/${meetingId}`));
}

export async function deleteMeetingAction(formData: FormData): Promise<void> {
  const meetingId = (formData.get("meetingId") ?? "").toString();
  const locale = (formData.get("locale") ?? "pt-BR").toString();
  if (!meetingId) return;

  const supabase = await createSupabaseClient();
  await supabase.from("meetings").delete().eq("id", meetingId);

  revalidatePath(`/${locale}/meetings`);
  redirect(localePath(locale, "/meetings"));
}
