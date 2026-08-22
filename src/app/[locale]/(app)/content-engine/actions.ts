"use server";

import { revalidatePath } from "next/cache";
import { Constants } from "@/types/database.gen";
import { redirect } from "next/navigation";
import type { Route } from "next";
import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import { currentTenantId } from "@/lib/tenant-server";
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
import {
  buildRewriteSystem,
  buildRewriteUser,
  parseRewritePayload,
  RewriteParseError,
  type RewriteBrand,
} from "@/lib/carousel-rewrite";
import {
  AdaptParseError,
  buildAdaptSystem,
  buildAdaptUser,
  parseAdaptPayload,
  type AdaptBrand,
  type AdaptPlatform,
} from "@/lib/carousel-adapt";
import {
  buildStorySystem,
  buildStoryUser,
  parseStoryPayload,
  StoryParseError,
  type StoryBrand,
} from "@/lib/story-gen";
import {
  buildReelSystem,
  buildReelUser,
  parseReelPayload,
  ReelParseError,
  type ReelBrand,
} from "@/lib/reel-script";
import {
  buildDraftEmbedText,
  embedBatch,
  embedText,
  vectorToSql,
} from "@/lib/embeddings";
import {
  buildComplianceSystem,
  buildComplianceUser,
  ComplianceParseError,
  detectDomains,
  parseComplianceReport,
} from "@/lib/compliance";
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
  const tenantId = await currentTenantId();

  // Transcripts RLS requires a meeting_id. We don't have one yet (Sprint 9),
  // so create an ad-hoc meeting row to hang the transcript off of.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: meeting, error: meetingError } = await supabase
    .from("meetings")
    .insert({
      tenant_id: tenantId,
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
      tenant_id: tenantId,
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

  // Recent drafts to avoid repetition — prefer semantic similarity when
  // embeddings exist for this client, fall back to chronological recency.
  let recent: RecentDraft[] = [];
  const transcriptEmbed = await embedText(trow.content.slice(0, 8000)).catch(
    () => null,
  );
  if (transcriptEmbed) {
    const { data: similarRows } = await supabase.rpc("match_drafts", {
      query_embedding: vectorToSql(transcriptEmbed.vector),
      match_client: client.id,
      match_count: 10,
    });
    if (similarRows && similarRows.length > 0) {
      recent = (
        similarRows as Array<{ title: string; pillar: string | null }>
      ).map((r) => ({ title: r.title, pillar: r.pillar }));
    }
  }
  if (recent.length === 0) {
    const { data: recentRows } = await supabase
      .from("content_drafts")
      .select("title, pillar")
      .eq("client_id", client.id)
      .order("created_at", { ascending: false })
      .limit(10);
    recent = (recentRows ?? []).map((r) => ({
      title: r.title,
      pillar: r.pillar,
    }));
  }

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

    // Populate the draft's embedding for future similarity retrieval.
    // No-op when VOYAGE_API_KEY is unset — the column stays null and the
    // generate path falls back to chronological recency.
    const embedText = buildDraftEmbedText({
      title: draft.title,
      pillar: draft.pillar,
      hook: draft.hook,
    });
    const embed = await embedBatch([embedText]).catch(() => null);
    if (embed && embed.vectors[0]) {
      await supabase
        .from("content_drafts")
        .update({
          embedding: vectorToSql(embed.vectors[0]),
        } as never)
        .eq("id", inserted.id);
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

// ───────────────────────────────────────────────────────────────────────────
// Edit a draft (fields + slides)
// ───────────────────────────────────────────────────────────────────────────

export type DraftEditState = {
  error?: string;
  fieldErrors?: Partial<Record<"title", string>>;
};

type SlideSnapshot = {
  headline: string | null;
  body: string | null;
};

function parseSlidesPayload(raw: string): SlideSnapshot[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((s): SlideSnapshot | null => {
        if (!s || typeof s !== "object") return null;
        const row = s as Record<string, unknown>;
        const headline =
          typeof row.headline === "string" ? row.headline.trim() : "";
        const body = typeof row.body === "string" ? row.body.trim() : "";
        if (!headline && !body) return null;
        return {
          headline: headline || null,
          body: body || null,
        };
      })
      .filter((x): x is SlideSnapshot => x !== null);
  } catch {
    return [];
  }
}

function parseHashtags(raw: string): string[] {
  return raw
    .split(/[,\n]/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0)
    .map((t) => (t.startsWith("#") ? t : `#${t}`));
}

// ───────────────────────────────────────────────────────────────────────────
// Render creatives for all slides of a draft
// ───────────────────────────────────────────────────────────────────────────

// ───────────────────────────────────────────────────────────────────────────
// Approve a draft (status → "approved")
// ───────────────────────────────────────────────────────────────────────────

export async function approveDraftAction(formData: FormData): Promise<void> {
  const draftId = (formData.get("draftId") ?? "").toString();
  const locale = (formData.get("locale") ?? "pt-BR").toString();
  if (!draftId) return;

  const supabase = await createSupabaseClient();
  const { data: existing } = await supabase
    .from("content_drafts")
    .select("transcript_id, status")
    .eq("id", draftId)
    .maybeSingle();
  if (!existing) return;

  // Idempotent — skip if already approved or past approval.
  const terminal = ["approved", "scheduled", "published", "archived"];
  if (!terminal.includes(existing.status)) {
    await supabase
      .from("content_drafts")
      .update({ status: "approved" })
      .eq("id", draftId);
  }

  revalidatePath(`/${locale}/content-engine`);
  revalidatePath(`/${locale}/content-engine/drafts/${draftId}/edit`);
  if (existing.transcript_id) {
    revalidatePath(
      `/${locale}/content-engine/transcripts/${existing.transcript_id}`,
    );
    redirect(
      localePath(
        locale,
        `/content-engine/transcripts/${existing.transcript_id}`,
      ),
    );
  }
  redirect(localePath(locale, "/content-engine"));
}

// ───────────────────────────────────────────────────────────────────────────
// AI rewrite — Claude refines an existing draft based on an instruction
// ───────────────────────────────────────────────────────────────────────────

export async function aiRewriteDraftAction(formData: FormData): Promise<void> {
  const draftId = (formData.get("draftId") ?? "").toString();
  const locale = (formData.get("locale") ?? "pt-BR").toString();
  const instruction = (formData.get("instruction") ?? "").toString().trim();
  if (!draftId || instruction.length < 4) return;

  const supabase = await createSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  type JoinedDraft = {
    id: string;
    client_id: string;
    transcript_id: string | null;
    title: string;
    pillar: string | null;
    hook: string | null;
    caption: string | null;
    hashtags: string[];
    slides: Array<{
      id: string;
      position: number;
      headline: string | null;
      body: string | null;
    }>;
    transcript:
      | { language: string }
      | Array<{ language: string }>
      | null;
  };

  const { data } = await supabase
    .from("content_drafts")
    .select(
      `id, client_id, transcript_id, title, pillar, hook, caption, hashtags,
       slides(id, position, headline, body),
       transcript:transcripts(language)`,
    )
    .eq("id", draftId)
    .maybeSingle();
  if (!data) return;
  const draft = data as unknown as JoinedDraft;

  const language = pickOne(draft.transcript)?.language ?? "pt-BR";

  const orderedSlides = [...(draft.slides ?? [])].sort(
    (a, b) => a.position - b.position,
  );
  if (orderedSlides.length === 0) return;

  const { data: kit } = await supabase
    .from("brand_kits")
    .select("name, palette, typography, voice_tone, do_list, dont_list")
    .eq("client_id", draft.client_id)
    .maybeSingle();
  const { data: client } = await supabase
    .from("clients")
    .select("name")
    .eq("id", draft.client_id)
    .single();
  const brand: RewriteBrand | null = client
    ? {
        name: kit?.name ?? client.name,
        palette: (kit?.palette as BrandColor[]) ?? [],
        typography: (kit?.typography as BrandTypography) ?? null,
        voiceTone: kit?.voice_tone ?? null,
        doList: kit?.do_list ?? [],
        dontList: kit?.dont_list ?? [],
      }
    : null;

  const snapshot = {
    title: draft.title,
    pillar: draft.pillar,
    hook: draft.hook,
    caption: draft.caption,
    hashtags: draft.hashtags ?? [],
    slides: orderedSlides.map((s) => ({
      position: s.position,
      headline: s.headline,
      body: s.body,
    })),
  };

  const systemText = buildRewriteSystem(brand, language);
  const userText = buildRewriteUser(snapshot, instruction, language);

  let result;
  try {
    result = await generate({
      kind: "content",
      system: [
        {
          type: "text",
          text: systemText,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: userText }],
      maxTokens: 16_000,
    });
  } catch (err) {
    console.error("[ai-rewrite] claude call failed", err);
    return;
  }

  let payload;
  try {
    payload = parseRewritePayload(result.text, orderedSlides.length);
  } catch (err) {
    const msg = err instanceof RewriteParseError ? err.message : "parse failed";
    console.error("[ai-rewrite] parse error:", msg, result.text.slice(-200));
    return;
  }

  for (let i = 0; i < orderedSlides.length; i++) {
    const slide = orderedSlides[i];
    const revised = payload.slides[i];
    await supabase
      .from("slides")
      .update({
        headline: revised.headline || slide.headline,
        body: revised.body || slide.body,
      })
      .eq("id", slide.id);
  }
  const draftUpdate: Record<string, unknown> = {};
  if (payload.hook !== null) draftUpdate.hook = payload.hook;
  if (payload.caption !== null) draftUpdate.caption = payload.caption;
  if (Object.keys(draftUpdate).length > 0) {
    await supabase.from("content_drafts").update(draftUpdate).eq("id", draftId);
  }

  await supabase.from("ai_edits").insert({
    draft_id: draftId,
    prompt: instruction,
    response: payload.notes ?? result.text.slice(0, 2000),
    model: "claude-sonnet-4-6",
    tokens_in: result.usage.inputTokens,
    tokens_out: result.usage.outputTokens,
    created_by: user?.id ?? null,
  });

  revalidatePath(`/${locale}/content-engine/drafts/${draftId}/edit`);
  if (draft.transcript_id) {
    revalidatePath(
      `/${locale}/content-engine/transcripts/${draft.transcript_id}`,
    );
  }
  redirect(localePath(locale, `/content-engine/drafts/${draftId}/edit`));
}

// ───────────────────────────────────────────────────────────────────────────
// Compliance check (CVM / OAB / ANVISA / LGPD) via Claude
// ───────────────────────────────────────────────────────────────────────────

export async function checkComplianceAction(formData: FormData): Promise<void> {
  const draftId = (formData.get("draftId") ?? "").toString();
  const locale = (formData.get("locale") ?? "pt-BR").toString();
  if (!draftId) return;

  const supabase = await createSupabaseClient();

  type JoinedDraft = {
    id: string;
    client_id: string;
    transcript_id: string | null;
    title: string;
    pillar: string | null;
    hook: string | null;
    caption: string | null;
    hashtags: string[];
    slides: Array<{
      position: number;
      headline: string | null;
      body: string | null;
    }>;
    client:
      | { name: string; industry: string | null }
      | Array<{ name: string; industry: string | null }>
      | null;
  };

  const { data } = await supabase
    .from("content_drafts")
    .select(
      `id, client_id, transcript_id, title, pillar, hook, caption, hashtags,
       slides(position, headline, body),
       client:clients(name, industry)`,
    )
    .eq("id", draftId)
    .maybeSingle();
  if (!data) return;
  const draft = data as unknown as JoinedDraft;
  const client = pickOne(draft.client);
  if (!client) return;

  const orderedSlides = [...(draft.slides ?? [])].sort(
    (a, b) => a.position - b.position,
  );

  const domains = detectDomains(client.industry);
  const systemText = buildComplianceSystem(domains);
  const userText = buildComplianceUser(
    {
      title: draft.title,
      pillar: draft.pillar,
      hook: draft.hook,
      caption: draft.caption,
      hashtags: draft.hashtags ?? [],
      slides: orderedSlides.map((s) => ({
        headline: s.headline ?? "",
        body: s.body ?? "",
      })),
    },
    { name: client.name, industry: client.industry },
  );

  let result;
  try {
    result = await generate({
      kind: "extract", // haiku — fast + cheap; compliance is classification-ish
      system: [{ type: "text", text: systemText }],
      messages: [{ role: "user", content: userText }],
      maxTokens: 8_000,
    });
  } catch (err) {
    console.error("[compliance] Claude call failed", err);
    return;
  }

  let parsed;
  try {
    parsed = parseComplianceReport(result.text, "claude-haiku-4-5");
  } catch (err) {
    const msg =
      err instanceof ComplianceParseError ? err.message : "parse failed";
    console.error("[compliance] parse error:", msg, result.text.slice(-300));
    return;
  }

  const report = {
    ...parsed,
    checkedAt: new Date().toISOString(),
  };

  await supabase
    .from("content_drafts")
    .update({ compliance_report: report } as never)
    .eq("id", draftId);

  revalidatePath(`/${locale}/content-engine/drafts/${draftId}/edit`);
  if (draft.transcript_id) {
    revalidatePath(
      `/${locale}/content-engine/transcripts/${draft.transcript_id}`,
    );
  }
  redirect(localePath(locale, `/content-engine/drafts/${draftId}/edit`));
}

// ───────────────────────────────────────────────────────────────────────────
// Adapt a draft for a different platform (LinkedIn / TikTok)
// ───────────────────────────────────────────────────────────────────────────

export async function adaptDraftAction(formData: FormData): Promise<void> {
  const draftId = (formData.get("draftId") ?? "").toString();
  const locale = (formData.get("locale") ?? "pt-BR").toString();
  const platformRaw = (formData.get("platform") ?? "").toString();
  if (!draftId) return;
  if (platformRaw !== "linkedin" && platformRaw !== "tiktok") return;
  const platform: AdaptPlatform = platformRaw;

  const supabase = await createSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  type JoinedDraft = {
    id: string;
    client_id: string;
    transcript_id: string | null;
    title: string;
    pillar: string | null;
    hook: string | null;
    caption: string | null;
    hashtags: string[];
    slides: Array<{
      position: number;
      headline: string | null;
      body: string | null;
    }>;
    transcript:
      | { language: string }
      | Array<{ language: string }>
      | null;
  };

  const { data } = await supabase
    .from("content_drafts")
    .select(
      `id, client_id, transcript_id, title, pillar, hook, caption, hashtags,
       slides(position, headline, body),
       transcript:transcripts(language)`,
    )
    .eq("id", draftId)
    .maybeSingle();
  if (!data) return;
  const draft = data as unknown as JoinedDraft;

  const language = pickOne(draft.transcript)?.language ?? "pt-BR";

  const orderedSlides = [...(draft.slides ?? [])].sort(
    (a, b) => a.position - b.position,
  );
  if (orderedSlides.length === 0) return;

  const { data: kit } = await supabase
    .from("brand_kits")
    .select("name, palette, typography, voice_tone, do_list, dont_list")
    .eq("client_id", draft.client_id)
    .maybeSingle();
  const { data: client } = await supabase
    .from("clients")
    .select("name")
    .eq("id", draft.client_id)
    .single();
  const brand: AdaptBrand | null = client
    ? {
        name: kit?.name ?? client.name,
        palette: (kit?.palette as BrandColor[]) ?? [],
        typography: (kit?.typography as BrandTypography) ?? null,
        voiceTone: kit?.voice_tone ?? null,
        doList: kit?.do_list ?? [],
        dontList: kit?.dont_list ?? [],
      }
    : null;

  const snapshot = {
    title: draft.title,
    pillar: draft.pillar,
    hook: draft.hook,
    caption: draft.caption,
    hashtags: draft.hashtags ?? [],
    slides: orderedSlides.map((s) => ({
      position: s.position,
      headline: s.headline,
      body: s.body,
    })),
  };

  const systemText = buildAdaptSystem(brand, language, platform);
  const userText = buildAdaptUser(snapshot, language, platform);

  let result;
  try {
    result = await generate({
      kind: "content",
      system: [
        {
          type: "text",
          text: systemText,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: userText }],
      maxTokens: 16_000,
    });
  } catch (err) {
    console.error("[adapt-draft] claude call failed", err);
    return;
  }

  let payload;
  try {
    payload = parseAdaptPayload(result.text, orderedSlides.length);
  } catch (err) {
    const msg = err instanceof AdaptParseError ? err.message : "parse failed";
    console.error("[adapt-draft] parse error:", msg, result.text.slice(-300));
    return;
  }

  // Insert the adapted draft as a sibling row, with a pillar suffix to make
  // it findable. status = "draft" so Andréa can review before approval.
  const adaptedPillar = draft.pillar
    ? `${draft.pillar} · ${platform}`
    : platform;
  const { data: inserted } = await supabase
    .from("content_drafts")
    .insert({
      client_id: draft.client_id,
      transcript_id: draft.transcript_id,
      title: payload.title,
      pillar: adaptedPillar,
      hook: payload.hook,
      caption: payload.caption,
      hashtags: payload.hashtags,
      status: "draft",
      created_by: user?.id ?? null,
    })
    .select("id")
    .single();
  if (!inserted) return;

  const slidesToInsert = payload.slides.map((s, i) => ({
    draft_id: inserted.id,
    position: i + 1,
    headline: s.headline || null,
    body: s.body || null,
  }));
  if (slidesToInsert.length > 0) {
    await supabase.from("slides").insert(slidesToInsert);
  }

  await supabase.from("ai_edits").insert({
    draft_id: inserted.id,
    prompt: `[adapt:${platform}] from draft ${draft.id}`,
    response: `Adapted for ${platform} from "${draft.title}".`,
    model: "claude-sonnet-4-6",
    tokens_in: result.usage.inputTokens,
    tokens_out: result.usage.outputTokens,
    created_by: user?.id ?? null,
  });

  revalidatePath(`/${locale}/content-engine`);
  if (draft.transcript_id) {
    revalidatePath(
      `/${locale}/content-engine/transcripts/${draft.transcript_id}`,
    );
  }
  redirect(localePath(locale, `/content-engine/drafts/${inserted.id}/edit`));
}

// ───────────────────────────────────────────────────────────────────────────
// Generate Instagram Stories from an approved carousel
// ───────────────────────────────────────────────────────────────────────────

const DEFAULT_STORY_COUNT = 3;

export async function generateStoriesAction(
  formData: FormData,
): Promise<void> {
  const draftId = (formData.get("draftId") ?? "").toString();
  const locale = (formData.get("locale") ?? "pt-BR").toString();
  const rawCount = (formData.get("count") ?? "").toString().trim();
  const count = (() => {
    const n = Number.parseInt(rawCount, 10);
    if (Number.isFinite(n) && n >= 2 && n <= 6) return n;
    return DEFAULT_STORY_COUNT;
  })();
  if (!draftId) return;

  const supabase = await createSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  type JoinedDraft = {
    id: string;
    client_id: string;
    transcript_id: string | null;
    title: string;
    pillar: string | null;
    hook: string | null;
    caption: string | null;
    hashtags: string[];
    slides: Array<{
      position: number;
      headline: string | null;
      body: string | null;
    }>;
    transcript:
      | { language: string }
      | Array<{ language: string }>
      | null;
  };

  const { data } = await supabase
    .from("content_drafts")
    .select(
      `id, client_id, transcript_id, title, pillar, hook, caption, hashtags,
       slides(position, headline, body),
       transcript:transcripts(language)`,
    )
    .eq("id", draftId)
    .maybeSingle();
  if (!data) return;
  const draft = data as unknown as JoinedDraft;

  const language = pickOne(draft.transcript)?.language ?? "pt-BR";

  const orderedSlides = [...(draft.slides ?? [])].sort(
    (a, b) => a.position - b.position,
  );
  if (orderedSlides.length === 0) return;

  const { data: kit } = await supabase
    .from("brand_kits")
    .select("name, palette, typography, voice_tone, do_list, dont_list")
    .eq("client_id", draft.client_id)
    .maybeSingle();
  const { data: client } = await supabase
    .from("clients")
    .select("name")
    .eq("id", draft.client_id)
    .single();
  const brand: StoryBrand | null = client
    ? {
        name: kit?.name ?? client.name,
        palette: (kit?.palette as BrandColor[]) ?? [],
        typography: (kit?.typography as BrandTypography) ?? null,
        voiceTone: kit?.voice_tone ?? null,
        doList: kit?.do_list ?? [],
        dontList: kit?.dont_list ?? [],
      }
    : null;

  const snapshot = {
    title: draft.title,
    pillar: draft.pillar,
    hook: draft.hook,
    caption: draft.caption,
    hashtags: draft.hashtags ?? [],
    slides: orderedSlides.map((s) => ({
      position: s.position,
      headline: s.headline,
      body: s.body,
    })),
  };

  const systemText = buildStorySystem(brand, language, count);
  const userText = buildStoryUser(snapshot, language, count);

  let result;
  try {
    result = await generate({
      kind: "content",
      system: [
        {
          type: "text",
          text: systemText,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: userText }],
      maxTokens: 8_000,
    });
  } catch (err) {
    console.error("[story-gen] claude call failed", err);
    return;
  }

  let payload;
  try {
    payload = parseStoryPayload(result.text, count);
  } catch (err) {
    const msg = err instanceof StoryParseError ? err.message : "parse failed";
    console.error("[story-gen] parse error:", msg, result.text.slice(-300));
    return;
  }

  // Stories are persisted as a new content_drafts row with pillar suffix
  // "· stories". Each story → a slide (headline + body); sticker_cta lands
  // in the body as a trailing line so the renderer can pick it up later.
  const storiesPillar = draft.pillar
    ? `${draft.pillar} · stories`
    : "stories";
  const { data: inserted } = await supabase
    .from("content_drafts")
    .insert({
      client_id: draft.client_id,
      transcript_id: draft.transcript_id,
      title: `${draft.title} — stories`,
      pillar: storiesPillar,
      hook: null,
      caption: null,
      hashtags: [],
      status: "draft",
      created_by: user?.id ?? null,
    })
    .select("id")
    .single();
  if (!inserted) return;

  const slidesToInsert = payload.stories.map((s, i) => {
    const bodyWithSticker = s.stickerCta
      ? `${s.body}\n\n→ ${s.stickerCta}`
      : s.body;
    return {
      draft_id: inserted.id,
      position: i + 1,
      headline: s.headline || null,
      body: bodyWithSticker || null,
    };
  });
  if (slidesToInsert.length > 0) {
    await supabase.from("slides").insert(slidesToInsert);
  }

  await supabase.from("ai_edits").insert({
    draft_id: inserted.id,
    prompt: `[stories:${count}] from draft ${draft.id}`,
    response: `Generated ${count} stories from "${draft.title}".`,
    model: "claude-sonnet-4-6",
    tokens_in: result.usage.inputTokens,
    tokens_out: result.usage.outputTokens,
    created_by: user?.id ?? null,
  });

  revalidatePath(`/${locale}/content-engine`);
  if (draft.transcript_id) {
    revalidatePath(
      `/${locale}/content-engine/transcripts/${draft.transcript_id}`,
    );
  }
  redirect(localePath(locale, `/content-engine/drafts/${inserted.id}/edit`));
}

// ───────────────────────────────────────────────────────────────────────────
// Upload the final Reel video file → Supabase Storage → set video_url
// ───────────────────────────────────────────────────────────────────────────

const MAX_REEL_VIDEO_BYTES = 500 * 1024 * 1024; // 500 MB matches migration 011
const ALLOWED_REEL_MIME = new Set([
  "video/mp4",
  "video/quicktime",
  "video/webm",
]);

export async function uploadReelVideoAction(
  formData: FormData,
): Promise<void> {
  const draftId = (formData.get("draftId") ?? "").toString();
  const locale = (formData.get("locale") ?? "pt-BR").toString();
  const file = formData.get("video");
  if (!draftId) return;
  if (!(file instanceof File) || file.size === 0) return;
  if (file.size > MAX_REEL_VIDEO_BYTES) {
    console.error("[reel-video] upload too large", file.size);
    return;
  }
  if (!ALLOWED_REEL_MIME.has(file.type)) {
    console.error("[reel-video] disallowed mime", file.type);
    return;
  }

  const supabase = await createSupabaseClient();
  const { data: draft } = await supabase
    .from("content_drafts")
    .select("id, transcript_id")
    .eq("id", draftId)
    .maybeSingle();
  if (!draft) return;

  const extGuess = file.name.split(".").pop()?.toLowerCase();
  const ext = extGuess && /^[a-z0-9]{2,5}$/.test(extGuess) ? extGuess : "mp4";
  const path = `${draft.id}/${draft.id}-v${Date.now()}.${ext}`;
  const bytes = new Uint8Array(await file.arrayBuffer());

  const { error: uploadError } = await supabase.storage
    .from("reel-videos")
    .upload(path, bytes, { contentType: file.type, upsert: false });
  if (uploadError) {
    console.error("[reel-video] upload failed", uploadError);
    return;
  }

  const { data: urlData } = supabase.storage
    .from("reel-videos")
    .getPublicUrl(path);

  await supabase
    .from("content_drafts")
    .update({ video_url: urlData.publicUrl } as never)
    .eq("id", draftId);

  revalidatePath(`/${locale}/content-engine/drafts/${draftId}/edit`);
  if (draft.transcript_id) {
    revalidatePath(
      `/${locale}/content-engine/transcripts/${draft.transcript_id}`,
    );
  }
  redirect(localePath(locale, `/content-engine/drafts/${draftId}/edit`));
}

// ───────────────────────────────────────────────────────────────────────────
// Generate a Reel / short-form video script from a carousel
// ───────────────────────────────────────────────────────────────────────────

export async function generateReelScriptAction(
  formData: FormData,
): Promise<void> {
  const draftId = (formData.get("draftId") ?? "").toString();
  const locale = (formData.get("locale") ?? "pt-BR").toString();
  if (!draftId) return;

  const supabase = await createSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  type JoinedDraft = {
    id: string;
    client_id: string;
    transcript_id: string | null;
    title: string;
    pillar: string | null;
    hook: string | null;
    caption: string | null;
    hashtags: string[];
    slides: Array<{
      position: number;
      headline: string | null;
      body: string | null;
    }>;
    transcript:
      | { language: string }
      | Array<{ language: string }>
      | null;
  };

  const { data } = await supabase
    .from("content_drafts")
    .select(
      `id, client_id, transcript_id, title, pillar, hook, caption, hashtags,
       slides(position, headline, body),
       transcript:transcripts(language)`,
    )
    .eq("id", draftId)
    .maybeSingle();
  if (!data) return;
  const draft = data as unknown as JoinedDraft;

  const language = pickOne(draft.transcript)?.language ?? "pt-BR";

  const orderedSlides = [...(draft.slides ?? [])].sort(
    (a, b) => a.position - b.position,
  );
  if (orderedSlides.length === 0) return;

  const { data: kit } = await supabase
    .from("brand_kits")
    .select("name, palette, typography, voice_tone, do_list, dont_list")
    .eq("client_id", draft.client_id)
    .maybeSingle();
  const { data: client } = await supabase
    .from("clients")
    .select("name")
    .eq("id", draft.client_id)
    .single();
  const brand: ReelBrand | null = client
    ? {
        name: kit?.name ?? client.name,
        palette: (kit?.palette as BrandColor[]) ?? [],
        typography: (kit?.typography as BrandTypography) ?? null,
        voiceTone: kit?.voice_tone ?? null,
        doList: kit?.do_list ?? [],
        dontList: kit?.dont_list ?? [],
      }
    : null;

  const snapshot = {
    title: draft.title,
    pillar: draft.pillar,
    hook: draft.hook,
    caption: draft.caption,
    hashtags: draft.hashtags ?? [],
    slides: orderedSlides.map((s) => ({
      position: s.position,
      headline: s.headline,
      body: s.body,
    })),
  };

  const systemText = buildReelSystem(brand, language);
  const userText = buildReelUser(snapshot, language);

  let result;
  try {
    result = await generate({
      kind: "content",
      system: [
        {
          type: "text",
          text: systemText,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: userText }],
      maxTokens: 8_000,
    });
  } catch (err) {
    console.error("[reel-script] claude call failed", err);
    return;
  }

  let payload;
  try {
    payload = parseReelPayload(result.text);
  } catch (err) {
    const msg = err instanceof ReelParseError ? err.message : "parse failed";
    console.error("[reel-script] parse error:", msg, result.text.slice(-300));
    return;
  }

  // Reels are a NEW content_drafts row (no slides) carrying video_script +
  // hashtags + caption. pillar suffix "· reel" makes them filterable later.
  const reelPillar = draft.pillar ? `${draft.pillar} · reel` : "reel";
  const { data: inserted } = await supabase
    .from("content_drafts")
    .insert({
      client_id: draft.client_id,
      transcript_id: draft.transcript_id,
      title: payload.title,
      pillar: reelPillar,
      hook: payload.hookLine,
      caption: payload.caption,
      hashtags: payload.hashtags,
      status: "draft",
      video_script: payload.script,
      created_by: user?.id ?? null,
    })
    .select("id")
    .single();
  if (!inserted) return;

  await supabase.from("ai_edits").insert({
    draft_id: inserted.id,
    prompt: `[reel] from draft ${draft.id}`,
    response: `Reel script generated (est ${payload.estimatedDurationSec}s) from "${draft.title}".`,
    model: "claude-sonnet-4-6",
    tokens_in: result.usage.inputTokens,
    tokens_out: result.usage.outputTokens,
    created_by: user?.id ?? null,
  });

  revalidatePath(`/${locale}/content-engine`);
  if (draft.transcript_id) {
    revalidatePath(
      `/${locale}/content-engine/transcripts/${draft.transcript_id}`,
    );
  }
  redirect(localePath(locale, `/content-engine/drafts/${inserted.id}/edit`));
}

// ───────────────────────────────────────────────────────────────────────────
// Public approval link — mint a token, insert an `approvals` row, 14-day TTL
// ───────────────────────────────────────────────────────────────────────────

function generateToken(): string {
  const buf = new Uint8Array(32);
  crypto.getRandomValues(buf);
  return Array.from(buf)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function generateApprovalLinkAction(
  formData: FormData,
): Promise<void> {
  const draftId = (formData.get("draftId") ?? "").toString();
  const locale = (formData.get("locale") ?? "pt-BR").toString();
  if (!draftId) return;

  const supabase = await createSupabaseClient();

  const { data: draft } = await supabase
    .from("content_drafts")
    .select("id, transcript_id")
    .eq("id", draftId)
    .maybeSingle();
  if (!draft) return;

  const token = generateToken();
  const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000); // 14 days

  const { error } = await supabase.from("approvals").insert({
    draft_id: draftId,
    token,
    expires_at: expiresAt.toISOString(),
  });
  if (error) {
    console.error("[approval-link] insert failed", error);
    return;
  }

  revalidatePath(`/${locale}/content-engine/drafts/${draftId}/edit`);
  redirect(localePath(locale, `/content-engine/drafts/${draftId}/edit`));
}

// ───────────────────────────────────────────────────────────────────────────
// Schedule a post (draft must be approved)
// ───────────────────────────────────────────────────────────────────────────

export async function scheduleDraftAction(
  formData: FormData,
): Promise<void> {
  const draftId = (formData.get("draftId") ?? "").toString();
  const locale = (formData.get("locale") ?? "pt-BR").toString();
  const scheduledForRaw = (formData.get("scheduled_for") ?? "")
    .toString()
    .trim();
  const platform = (formData.get("platform") ?? "instagram").toString();
  if (!draftId || !scheduledForRaw) return;

  const scheduledFor = new Date(scheduledForRaw);
  if (Number.isNaN(scheduledFor.getTime())) return;

  const supabase = await createSupabaseClient();
  const { data: draft } = await supabase
    .from("content_drafts")
    .select("status, transcript_id")
    .eq("id", draftId)
    .maybeSingle();
  if (!draft) return;
  if (!["approved", "scheduled"].includes(draft.status)) return;

  const { error } = await supabase.from("scheduled_posts").insert({
    draft_id: draftId,
    platform: platform as "instagram" | "linkedin" | "tiktok",
    post_type: "carousel",
    scheduled_for: scheduledFor.toISOString(),
    status: "pending",
  });
  if (error) return;

  if (draft.status !== "scheduled") {
    await supabase
      .from("content_drafts")
      .update({ status: "scheduled" })
      .eq("id", draftId);
  }

  revalidatePath(`/${locale}/content-engine/drafts/${draftId}/edit`);
  if (draft.transcript_id) {
    revalidatePath(
      `/${locale}/content-engine/transcripts/${draft.transcript_id}`,
    );
  }
  redirect(localePath(locale, `/content-engine/drafts/${draftId}/edit`));
}

export async function renderCreativesAction(
  formData: FormData,
): Promise<void> {
  const draftId = (formData.get("draftId") ?? "").toString();
  const locale = (formData.get("locale") ?? "pt-BR").toString();
  if (!draftId) return;

  // Lazy imports keep the slide-render bundle out of cold starts for every
  // content-engine server action.
  const [{ buildSlideHtml, buildSlidePath, renderSlideToPng }] = await Promise.all([
    import("@/lib/slide-render"),
  ]);

  const supabase = await createSupabaseClient();

  type JoinedDraft = {
    id: string;
    client_id: string;
    transcript_id: string | null;
    slides: Array<{
      id: string;
      position: number;
      headline: string | null;
      body: string | null;
    }>;
    client:
      | { name: string; brand_kits: Array<{ palette: unknown; typography: unknown }> | null }
      | Array<{
          name: string;
          brand_kits: Array<{ palette: unknown; typography: unknown }> | null;
        }>
      | null;
  };

  const { data } = await supabase
    .from("content_drafts")
    .select(
      `id, client_id, transcript_id,
       slides(id, position, headline, body),
       client:clients(name, brand_kits(palette, typography))`,
    )
    .eq("id", draftId)
    .maybeSingle();
  if (!data) return;
  const draft = data as unknown as JoinedDraft;
  const client = pickOne(draft.client);
  if (!client) return;

  const brandKit = client.brand_kits?.[0] ?? null;
  const brand = {
    name: client.name,
    palette: (brandKit?.palette as BrandColor[]) ?? [],
    typography: (brandKit?.typography as BrandTypography) ?? null,
  };

  const slides = [...(draft.slides ?? [])].sort(
    (a, b) => a.position - b.position,
  );

  for (const slide of slides) {
    // Current highest version for this slide → +1
    const { data: versions } = await supabase
      .from("creatives")
      .select("version")
      .eq("slide_id", slide.id)
      .order("version", { ascending: false })
      .limit(1);
    const nextVersion = ((versions?.[0]?.version as number | undefined) ?? 0) + 1;

    const html = buildSlideHtml(
      { headline: slide.headline, body: slide.body, position: slide.position },
      brand,
    );
    let png: Buffer;
    try {
      png = await renderSlideToPng(html);
    } catch (err) {
      console.error("[render-creatives] render failed for slide", slide.id, err);
      continue;
    }

    const path = buildSlidePath(draft.id, slide.id, nextVersion);
    const { error: uploadError } = await supabase.storage
      .from("creatives")
      .upload(path, png, { contentType: "image/png", upsert: true });
    if (uploadError) {
      console.error("[render-creatives] upload failed", path, uploadError);
      continue;
    }

    const { data: urlData } = supabase.storage
      .from("creatives")
      .getPublicUrl(path);

    await supabase.from("creatives").insert({
      slide_id: slide.id,
      draft_id: draft.id,
      version: nextVersion,
      image_url: urlData.publicUrl,
      width: 1080,
      height: 1350,
      render_html: html,
    });
  }

  revalidatePath(`/${locale}/content-engine`);
  revalidatePath(`/${locale}/content-engine/drafts/${draft.id}/edit`);
  if (draft.transcript_id) {
    revalidatePath(
      `/${locale}/content-engine/transcripts/${draft.transcript_id}`,
    );
  }
}

export async function updateDraftAction(
  _prev: DraftEditState,
  formData: FormData,
): Promise<DraftEditState> {
  const draftId = (formData.get("draftId") ?? "").toString();
  const locale = (formData.get("locale") ?? "pt-BR").toString();
  if (!draftId) return { error: "Missing draft id." };

  const title = (formData.get("title") ?? "").toString().trim();
  if (title.length < 2) return { fieldErrors: { title: "tooShort" } };

  const pillar = (formData.get("pillar") ?? "").toString().trim() || null;
  const hook = (formData.get("hook") ?? "").toString().trim() || null;
  const caption = (formData.get("caption") ?? "").toString().trim() || null;
  const hashtags = parseHashtags((formData.get("hashtags") ?? "").toString());
  // Validated, not defaulted. Falling back to "draft" on an unrecognised value
  // is how a piece silently leaves the social pipeline.
  const rawStatus = (formData.get("status") ?? "").toString();
  const status = (Constants.public.Enums.content_status as readonly string[]).includes(
    rawStatus,
  )
    ? rawStatus
    : null;
  if (!status) return { error: "Unknown status." };
  const slides = parseSlidesPayload(
    (formData.get("slides") ?? "[]").toString(),
  );

  const supabase = await createSupabaseClient();

  const { data: draft } = await supabase
    .from("content_drafts")
    .select("id, transcript_id")
    .eq("id", draftId)
    .maybeSingle();
  if (!draft) return { error: "Draft not found." };

  const { error: updateError } = await supabase
    .from("content_drafts")
    .update({
      title,
      pillar,
      hook,
      caption,
      hashtags,
      status,
    })
    .eq("id", draftId);
  if (updateError) return { error: updateError.message };

  // Replace slides atomically: delete + insert.
  // (Creatives reference slide_id ON DELETE CASCADE — safe; creatives aren't
  // live yet. We'll refine this to sync-by-id once the creative editor lands.)
  await supabase.from("slides").delete().eq("draft_id", draftId);
  if (slides.length > 0) {
    const inserts = slides.map((s, index) => ({
      draft_id: draftId,
      position: index + 1,
      headline: s.headline,
      body: s.body,
    }));
    const { error: insertError } = await supabase.from("slides").insert(inserts);
    if (insertError) return { error: insertError.message };
  }

  revalidatePath(`/${locale}/content-engine`);
  if (draft.transcript_id) {
    revalidatePath(
      `/${locale}/content-engine/transcripts/${draft.transcript_id}`,
    );
    redirect(
      localePath(locale, `/content-engine/transcripts/${draft.transcript_id}`),
    );
  }
  redirect(localePath(locale, "/content-engine"));
}
