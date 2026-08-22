"use server";

/**
 * Every write the social media module makes.
 *
 * Two rules hold everywhere:
 *   1. The role must hold the capability for the action (src/lib/social.ts).
 *   2. The piece must be in a stage the action can leave from — and refusals
 *      say WHY, because a queue stalls on silent "no".
 *
 * Return shape is always `{ ok, error? }` where `error` is an i18n key under
 * `social.blocked.*`, so callers can render a real sentence in either locale.
 */

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/auth";
import { currentTenantId } from "@/lib/tenant-server";
import { getCurrentRole } from "@/lib/roles-server";
import { notifyUser } from "@/lib/notifications";
import { encryptSecret, decryptSecret, secretsAvailable } from "@/lib/secrets";
import { APP_ROLES } from "@/lib/roles";
import {
  actionAllowedForRole,
  addWorkingDays,
  canRun,
  canSetDesignState,
  hasCap,
  isSocialStage,
  todayIso,
  CONTENT_ORIGINS,
  DESIGN_STATES,
  SOCIAL_ACTIONS,
  SOCIAL_CAPS,
  SOCIAL_CHANNELS,
  type DesignState,
  type SocialAction,
  type SocialStage,
} from "@/lib/social";
import { POST_TYPES } from "@/types/database";
import { listSocialClients } from "./_data";

export type Result = { ok: boolean; error?: string };

const OK: Result = { ok: true };
const fail = (error: string): Result => ({ ok: false, error });

/**
 * PostgREST answers an UPDATE that matched no row with `{ error: null }`, so a
 * write blocked by RLS looks exactly like a write that worked. `content_drafts:
 * write` is `has_client_access()` — owner, or a `client_members` row — which
 * tenant membership alone does NOT satisfy. Without this check a staff login
 * outside `client_members` clicks "Approve the text", watches the page refresh,
 * and nothing has moved. That is the silent "no" this file's header is against.
 */
function wrote(
  result: { data: unknown[] | null; error: { message: string } | null },
): Result {
  if (result.error) return fail(result.error.message);
  if (!result.data || result.data.length === 0) return fail("writeBlocked");
  return OK;
}

// ───────────────────────────────────────────────────────────────────────────
// Shared plumbing
// ───────────────────────────────────────────────────────────────────────────

function str(fd: FormData, key: string): string {
  return (fd.get(key) ?? "").toString().trim();
}

function optional(fd: FormData, key: string): string | null {
  const v = str(fd, key);
  return v.length ? v : null;
}

/**
 * Revalidate the whole module — every screen shows some slice of the same set,
 * so one move stales all of them.
 *
 * Both the locale-prefixed path and the bare one are cleared: `localePrefix:
 * "as-needed"` serves pt-BR at `/social` while the route is `/pt-BR/social`,
 * and missing either leaves a screen showing yesterday's fortnight.
 */
function revalidateModule(locale: string): void {
  for (const path of [
    "/social",
    "/social/waiting",
    "/social/backlog",
    "/social/fortnight",
    "/social/production",
    "/social/publishing",
    "/social/calendar",
    "/social/media",
    "/social/logins",
    "/portal/content",
    "/portal/media",
    "/portal/logins",
    "/content-calendar",
    "/production-queue",
    "/scheduling",
  ]) {
    revalidatePath(`/${locale}${path}`);
    revalidatePath(path);
  }
}

async function ctx() {
  const [supabase, tenantId, role, user] = await Promise.all([
    createClient(),
    currentTenantId(),
    getCurrentRole(),
    getSessionUser(),
  ]);
  return { supabase, tenantId, role, user };
}

/** Load a piece, scoped to the tenant. Null means "not yours / not there". */
async function loadPiece(id: string) {
  const { supabase, tenantId } = await ctx();
  const { data } = await supabase
    .from("content_drafts")
    .select(
      "id, client_id, status, design_state, caption, material_url, publish_on, client_comment, title",
    )
    .eq("tenant_id", tenantId)
    .eq("id", id)
    .maybeSingle();
  return data;
}

/** The portal login behind a client, so a hand-off can actually reach someone. */
async function portalUserFor(clientId: string): Promise<string | null> {
  const { supabase } = await ctx();
  const { data } = await supabase
    .from("clients")
    .select("portal_user_id")
    .eq("id", clientId)
    .maybeSingle();
  return data?.portal_user_id ?? null;
}

// ───────────────────────────────────────────────────────────────────────────
// Backlog · add a theme to the shelf
// ───────────────────────────────────────────────────────────────────────────

export async function createThemeAction(
  _prev: Result,
  formData: FormData,
): Promise<Result> {
  const { supabase, tenantId, role, user } = await ctx();
  if (!hasCap(role, "coordinate")) return fail("notYours");

  const title = str(formData, "title");
  const whyNow = str(formData, "why_now");
  const clientId = str(formData, "client_id");
  if (!clientId) return fail("needsClient");
  if (title.length < 3) return fail("needsTitle");
  // The one field that survives all the way to the client — a theme without it
  // is a line in a spreadsheet, not a reason to publish.
  if (!whyNow) return fail("needsWhyNow");

  const rawOrigin = str(formData, "origin");
  const rawType = str(formData, "post_type");
  const slideCount = Number.parseInt(str(formData, "slide_count"), 10);
  const channels = formData
    .getAll("channels")
    .map((c) => c.toString())
    .filter((c) => (SOCIAL_CHANNELS as readonly string[]).includes(c));

  const { error } = await supabase.from("content_drafts").insert({
    tenant_id: tenantId,
    client_id: clientId,
    title,
    status: "backlog" as SocialStage,
    pillar: optional(formData, "pillar"),
    why_now: whyNow,
    window_note: optional(formData, "window_note"),
    source_ref: optional(formData, "source_ref"),
    origin: (CONTENT_ORIGINS as readonly string[]).includes(rawOrigin)
      ? (rawOrigin as (typeof CONTENT_ORIGINS)[number])
      : null,
    post_type: (POST_TYPES as string[]).includes(rawType)
      ? (rawType as (typeof POST_TYPES)[number])
      : null,
    slide_count: Number.isFinite(slideCount) ? slideCount : null,
    channels: (channels.length ? channels : ["instagram"]) as never,
    backlog_added_on: todayIso(),
    created_by: user?.id ?? null,
  });
  if (error) return fail(error.message);

  revalidateModule(str(formData, "locale") || "pt-BR");
  return OK;
}

// ───────────────────────────────────────────────────────────────────────────
// The state machine
// ───────────────────────────────────────────────────────────────────────────

/**
 * One entry point for every stage change. The form carries the action name so
 * a screen can offer three buttons without three round-trips of glue code.
 */
export async function runTransitionAction(
  _prev: Result,
  formData: FormData,
): Promise<Result> {
  const raw = str(formData, "action");
  if (!(SOCIAL_ACTIONS as readonly string[]).includes(raw)) {
    return fail("unknownAction");
  }
  const action = raw as SocialAction;
  const id = str(formData, "id");
  const comment = str(formData, "comment");
  const locale = str(formData, "locale") || "pt-BR";

  const { supabase, role, user } = await ctx();
  if (!actionAllowedForRole(action, role)) return fail("notYours");

  const piece = await loadPiece(id);
  if (!piece) return fail("notFound");
  if (!isSocialStage(piece.status)) return fail("notFound");

  // A client may only ever act on its own pieces. The check is here rather than
  // in RLS because a client has no UPDATE policy on content_drafts at all
  // (migration 021) — its decision is written with the service role below, so
  // the columns and values it can move stay inside this function.
  const asClient = hasCap(role, "client") && !hasCap(role, "coordinate");
  if (asClient) {
    const owner = await portalUserFor(piece.client_id);
    if (!user || owner !== user.id) return fail("notYours");
  }

  const verdict = canRun(
    action,
    {
      status: piece.status,
      design_state: (piece.design_state ?? "todo") as DesignState,
      caption: piece.caption,
      material_url: piece.material_url,
      publish_on: piece.publish_on,
    },
    { comment, today: todayIso() },
  );
  if (!verdict.ok) return fail(verdict.reason);

  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { status: verdict.next };

  switch (action) {
    case "pull":
      // A theme leaves the shelf WITH a slot. Without one it never reaches the
      // calendar, can never be overdue, and the client is asked to approve a
      // post with no date — so the default lives here, not only in the form.
      patch.publish_on =
        optional(formData, "publish_on") ?? addWorkingDays(todayIso(), 10);
      patch.design_state = "todo";
      patch.return_reason = null;
      break;
    case "send_text_up":
      patch.sent_up_at = now;
      patch.direction_ok = false;
      break;
    case "direction_approve":
      patch.direction_ok = true;
      patch.approved_internal_at = now;
      patch.design_state = "todo";
      break;
    case "direction_reject":
      patch.direction_ok = false;
      patch.design_feedback = comment;
      break;
    case "send_to_client":
      patch.sent_to_client_at = now;
      break;
    case "client_approve":
      patch.client_approved_at = now;
      if (comment) patch.client_comment = comment;
      break;
    case "approve_on_silence":
      // Not the client's approval — the rule's. Left unset so a report can tell
      // "they said yes" from "the reply date passed".
      patch.client_approved_at = null;
      break;
    case "client_request_changes":
    case "client_reject":
      patch.client_comment = comment;
      break;
    case "reopen_to_design":
      // Back to design with the note attached — the art exists, it needs work.
      patch.design_state = "done";
      break;
    case "return_to_backlog":
      // The comment box is optional here, so fall back to what the client
      // actually said rather than writing the literal string "rejected" over it.
      patch.return_reason = comment || piece.client_comment || piece.status;
      patch.design_state = "todo";
      patch.material_url = null;
      patch.publish_on = null;
      patch.direction_ok = false;
      patch.client_comment = null;
      break;
    case "mark_live":
      patch.published_at = now;
      break;
    case "unmark_live":
      patch.published_at = null;
      break;
    default:
      break;
  }

  const writer = asClient ? createAdminClient() : supabase;
  const written = wrote(
    await writer.from("content_drafts").update(patch).eq("id", id).select("id"),
  );
  if (!written.ok) return written;

  // Hand-offs that leave the studio get a notification; the rest do not, so the
  // bell stays worth looking at.
  if (action === "send_to_client") {
    const owner = await portalUserFor(piece.client_id);
    if (owner) {
      await notifyUser({
        userId: owner,
        type: "social_review",
        title: piece.title,
        body: null,
        link: "/portal/content",
      });
    }
  }

  revalidateModule(locale);
  revalidatePath(`/${locale}/social/pieces/${id}`);
  return OK;
}

/** Design marks its own progress; coordination signs it off. */
export async function setDesignStateAction(
  _prev: Result,
  formData: FormData,
): Promise<Result> {
  const id = str(formData, "id");
  const next = str(formData, "design_state") as DesignState;
  const locale = str(formData, "locale") || "pt-BR";
  if (!(DESIGN_STATES as readonly string[]).includes(next)) {
    return fail("unknownAction");
  }

  const { supabase, role } = await ctx();
  if (!actionAllowedForRole("set_design_state", role)) return fail("notYours");
  // Signing off is coordination's call, not the drawer's.
  if (next === "signed_off" && !hasCap(role, "coordinate")) {
    return fail("signOffNotYours");
  }

  const piece = await loadPiece(id);
  if (!piece || !isSocialStage(piece.status)) return fail("notFound");

  const verdict = canSetDesignState(
    { status: piece.status, material_url: piece.material_url },
    next,
  );
  if (!verdict.ok) return fail(verdict.reason);

  const written = wrote(
    await supabase
      .from("content_drafts")
      .update({ design_state: next })
      .eq("id", id)
      .select("id"),
  );
  if (!written.ok) return written;

  revalidateModule(locale);
  revalidatePath(`/${locale}/social/pieces/${id}`);
  return OK;
}

/**
 * Field edits that do not move a piece: the text, the folder link, the internal
 * notes. Which fields are writable depends on the capability, so design cannot
 * quietly rewrite a caption direction already approved.
 */
export async function savePieceAction(
  _prev: Result,
  formData: FormData,
): Promise<Result> {
  const id = str(formData, "id");
  const locale = str(formData, "locale") || "pt-BR";
  const { supabase, role } = await ctx();

  const piece = await loadPiece(id);
  if (!piece) return fail("notFound");

  const patch: Record<string, unknown> = {};

  if (hasCap(role, "coordinate")) {
    if (formData.has("caption")) patch.caption = optional(formData, "caption");
    if (formData.has("why_now")) patch.why_now = optional(formData, "why_now");
    if (formData.has("note_design"))
      patch.note_design = optional(formData, "note_design");
    if (formData.has("note_publish"))
      patch.note_publish = optional(formData, "note_publish");
    if (formData.has("pillar")) patch.pillar = optional(formData, "pillar");
    if (formData.has("publish_on"))
      patch.publish_on = optional(formData, "publish_on");
    if (formData.has("publish_time"))
      patch.publish_time = optional(formData, "publish_time") ?? "08:00";
    if (formData.has("material_url"))
      patch.material_url = optional(formData, "material_url");
    if (formData.has("window_note"))
      patch.window_note = optional(formData, "window_note");
    if (formData.has("source_ref"))
      patch.source_ref = optional(formData, "source_ref");
  }

  if (hasCap(role, "design")) {
    // Design owns the folder link and its own notes back, nothing else.
    if (formData.has("material_url"))
      patch.material_url = optional(formData, "material_url");
    if (formData.has("design_feedback"))
      patch.design_feedback = optional(formData, "design_feedback");
  }

  if (!Object.keys(patch).length) return fail("nothingToSave");

  const written = wrote(
    await supabase.from("content_drafts").update(patch).eq("id", id).select("id"),
  );
  if (!written.ok) return written;

  revalidateModule(locale);
  revalidatePath(`/${locale}/social/pieces/${id}`);
  return OK;
}

// ───────────────────────────────────────────────────────────────────────────
// Batch moves
// ───────────────────────────────────────────────────────────────────────────

/**
 * Send every signed-off piece to its own client. Each goes alone — a client is
 * never handed the whole fortnight at once.
 */
export async function releaseSignedOffAction(
  _prev: Result,
  formData: FormData,
): Promise<Result> {
  const locale = str(formData, "locale") || "pt-BR";
  const clientId = optional(formData, "client_id");
  const { supabase, tenantId, role } = await ctx();
  if (!hasCap(role, "coordinate")) return fail("notYours");

  // Same client list the screens are filtered by, so a batch never touches a
  // client that was archived or had the module switched off.
  const eligible = (await listSocialClients()).map((c) => c.id);
  if (!eligible.length) return fail("nothingSignedOff");

  let query = supabase
    .from("content_drafts")
    .select("id, client_id, title")
    .eq("tenant_id", tenantId)
    .eq("status", "creative_review")
    .eq("design_state", "signed_off")
    .in("client_id", clientId ? [clientId] : eligible);

  const { data } = await query;
  const ready = data ?? [];
  if (!ready.length) return fail("nothingSignedOff");

  const { error } = await supabase
    .from("content_drafts")
    .update({
      status: "client_review" as SocialStage,
      sent_to_client_at: new Date().toISOString(),
    })
    .in(
      "id",
      ready.map((p) => p.id),
    );
  if (error) return fail(error.message);

  const owners = new Map<string, string>();
  for (const p of ready) {
    if (!owners.has(p.client_id)) {
      const owner = await portalUserFor(p.client_id);
      if (owner) owners.set(p.client_id, owner);
    }
    const owner = owners.get(p.client_id);
    if (owner) {
      await notifyUser({
        userId: owner,
        type: "social_review",
        title: p.title,
        link: "/portal/content",
      });
    }
  }

  revalidateModule(locale);
  return OK;
}

/**
 * Build the publishing order: every approved piece becomes a scheduled one, so
 * publishing gets a single list with the approved text already on it.
 */
export async function buildOrderAction(
  _prev: Result,
  formData: FormData,
): Promise<Result> {
  const locale = str(formData, "locale") || "pt-BR";
  const clientId = optional(formData, "client_id");
  const { supabase, tenantId, role } = await ctx();
  if (!actionAllowedForRole("queue", role)) return fail("notYours");

  const eligible = (await listSocialClients()).map((c) => c.id);
  if (!eligible.length) return fail("nothingApproved");

  const { data } = await supabase
    .from("content_drafts")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("status", "approved")
    .in("client_id", clientId ? [clientId] : eligible);
  const approved = data ?? [];
  if (!approved.length) return fail("nothingApproved");

  const { error } = await supabase
    .from("content_drafts")
    .update({ status: "scheduled" as SocialStage })
    .in(
      "id",
      approved.map((p) => p.id),
    );
  if (error) return fail(error.message);

  revalidateModule(locale);
  return OK;
}

// ───────────────────────────────────────────────────────────────────────────
// Media library
// ───────────────────────────────────────────────────────────────────────────

export async function saveMediaAction(
  _prev: Result,
  formData: FormData,
): Promise<Result> {
  const { supabase, tenantId, role, user } = await ctx();
  if (!hasCap(role, "coordinate") && !hasCap(role, "design")) {
    return fail("notYours");
  }

  const id = optional(formData, "id");
  const title = str(formData, "title");
  const url = str(formData, "url");
  const capturedOn = str(formData, "captured_on");
  const locale = str(formData, "locale") || "pt-BR";

  if (title.length < 2 || !url) return fail("needsTitleAndLink");
  // Material ages, and nothing in the file says when it was made.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(capturedOn)) return fail("needsCapturedOn");

  const row = {
    client_id: str(formData, "client_id"),
    title,
    url,
    access_note: optional(formData, "access_note"),
    description: optional(formData, "description"),
    captured_on: capturedOn,
  };
  if (!row.client_id) return fail("needsClient");

  // `client_id` is only ever set on creation: an update that carried it could
  // move someone else's material under a different client.
  const { client_id, ...editable } = row;
  const written = id
    ? wrote(
        await supabase
          .from("media_assets")
          .update(editable)
          .eq("id", id)
          .eq("tenant_id", tenantId)
          .select("id"),
      )
    : wrote(
        await supabase
          .from("media_assets")
          .insert({
            ...row,
            client_id,
            tenant_id: tenantId,
            created_by: user?.id ?? null,
          })
          .select("id"),
      );
  if (!written.ok) return written;

  revalidateModule(locale);
  return OK;
}

export async function deleteMediaAction(formData: FormData): Promise<Result> {
  const { supabase, role } = await ctx();
  if (!hasCap(role, "coordinate")) return fail("notYours");
  const id = str(formData, "id");
  if (!id) return fail("notFound");
  const { supabase: db, tenantId } = await ctx();
  const written = wrote(
    await db
      .from("media_assets")
      .delete()
      .eq("id", id)
      .eq("tenant_id", tenantId)
      .select("id"),
  );
  if (!written.ok) return written;
  revalidateModule(str(formData, "locale") || "pt-BR");
  return OK;
}

// ───────────────────────────────────────────────────────────────────────────
// Shared logins
// ───────────────────────────────────────────────────────────────────────────

export async function saveLoginAction(
  _prev: Result,
  formData: FormData,
): Promise<Result> {
  const { supabase, tenantId, role, user } = await ctx();
  if (!hasCap(role, "coordinate")) return fail("notYours");

  const id = optional(formData, "id");
  const platform = str(formData, "platform");
  const username = str(formData, "username");
  const secret = str(formData, "secret");
  const locale = str(formData, "locale") || "pt-BR";
  const clientId = str(formData, "client_id");

  if (!clientId) return fail("needsClient");
  if (!platform || !username) return fail("needsAccountAndUser");

  const row: Record<string, unknown> = {
    client_id: clientId,
    platform,
    site: optional(formData, "site"),
    username,
    holder: str(formData, "holder") || "client",
    mfa: optional(formData, "mfa"),
    // Only touched when the form actually submitted the field. FormData.getAll
    // returns [] for an absent key, so writing it unconditionally would let a
    // crafted POST blank the list — which the reveal gate reads as "everyone".
    ...(formData.has("access_roles")
      ? {
          access_roles: formData
            .getAll("access_roles")
            .map((r) => r.toString())
            .filter((r) => (APP_ROLES as readonly string[]).includes(r)),
        }
      : {}),
    note: optional(formData, "note"),
    rotated_on: optional(formData, "rotated_on"),
  };

  // Blank on an edit means "leave the stored secret alone"; blank on a create
  // means partner/delegated access, which has no password to hold.
  if (secret) {
    if (!secretsAvailable()) return fail("noSecretKey");
    row.secret_enc = encryptSecret(secret);
  } else if (!id) {
    row.secret_enc = null;
  }

  const { client_id, ...editable } = row;
  const written = id
    ? wrote(
        await supabase
          .from("shared_logins")
          .update(editable)
          .eq("id", id)
          .eq("tenant_id", tenantId)
          .select("id"),
      )
    : wrote(
        await supabase
          .from("shared_logins")
          .insert({
            ...row,
            client_id,
            tenant_id: tenantId,
            created_by: user?.id ?? null,
          } as never)
          .select("id"),
      );
  if (!written.ok) return written;

  revalidateModule(locale);
  return OK;
}

export async function deleteLoginAction(formData: FormData): Promise<Result> {
  const { supabase, role } = await ctx();
  if (!hasCap(role, "coordinate")) return fail("notYours");
  const id = str(formData, "id");
  if (!id) return fail("notFound");
  const { supabase: db, tenantId } = await ctx();
  const written = wrote(
    await db
      .from("shared_logins")
      .delete()
      .eq("id", id)
      .eq("tenant_id", tenantId)
      .select("id"),
  );
  if (!written.ok) return written;
  revalidateModule(str(formData, "locale") || "pt-BR");
  return OK;
}

/**
 * Hand back one password. The row's own access list decides who may see it —
 * being able to READ the record is not the same as being on the login.
 */
export async function revealSecretAction(
  id: string,
): Promise<{ ok: boolean; secret?: string; error?: string }> {
  const { supabase, tenantId, role, user } = await ctx();
  if (!user) return { ok: false, error: "notYours" };
  // Every other action in this file gates on a capability; this one used to be
  // the exception, and it is the one that hands back a password.
  if (!SOCIAL_CAPS.some((c) => hasCap(role, c))) {
    return { ok: false, error: "notYours" };
  }

  const { data } = await supabase
    .from("shared_logins")
    .select("secret_enc, access_roles, client_id")
    .eq("tenant_id", tenantId)
    .eq("id", id)
    .maybeSingle();
  if (!data) return { ok: false, error: "notFound" };

  // Fail closed. An empty list means nobody was named, not everybody — the
  // column defaults to empty and the form ships with no box ticked, so reading
  // it as "anyone" made every un-configured login world-readable.
  const onTheLogin =
    data.access_roles.includes(role) || hasCap(role, "coordinate");
  if (!onTheLogin) return { ok: false, error: "notOnLogin" };

  if (hasCap(role, "client") && !hasCap(role, "coordinate")) {
    const owner = await portalUserFor(data.client_id);
    if (owner !== user.id) return { ok: false, error: "notYours" };
  }

  if (!data.secret_enc) return { ok: false, error: "noPassword" };
  const secret = decryptSecret(data.secret_enc);
  if (!secret) return { ok: false, error: "secretUnreadable" };
  return { ok: true, secret };
}
