"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Route } from "next";
import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import { parseVtt } from "@/lib/vtt";

export type TranscriptFormState = {
  error?: string;
  fieldErrors?: Partial<Record<"client_id" | "content", string>>;
};

function localePath(locale: string, path: string): Route {
  return (locale === "pt-BR" ? path : `/${locale}${path}`) as Route;
}

const MAX_BYTES = 2 * 1024 * 1024; // 2 MB — transcripts are plain text

async function readUploadedFile(file: File): Promise<string | null> {
  if (file.size > MAX_BYTES) return null;
  const buf = Buffer.from(await file.arrayBuffer());
  return buf.toString("utf8");
}

export async function createTranscriptAction(
  _prev: TranscriptFormState,
  formData: FormData,
): Promise<TranscriptFormState> {
  const clientId = (formData.get("client_id") ?? "").toString();
  const pasted = (formData.get("content") ?? "").toString();
  const language = (formData.get("language") ?? "pt-BR").toString();
  const locale = (formData.get("locale") ?? "pt-BR").toString();
  const file = formData.get("file");

  if (!clientId) return { fieldErrors: { client_id: "required" } };

  let raw = pasted.trim();
  let source: string = "manual_paste";
  if (!raw && file instanceof File && file.size > 0) {
    const text = await readUploadedFile(file);
    if (!text) return { fieldErrors: { content: "tooLarge" } };
    raw = text;
    source = file.name.toLowerCase().endsWith(".vtt") ? "vtt_upload" : "txt_upload";
  }

  if (!raw) return { fieldErrors: { content: "required" } };

  const content = parseVtt(raw);
  if (content.length < 20) return { fieldErrors: { content: "tooShort" } };

  const supabase = await createSupabaseClient();

  // Transcripts RLS requires a meeting_id. We don't have one yet (Sprint 9),
  // so create an ad-hoc meeting row to hang the transcript off of.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: meeting, error: meetingError } = await supabase
    .from("meetings")
    .insert({
      client_id: clientId,
      title: "Imported transcript",
      starts_at: new Date().toISOString(),
      status: "completed",
      created_by: user?.id ?? null,
    })
    .select("id")
    .single();
  if (meetingError || !meeting) {
    return { error: meetingError?.message ?? "Failed to create meeting." };
  }

  const { error, data } = await supabase
    .from("transcripts")
    .insert({
      meeting_id: meeting.id,
      language,
      content,
      source,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  revalidatePath(`/${locale}/content-engine`);
  redirect(localePath(locale, `/content-engine`));
  // Suppress "unused" on data; redirect() throws so this is unreachable.
  void data;
}
