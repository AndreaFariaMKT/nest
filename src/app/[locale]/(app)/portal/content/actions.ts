"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPortalClient, isPortalPreview } from "@/lib/client-portal";
import { notifyUser } from "@/lib/notifications";
import { checkRateLimit } from "@/lib/rate-limit";
import { cleanText } from "@/lib/sanitize";
import { canRespond } from "@/lib/portal-approval";
import type { TablesInsert } from "@/types/database";
import { log } from "@/lib/log";

export type RespondState = { ok: boolean; error?: string };

/**
 * The row a portal answer writes — `approvals` as migration 044 leaves it.
 * Declared here rather than taken from the generated types because those are
 * produced from the live schema and lag the migration until `types:gen` runs.
 */
type PortalApprovalInsert = {
  draft_id: string;
  token: null;
  source: "portal";
  client_comment: string | null;
  approved_at: string | null;
  rejected_at: string | null;
};

/**
 * A signed-in client answering a content-engine draft.
 *
 * Until now their only way in was the mailed /a/<token> link: one bearer
 * credential, 14 days, one draft. A client who lost the mail, or whose link
 * had expired, had no way to answer at all — while being signed into a portal
 * that showed them everything except the button.
 *
 * Two clients, deliberately:
 *
 * - the draft is read with the CALLER's credentials, so "is this mine" is
 *   answered by the same RLS predicate every other portal screen runs on,
 *   rather than by this file remembering to check;
 * - the approval is written with the service role, because `approvals` carries
 *   only an owner policy — the table's public path has always been "handled at
 *   app layer (service role)", and RLS cannot express "may set exactly these
 *   three columns" anyway.
 *
 * `canRespond` is the gate, and it is tested away from this file.
 */
export async function respondToDraftAction(
  _prev: RespondState,
  formData: FormData,
): Promise<RespondState> {
  const draftId = (formData.get("draftId") ?? "").toString();
  const decision = (formData.get("decision") ?? "").toString();
  const locale = (formData.get("locale") ?? "pt-BR").toString();
  const comment = cleanText((formData.get("comment") ?? "").toString(), {
    maxLength: 2000,
  });

  const [client, preview] = await Promise.all([
    getPortalClient(),
    isPortalPreview(),
  ]);

  // Per client, not per draft: the thing worth throttling is one login
  // hammering the endpoint, and a bug that retries would otherwise just move
  // to the next draft.
  if (client) {
    const rl = checkRateLimit({
      key: `portal-approval:${client.id}`,
      limit: 20,
      windowMs: 60_000,
    });
    if (!rl.allowed) return { ok: false, error: "rateLimited" };
  }

  const supabase = await createClient();

  // RLS-scoped. Another client's draft comes back as null here, which is the
  // same shape a deleted one has — and `canRespond` refuses both identically,
  // so the refusal never confirms which draft ids exist.
  const { data: draftRow } = draftId
    ? await supabase
        .from("content_drafts")
        .select("id, engine, status, client_id, tenant_id, title, created_by")
        .eq("id", draftId)
        .maybeSingle()
    : { data: null };

  const draft = draftRow as {
    id: string;
    engine: string;
    status: string;
    client_id: string | null;
    tenant_id: string;
    title: string;
    created_by: string | null;
  } | null;

  const admin = createAdminClient();

  // "Already answered" is a property of the approvals table, which the caller
  // cannot read — so it is fetched with the service role and handed to the
  // rules rather than checked inside them.
  let answered = false;
  if (draft) {
    const { data: prior } = await admin
      .from("approvals")
      .select("id")
      .eq("draft_id", draft.id)
      .or("approved_at.not.is.null,rejected_at.not.is.null")
      .limit(1)
      .maybeSingle();
    answered = !!prior;
  }

  const verdict = canRespond({
    decision,
    comment,
    preview,
    draft: draft
      ? { engine: draft.engine, status: draft.status, client_id: draft.client_id }
      : null,
    clientId: client?.id ?? null,
    answered,
  });
  if (!verdict.ok) return { ok: false, error: verdict.reason };
  if (!draft) return { ok: false, error: "notFound" };

  const now = new Date().toISOString();
  const row: PortalApprovalInsert = {
    draft_id: draft.id,
    // No token. Migration 044 made the column nullable precisely so a portal
    // answer does not have to mint a live 14-day link nobody sent.
    token: null,
    source: "portal",
    client_comment: verdict.comment,
    approved_at: verdict.decision === "approve" ? now : null,
    rejected_at: verdict.decision === "approve" ? null : now,
  };

  // One cast, here, and it is temporary. `database.gen.ts` is generated from
  // the live schema, so it still describes `approvals` as migration 044 found
  // it: `token` non-null, no `source`. Running `npm run types:gen` once 044 is
  // applied regenerates both and this cast can go. The shape above is checked
  // against `PortalApprovalInsert` rather than being an `any` — the cast
  // crosses the client boundary, it does not switch the type checking off.
  const { error } = await admin
    .from("approvals")
    .insert(row as unknown as TablesInsert<"approvals">);
  if (error) {
    // Never the error object — a unique violation echoes the conflicting
    // value, and on this table that value is a bearer token.
    log.error("portal.approval", "insert_failed", {
      code: error.code ?? "unknown",
    });
    return { ok: false, error: "failed" };
  }

  // Same recipients the mailed link notifies: the draft's creator, or the
  // tenant's founders when none was recorded.
  let targets: string[] = [];
  if (draft.created_by) targets = [draft.created_by];
  else {
    const { data: founders } = await admin
      .from("tenant_members")
      .select("user_id")
      .eq("tenant_id", draft.tenant_id)
      .eq("role", "founder");
    targets = (founders ?? []).map((o) => o.user_id);
  }
  const verb = verdict.decision === "approve" ? "aprovou" : "pediu ajustes em";
  for (const userId of targets) {
    await notifyUser({
      userId,
      tenantId: draft.tenant_id,
      type: "approval.response",
      title: `Cliente ${verb} "${draft.title}"`,
      body: verdict.comment,
      link: `/content-engine/drafts/${draft.id}/edit`,
    });
  }

  revalidatePath(`/${locale}/portal/content`);
  revalidatePath(`/${locale}/feedback`);
  return { ok: true };
}
