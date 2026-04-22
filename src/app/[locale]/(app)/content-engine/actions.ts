"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Route } from "next";
import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import { parseVtt } from "@/lib/vtt";
import { generate } from "@/lib/claude";
import {
  buildSystem,
  buildUser,
  DraftsParseError,
  parseDraftsPayload,
  type BrandSummary,
  type RecentDraft,
} from "@/lib/carousel-prompt";
import type { BrandColor, BrandTypography } from "@/types/database";

export type TranscriptFormState = {
  error?: string;
  fieldErrors?: Partial<Record<"client_id" | "content", string>>;
};

export type GenerateCarouselsState = {
  error?: string;
  draftsCreated?: number;
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

// ───────────────────────────────────────────────────────────────────────────
// Generate carousels (Claude call)
// ───────────────────────────────────────────────────────────────────────────

export async function generateCarouselsAction(
  formData: FormData,
): Promise<void> {
  const transcriptId = (formData.get("transcriptId") ?? "").toString();
  const locale = (formData.get("locale") ?? "pt-BR").toString();
  if (!transcriptId) return;

  const supabase = await createSupabaseClient();

  type MeetingShape = {
    client_id: string | null;
    client: { id: string; name: string } | Array<{ id: string; name: string }> | null;
  };
  type TranscriptRow = {
    id: string;
    content: string;
    language: string;
    meeting: MeetingShape | Array<MeetingShape> | null;
  };

  const { data: transcript } = await supabase
    .from("transcripts")
    .select(
      "id, content, language, meeting:meetings!inner(client_id, client:clients(id, name))",
    )
    .eq("id", transcriptId)
    .maybeSingle();
  if (!transcript) return;
  const trow = transcript as unknown as TranscriptRow;
  const meeting = pickOne(trow.meeting);
  const client = meeting ? pickOne(meeting.client) : null;
  if (!client) return;

  // Brand summary for the cached-brand system block
  const { data: kit } = await supabase
    .from("brand_kits")
    .select("name, palette, typography, voice_tone, do_list, dont_list")
    .eq("client_id", client.id)
    .maybeSingle();
  const brand: BrandSummary | null = kit
    ? {
        name: kit.name,
        palette: (kit.palette as BrandColor[]) ?? [],
        typography: (kit.typography as BrandTypography) ?? null,
        voiceTone: kit.voice_tone,
        doList: kit.do_list ?? [],
        dontList: kit.dont_list ?? [],
      }
    : null;

  // Recent drafts to avoid repetition
  const { data: recentRows } = await supabase
    .from("content_drafts")
    .select("title, pillar")
    .eq("client_id", client.id)
    .order("created_at", { ascending: false })
    .limit(10);
  const recent: RecentDraft[] = (recentRows ?? []).map((r) => ({
    title: r.title,
    pillar: r.pillar,
  }));

  // Ask Claude — system has the brand context; cache_control = ephemeral so
  // repeat generations for this client reuse ~90% of the prefix.
  const systemText = buildSystem(brand, trow.language);
  const user = buildUser(trow.content, recent, trow.language);

  const result = await generate({
    kind: "content",
    system: [
      {
        type: "text",
        text: systemText,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: user }],
    maxTokens: 64_000,
    stream: true,
  });

  let payload;
  try {
    payload = parseDraftsPayload(result.text);
  } catch (err) {
    const msg = err instanceof DraftsParseError ? err.message : "parse failed";
    console.error(
      "[generate-carousels] parse error:",
      msg,
      "| stop_reason:", result.stopReason,
      "| text length:", result.text.length,
      "| tail:", result.text.slice(-300),
    );
    return;
  }

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  for (const draft of payload.drafts) {
    const { data: inserted } = await supabase
      .from("content_drafts")
      .insert({
        client_id: client.id,
        transcript_id: trow.id,
        title: draft.title,
        pillar: draft.pillar,
        hook: draft.hook,
        caption: draft.caption,
        hashtags: draft.hashtags,
        status: "draft",
        created_by: authUser?.id ?? null,
      })
      .select("id")
      .single();
    if (!inserted) continue;

    const slidesToInsert = draft.slides.map((s, index) => ({
      draft_id: inserted.id,
      position: index + 1,
      headline: s.headline || null,
      body: s.body || null,
    }));
    if (slidesToInsert.length > 0) {
      await supabase.from("slides").insert(slidesToInsert);
    }
  }

  revalidatePath(`/${locale}/content-engine`);
  revalidatePath(`/${locale}/content-engine/transcripts/${trow.id}`);
  redirect(localePath(locale, `/content-engine/transcripts/${trow.id}`));
}

function pickOne<T>(v: T | T[] | null): T | null {
  if (!v) return null;
  return Array.isArray(v) ? v[0] ?? null : v;
}
