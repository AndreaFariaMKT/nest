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

import type { Database } from "@/types/database.gen";
import { dbError, type PgLikeError } from "@/lib/db-error";
import { log } from "@/lib/log";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/auth";
import { currentTenantId } from "@/lib/tenant-server";
import { getCurrentRole } from "@/lib/roles-server";
import { encryptSecret, decryptSecret, secretsAvailable } from "@/lib/secrets";
import { APP_ROLES } from "@/lib/roles";
type DraftUpdate = Database["public"]["Tables"]["content_drafts"]["Update"];
type LoginRow = Database["public"]["Tables"]["shared_logins"]["Insert"];
type AccountRow =
  Database["public"]["Tables"]["client_social_accounts"]["Insert"];

import {
  actionAllowedForRole,
  publishInstant,
  PULL_LEAD_WORKING_DAYS,
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
  type BlockedReason,
  SOCIAL_CHANNELS,
  SOCIAL_SCREENS,
  type DesignState,
  type SocialAction,
  type SocialStage,
} from "@/lib/social";
import { POST_TYPES } from "@/types/database";
import { listSocialClients } from "./_data";

/**
 * `error` is always an i18n key under `social.blocked` — either a
 * `BlockedReason` the domain models, or one of the six `DbError` keys a
 * database failure maps to. Never a Postgres message: those name tables and
 * columns, and portal clients read these refusals.
 */
export type Result = { ok: boolean; error?: BlockedReason | (string & {}) };

const OK: Result = { ok: true };
const fail = (error: BlockedReason | (string & {})): Result => ({
  ok: false,
  error,
});

/**
 * PostgREST answers an UPDATE that matched no row with `{ error: null }`, so a
 * write blocked by RLS looks exactly like a write that worked. `content_drafts:
 * write` is `has_client_access()` — owner, or a `client_members` row — which
 * tenant membership alone does NOT satisfy. Without this check a staff login
 * outside `client_members` clicks "Approve the text", watches the page refresh,
 * and nothing has moved. That is the silent "no" this file's header is against.
 */
function wrote(
  result: { data: unknown[] | null; error: PgLikeError | null },
  area = "social.write",
): Result {
  if (result.error) {
    // The code, never the message: a `value too long` echoes part of the value,
    // and a unique violation echoes the conflicting one.
    log.error(area, "write_failed", { code: result.error.code ?? "unknown" });
    return fail(dbError(result.error));
  }
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
    // Derived, so adding a screen does not silently leave it stale.
    ...SOCIAL_SCREENS.map((s) => s.href),
    "/portal/content",
    "/portal/media",
    "/portal/logins",
    "/content-calendar",
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
      "id, client_id, status, design_state, caption, material_url, publish_on, publish_time, client_comment, title",
    )
    .eq("tenant_id", tenantId)
    .eq("id", id)
    .maybeSingle();
  return data;
}

/**
 * Whether the calling portal login owns this client.
 *
 * Reads the `portal_client` view, not the `clients` table. Migration 031 moved
 * the portal off the table — a row-level grant is a whole-row grant, and that
 * row carries the studio's private notes and the portal bearer token — and
 * this function was reading the table with the CALLER's client. After 031 a
 * portal login had no SELECT path to `clients` at all, so this returned null
 * for every client including their own, and every client decision failed with
 * `notYours`. It failed closed, so nothing leaked; the whole approval loop
 * simply stopped, silently.
 *
 * Expressed as ownership rather than as "give me the owner's id" because that
 * is the question both callers actually ask, and because the view answers it
 * by construction: it only ever contains the caller's own, non-archived client.
 */
async function callerOwnsClient(clientId: string): Promise<boolean> {
  const { supabase } = await ctx();
  const { data } = await supabase
    .from("portal_client")
    .select("id")
    .eq("id", clientId)
    .maybeSingle();
  return !!data;
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
    // The generated types model `channels` as the enum array, but the values
    // arrive as strings from the form; they are filtered against
    // SOCIAL_CHANNELS above, so the cast asserts what the filter guarantees.
    channels: (channels.length ? channels : ["instagram"]) as never,
    backlog_added_on: todayIso(),
    created_by: user?.id ?? null,
  });
  if (error) {
    log.error("social.write", "write_failed", { code: error.code ?? "unknown" });
    return fail(dbError(error));
  }

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

  const { supabase, tenantId, role, user } = await ctx();
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
    if (!user || !(await callerOwnsClient(piece.client_id))) {
      return fail("notYours");
    }
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
  const patch: DraftUpdate = { status: verdict.next };

  switch (action) {
    case "pull":
      // A theme leaves the shelf WITH a slot. Without one it never reaches the
      // calendar, can never be overdue, and the client is asked to approve a
      // post with no date — so the default lives here, not only in the form.
      patch.publish_on =
        optional(formData, "publish_on") ?? addWorkingDays(todayIso(), PULL_LEAD_WORKING_DAYS);
      patch.design_state = "todo";
      patch.return_reason = null;
      break;
    case "send_text_up":
      patch.sent_up_at = now;
      // Clearing the approval, not just flagging it. `direction_ok` used to
      // carry this and nothing read it, while `approved_internal_at` — which
      // the production screen DOES show — was left holding the date of an
      // approval that no longer applies. A piece sent back up after a
      // rejection would have displayed "text approved" beside its old date.
      patch.approved_internal_at = null;
      break;
    case "direction_approve":
      patch.approved_internal_at = now;
      patch.design_state = "todo";
      break;
    case "direction_reject":
      patch.approved_internal_at = null;
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
      // The date, not just the words. A refusal had text and no timestamp, so
      // the monthly report could only infer it from the piece's current stage
      // — which reports a piece refused in August and approved in September as
      // approved only, losing exactly the round trip the report exists to show.
      patch.client_rejected_at = now;
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
      patch.approved_internal_at = null;
      patch.sent_up_at = null;
      patch.client_comment = null;
      // Back on the shelf as an unworked theme: the dates of the run that
      // ended belong to that run, not to the next one.
      patch.client_rejected_at = null;
      patch.client_approved_at = null;
      patch.sent_to_client_at = null;
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

  // Entering the order is the one transition that can hand the piece to a
  // machine. Whether it actually does depends on the piece having artwork —
  // see enqueueForPublish, which stays silent for the manual path.
  if (action === "queue") {
    await enqueueForPublish(supabase, tenantId, [id]);
  }
  // Leaving `scheduled` means the piece is no longer going out on its own.
  // A queued row left behind would publish something the studio just pulled
  // back — the one mistake in this module that cannot be undone.
  //
  // `mark_live` belongs here and was missing, which is the same mistake in its
  // worst form. The cron selects on `scheduled_posts.status = 'pending'` alone
  // and never reads the draft's stage, and it runs once a day at 08:10. So a
  // piece scheduled for the afternoon, published by hand that afternoon and
  // marked live, still had a pending row the next morning — and the cron
  // posted it a second time, to the client's real account.
  if (
    action === "mark_live" ||
    action === "unmark_live" ||
    action === "return_to_backlog"
  ) {
    await supabase
      .from("scheduled_posts")
      .delete()
      .eq("draft_id", id)
      .in("status", ["pending", "failed"]);
  }

  // No notification here on purpose. The client hears once a day, from
  // /api/cron/social-digest — four hand-offs on a Tuesday used to mean four
  // pings, and the one that mattered got lost among them.

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
  const { supabase, tenantId, role } = await ctx();

  const piece = await loadPiece(id);
  if (!piece) return fail("notFound");

  const patch: DraftUpdate = {};

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

  // A scheduled piece carries a queued row holding the instant it publishes
  // at, and that row is written ONLY by enqueueForPublish. Moving the date
  // here used to change every screen — the calendar, the publishing order, the
  // client's own portal — and leave the queue pointing at the old day, so the
  // cron published on a date nobody could still see.
  //
  // There was no way back, either: canRun("queue") accepts only `approved`,
  // and buildOrderAction selects only `approved`, so nothing could re-enter
  // the order for a piece already `scheduled`.
  // Both halves compare. `publish_time` used to be tested with `in patch`
  // alone — because loadPiece did not select the column, so there was nothing
  // to compare against — and the coordination panel always submits it. So
  // EVERY save of that panel counted as a date change: editing an internal
  // note on a piece whose publish had already failed deleted the failed row
  // (with its last_error, the only record of what went wrong) and re-armed the
  // cron on an instant now in the past.
  const instantMoved =
    ("publish_on" in patch && patch.publish_on !== piece.publish_on) ||
    ("publish_time" in patch && patch.publish_time !== piece.publish_time);
  if (piece.status === "scheduled" && instantMoved) {
    await enqueueForPublish(supabase, tenantId, [id]);
  }

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
    // Social pieces only. `status` carries two state machines — migration 026
    // added `engine` for exactly this — and without the filter a batch reaches
    // into the content engine's drafts, which share these status values.
    .eq("engine", "social")
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
  if (error) {
    log.error("social.write", "write_failed", { code: error.code ?? "unknown" });
    return fail(dbError(error));
  }

  // Likewise silent: the daily digest tells each client what arrived.

  revalidateModule(locale);
  return OK;
}

/**
 * Build the publishing order: every approved piece becomes a scheduled one, so
 * publishing gets a single list with the approved text already on it.
 */

/**
 * Put a piece in the real publishing queue — but only if it can actually be
 * published without a person.
 *
 * This is what makes "both paths" work. A piece with artwork attached gets
 * `scheduled_posts` rows and the cron sends it; a piece without gets nothing
 * here, keeps its `scheduled` stage, and is published by hand exactly as
 * before. Neither one is an error, so this never fails the caller: entering
 * the order is a decision about the pipeline, and whether the machine can
 * finish the job is a separate fact about the piece.
 *
 * One row per channel, because `scheduled_posts` is per platform and a piece
 * can run on more than one.
 */
async function enqueueForPublish(
  supabase: Awaited<ReturnType<typeof ctx>>["supabase"],
  tenantId: string,
  pieceIds: string[],
): Promise<void> {
  if (!pieceIds.length) return;

  const { data: rows, error: readError } = await supabase
    .from("content_drafts")
    .select("id, channels, post_type, publish_on, publish_time, slides(id)")
    .in("id", pieceIds);

  // Bail before touching the queue if we could not read the pieces.
  //
  // This error used to be discarded, which was harmless while the clear came
  // after the "nothing to queue" return. Moving the clear ahead of it — so a
  // piece that lost its artwork does not keep a live row — made a failed read
  // indistinguishable from "none of these should publish": the existing rows
  // were deleted and nothing was inserted. The piece stays `scheduled`, every
  // screen says it is going out, and nothing ever sends it. There is no way
  // back through the UI either, because only `approved` pieces can re-enter
  // the order.
  if (readError) {
    log.error("social.enqueue", "read_failed", {
      code: readError.code ?? "unknown",
    });
    return;
  }

  type Row = {
    id: string;
    channels: Database["public"]["Enums"]["platform"][] | null;
    post_type: Database["public"]["Enums"]["post_type"] | null;
    publish_on: string | null;
    publish_time: string | null;
    slides: { id: string }[] | null;
  };

  const queued: Database["public"]["Tables"]["scheduled_posts"]["Insert"][] = [];
  for (const r of (rows ?? []) as unknown as Row[]) {
    // No artwork → the manual path. Nothing to queue.
    if (!r.slides?.length) continue;
    const scheduledFor = publishInstant(r.publish_on, r.publish_time);
    // No date → nothing to schedule FOR. The stage still moved; a human will
    // give it a date, and re-entering the order will queue it then.
    if (!scheduledFor) continue;

    for (const platform of r.channels ?? []) {
      queued.push({
        draft_id: r.id,
        tenant_id: tenantId,
        platform,
        post_type: r.post_type ?? "carousel",
        scheduled_for: scheduledFor,
        status: "pending",
      });
    }
  }
  // Clear BEFORE deciding there is nothing to queue, not after. A piece that
  // has become ineligible — artwork removed, date cleared — produces no rows
  // to insert, and returning early left its old instant queued: the cron would
  // publish artwork the studio had just taken away.
  //
  // Clear first: re-entering the order after a date change must not leave the
  // old instant queued alongside the new one, which would publish twice.
  //
  // `failed` goes too, not just `pending`. A row the cron gave up on was
  // terminal — nothing in the app ever deleted or reset one — so it sat in
  // /scheduling forever, and kept the publishing screen painting the piece
  // red long after a successful re-queue. Re-entering the order IS the retry
  // gesture; the attempt it replaces is history, not a live warning.
  await supabase
    .from("scheduled_posts")
    .delete()
    .in("draft_id", pieceIds)
    .in("status", ["pending", "failed"]);

  if (!queued.length) return;

  const { error } = await supabase.from("scheduled_posts").insert(queued);
  if (error) {
    // Logged, not returned. The stage change already succeeded and is the
    // thing the person asked for; a queue that did not take is recoverable by
    // re-entering the order, and the piece still shows as manual until it is.
    log.error("social.enqueue", "queue_insert_failed", { code: error.code });
  }
}

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
    // Social pieces only — see releaseSignedOffAction. This one is the sharper
    // of the two: everything it selects is queued for publication, so a
    // content-engine draft that happened to be `approved` would be posted to
    // the client's real account.
    .eq("engine", "social")
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
  if (error) {
    log.error("social.write", "write_failed", { code: error.code ?? "unknown" });
    return fail(dbError(error));
  }

  await enqueueForPublish(supabase, tenantId, approved.map((p) => p.id));

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
  // `client_id` is only ever set on creation: an update that carried it could
  // move someone else's material under a different client.
  const { client_id, ...editable } = row;

  // Required on the insert only. The edit form disables the client select
  // because the value is ignored on an update — and a disabled control submits
  // nothing, so this check, sitting above the branch, refused every edit with
  // "choose a client" beside a select that was visibly filled in.
  if (!id && !client_id) return fail("needsClient");
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

  // Required on the insert only — see saveMediaAction. The edit form disables
  // the client select because the value is ignored on an update, and a
  // disabled control submits nothing, so this refused every edit.
  if (!id && !clientId) return fail("needsClient");
  if (!platform || !username) return fail("needsAccountAndUser");

  const row: LoginRow = {
    client_id: clientId,
    platform,
    site: optional(formData, "site"),
    username,
    holder: str(formData, "holder") || "client",
    mfa: optional(formData, "mfa"),
    // Only touched when the form actually submitted the field. FormData.getAll
    // returns [] for an absent key, so writing it unconditionally would let a
    // crafted POST blank the list — which the reveal gate reads as "everyone".
    //
    // Unchecked boxes submit nothing, so a form that ticked none looks exactly
    // like a crafted POST. The edit form sends an empty sentinel under the
    // same name, which the role filter drops — so "I unticked them all" and "I
    // never sent the field" are finally different things. Without it,
    // untick-the-last-box reported success and left the role holding the
    // password.
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
            // access_roles is spread in conditionally above, which widens the
            // object past what the generated Insert type accepts.
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
    if (!(await callerOwnsClient(data.client_id))) {
      return { ok: false, error: "notYours" };
    }
  }

  if (!data.secret_enc) return { ok: false, error: "noPassword" };
  const secret = decryptSecret(data.secret_enc);
  if (!secret) return { ok: false, error: "secretUnreadable" };
  return { ok: true, secret };
}


// ───────────────────────────────────────────────────────────────────────────
// Publishing accounts
//
// Distinct from shared logins on purpose. A shared login is a REGISTER of who
// holds a client's password; these are machine credentials the platform uses
// to act AS the client on a network. Conflating them would mean one access
// rule governing both "who may see a password" and "what may post publicly".
// ───────────────────────────────────────────────────────────────────────────

const PLATFORMS = ["instagram", "linkedin", "tiktok"] as const;
type PlatformValue = (typeof PLATFORMS)[number];

function isPlatform(v: string): v is PlatformValue {
  return (PLATFORMS as readonly string[]).includes(v);
}

export async function saveSocialAccountAction(
  _prev: Result,
  formData: FormData,
): Promise<Result> {
  const { supabase, tenantId, role, user } = await ctx();
  // coordinate only. Publishing as a client is the highest-consequence thing
  // this module can do — the result is public and cannot be taken back — so it
  // is not delegated the way design or scheduling are.
  if (!hasCap(role, "coordinate")) return fail("notYours");

  const id = optional(formData, "id");
  const clientId = str(formData, "client_id");
  const rawPlatform = str(formData, "platform");
  const secret = str(formData, "secret");
  const locale = str(formData, "locale") || "pt-BR";

  if (!clientId) return fail("needsClient");
  if (!isPlatform(rawPlatform)) return fail("needsPlatform");

  const accountRef = optional(formData, "account_ref");
  // Instagram authors as a business account id and LinkedIn as an organization
  // URN; without one there is nothing to post to. TikTok's token identifies the
  // account by itself, so requiring a reference there would be inventing a
  // field to keep the form symmetrical.
  if (rawPlatform !== "tiktok" && !accountRef) return fail("needsAccountRef");

  const row: AccountRow = {
    client_id: clientId,
    tenant_id: tenantId,
    platform: rawPlatform,
    account_ref: accountRef,
    api_version: optional(formData, "api_version"),
    publish_mode: str(formData, "publish_mode") === "direct" ? "direct" : "inbox",
    // A checkbox that is off submits nothing, so absence means off. Read from
    // the field rather than left alone on edit: turning publishing OFF must be
    // possible through the same form that turned it on.
    enabled: formData.get("enabled") === "on",
    note: optional(formData, "note"),
    rotated_on: optional(formData, "rotated_on"),
    created_by: user?.id ?? null,
  };

  // Blank on an edit means "keep the stored token". Blank on a create means the
  // account is registered but not yet usable — a real onboarding state, and the
  // reason `enabled` is a separate switch rather than derived from the token.
  if (secret) {
    if (!secretsAvailable()) return fail("noSecretKey");
    row.secret_enc = encryptSecret(secret);
  } else if (!id) {
    row.secret_enc = null;
  }

  // Refuse to switch on an account that has nothing to publish with, rather
  // than letting the cron discover it every five minutes.
  if (row.enabled && !secret) {
    const { data: existing } = await supabase
      .from("client_social_accounts")
      .select("secret_enc")
      .eq("id", id ?? "")
      .maybeSingle();
    if (!existing?.secret_enc) return fail("needsToken");
  }

  // `platform` is dropped alongside the identity columns: it is half of the
  // `unique (client_id, platform)` key, and a blank secret on an edit means
  // "keep the stored token". Editing an Instagram row into a LinkedIn one
  // would leave a Meta token in a row resolveAccount hands to LinkedIn as a
  // Bearer — the exact credential/network mispairing this table exists to
  // make impossible. Changing the network means a new row.
  const { client_id, tenant_id, created_by, platform, ...editable } = row;
  const written = id
    ? wrote(
        await supabase
          .from("client_social_accounts")
          .update(editable)
          .eq("id", id)
          .eq("tenant_id", tenantId)
          .select("id"),
        "social.account",
      )
    : wrote(
        await supabase
          .from("client_social_accounts")
          .insert(row)
          .select("id"),
        "social.account",
      );
  if (!written.ok) return written;

  revalidateModule(locale);
  return { ok: true };
}

export async function deleteSocialAccountAction(
  formData: FormData,
): Promise<Result> {
  const { supabase, tenantId, role } = await ctx();
  if (!hasCap(role, "coordinate")) return fail("notYours");

  const id = str(formData, "id");
  const locale = str(formData, "locale") || "pt-BR";
  if (!id) return fail("notFound");

  const written = wrote(
    await supabase
      .from("client_social_accounts")
      .delete()
      .eq("id", id)
      .eq("tenant_id", tenantId)
      .select("id"),
    "social.account",
  );
  if (!written.ok) return written;

  revalidateModule(locale);
  return { ok: true };
}


// ───────────────────────────────────────────────────────────────────────────
// Artwork · the files that make a piece publishable
//
// The folder link (`material_url`) is where the work LIVES: versions, open
// files, the way the designer organises it. That stays exactly as it is.
//
// These are something else — the final images, in order, hosted somewhere
// Instagram's API can fetch them, because it can only build a post from URLs
// it can open. A Drive folder is not one of those.
//
// Attaching is optional, per piece, and that is what gives the studio both
// paths at once: a piece with artwork can go into the real publishing queue,
// and a piece without behaves exactly as it does today — someone posts it by
// hand and marks it live.
// ───────────────────────────────────────────────────────────────────────────

const ARTWORK_MIMES = ["image/png", "image/jpeg"];
/** Matches the bucket's own file_size_limit, so a refusal is ours and legible. */
const ARTWORK_MAX_BYTES = 10 * 1024 * 1024;
/** Instagram's carousel ceiling. Past this the API refuses the whole post. */
const ARTWORK_MAX_FILES = 10;

export async function attachArtworkAction(
  _prev: Result,
  formData: FormData,
): Promise<Result> {
  const { supabase, tenantId, role } = await ctx();
  // Design attaches it; coordination can too, because coordination is who
  // finalises a piece and is often the one holding the exported files.
  if (!hasCap(role, "design") && !hasCap(role, "coordinate")) {
    return fail("notYours");
  }

  const id = str(formData, "id");
  const locale = str(formData, "locale") || "pt-BR";
  if (!id) return fail("notFound");

  const piece = await loadPiece(id);
  if (!piece) return fail("notFound");

  const files = formData
    .getAll("artwork")
    .filter((f): f is File => f instanceof File && f.size > 0);
  if (!files.length) return fail("needsArtworkFiles");
  if (files.length > ARTWORK_MAX_FILES) return fail("tooManyArtworkFiles");
  for (const f of files) {
    if (!ARTWORK_MIMES.includes(f.type)) return fail("artworkWrongType");
    if (f.size > ARTWORK_MAX_BYTES) return fail("artworkTooLarge");
  }

  // Replace, not append. A designer re-uploading is delivering the final set,
  // not adding to a pile — and a half-replaced carousel would publish in an
  // order nobody chose. Old storage objects go too: nothing in the database
  // references storage.objects, so a row delete alone would leave the images
  // sitting in a public bucket forever.
  const cleared = await clearArtwork(supabase, id);
  if (!cleared.ok) return cleared;

  // Bulk, not one-at-a-time.
  //
  // This used to insert a slide, await, upload, await, insert a creative,
  // await — per file. Ten images meant thirty sequential round trips plus ten
  // strictly serial uploads of up to 10 MB each: the worst wall-clock path in
  // the module by a wide margin, on a Brazilian upstream link.
  const { data: slides, error: slideError } = await supabase
    .from("slides")
    .insert(
      files.map((_, i) => ({
        draft_id: id,
        tenant_id: tenantId,
        position: i + 1,
        data: {},
      })),
    )
    .select("id, position");
  if (slideError || !slides || slides.length !== files.length) {
    log.error("social.artwork", "slide_insert_failed", {
      code: slideError?.code ?? "unknown",
    });
    await clearArtwork(supabase, id);
    return fail(slideError ? dbError(slideError) : "artworkUploadFailed");
  }

  const ordered = [...slides].sort((a, b) => a.position - b.position);

  // Uploaded in small batches rather than all at once: ten 10 MB files held in
  // a function's memory together is how a 1 GB limit becomes an OOM.
  const BATCH = 3;
  const creatives: Database["public"]["Tables"]["creatives"]["Insert"][] = [];
  for (let i = 0; i < files.length; i += BATCH) {
    const slice = files.slice(i, i + BATCH);
    const results = await Promise.all(
      slice.map(async (file, k) => {
        const slide = ordered[i + k];
        const ext = file.type === "image/jpeg" ? "jpg" : "png";
        const path = `${id}/${slide.id}-v1.${ext}`;
        const { error } = await supabase.storage
          .from("creatives")
          .upload(path, file, { contentType: file.type, upsert: true });
        if (error) return { ok: false as const, message: error.message };
        const { data: urlData } = supabase.storage
          .from("creatives")
          .getPublicUrl(path);
        return {
          ok: true as const,
          row: {
            slide_id: slide.id,
            draft_id: id,
            tenant_id: tenantId,
            version: 1,
            image_url: urlData.publicUrl,
          },
        };
      }),
    );
    for (const r of results) {
      if (!r.ok) {
        // All or nothing, and this is not optional. A partial set would leave
        // slide rows with fewer creatives than images, so the piece reads as
        // "will publish on its own" and the cron posts an incomplete carousel
        // — worse than the upload simply having failed.
        log.error("social.artwork", "upload_failed", { message: r.message });
        await clearArtwork(supabase, id);
        return fail("artworkUploadFailed");
      }
      creatives.push(r.row);
    }
  }

  const { error: creativeError } = await supabase
    .from("creatives")
    .insert(creatives);
  if (creativeError) {
    log.error("social.artwork", "creative_insert_failed", {
      code: creativeError.code,
    });
    await clearArtwork(supabase, id);
    return fail(dbError(creativeError));
  }

  revalidateModule(locale);
  return { ok: true };
}

export async function removeArtworkAction(
  formData: FormData,
): Promise<Result> {
  const { supabase, role } = await ctx();
  if (!hasCap(role, "design") && !hasCap(role, "coordinate")) {
    return fail("notYours");
  }
  const id = str(formData, "id");
  const locale = str(formData, "locale") || "pt-BR";
  if (!id) return fail("notFound");
  if (!(await loadPiece(id))) return fail("notFound");

  const cleared = await clearArtwork(supabase, id);
  if (!cleared.ok) return cleared;

  revalidateModule(locale);
  return { ok: true };
}

/** Drop a piece's slides, creatives and the files behind them. */
async function clearArtwork(
  supabase: Awaited<ReturnType<typeof ctx>>["supabase"],
  draftId: string,
): Promise<Result> {
  // The bucket first: once the rows are gone there is nothing left that knows
  // which files belonged to this piece.
  const { data: existing } = await supabase.storage
    .from("creatives")
    .list(draftId);
  const paths = (existing ?? []).map((o) => `${draftId}/${o.name}`);
  if (paths.length) {
    const { error } = await supabase.storage.from("creatives").remove(paths);
    if (error) {
      log.error("social.artwork", "remove_failed", { message: error.message });
      return fail("artworkUploadFailed");
    }
  }

  // creatives cascade from slides, so one delete is enough.
  const { error } = await supabase.from("slides").delete().eq("draft_id", draftId);
  if (error) {
    log.error("social.artwork", "slides_delete_failed", { code: error.code });
    return fail(dbError(error));
  }
  return { ok: true };
}
