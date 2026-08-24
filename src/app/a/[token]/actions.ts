"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database.gen";
import { redirect } from "next/navigation";
import { notifyUser } from "@/lib/notifications";
import { checkRateLimit } from "@/lib/rate-limit";
import { cleanText } from "@/lib/sanitize";
import { log } from "@/lib/log";

function admin() {
  return createAdminClient();
}

/**
 * What actually happened, so the page can say it.
 *
 * Every one of these used to `return` into a `Promise<void>` and land on the
 * same "Done — your response was recorded" screen. A client whose link had
 * expired, or who clicked twice, or whose write failed, was told the studio
 * had their answer when it did not. This is the one screen an outsider
 * touches, and it was the one screen that could lie.
 */
export type ApprovalOutcome =
  | "recorded"
  | "alreadyAnswered"
  | "expired"
  | "notFound"
  | "failed";

async function persistResponse(
  token: string,
  decision: "approve" | "reject",
  comment: string | null,
): Promise<ApprovalOutcome> {
  const supabase = admin();

  const { data: approval } = await supabase
    .from("approvals")
    .select("id, draft_id, approved_at, rejected_at, expires_at")
    .eq("token", token)
    .maybeSingle();
  if (!approval) return "notFound";

  if (approval.approved_at || approval.rejected_at) return "alreadyAnswered";
  if (
    approval.expires_at &&
    new Date(approval.expires_at).getTime() < Date.now()
  ) {
    return "expired";
  }

  const patch: Database["public"]["Tables"]["approvals"]["Update"] =
    decision === "approve"
      ? { approved_at: new Date().toISOString() }
      : { rejected_at: new Date().toISOString() };
  if (comment) patch.client_comment = comment;

  const { error } = await supabase
    .from("approvals")
    .update(patch)
    .eq("id", approval.id);
  // The write is the whole point. Its error was discarded.
  if (error) {
    log.error("approval.token", "write_failed", { code: error.code ?? "unknown" });
    return "failed";
  }

  // Notify the draft's creator (or the owner if no creator recorded)
  const { data: draft } = await supabase
    .from("content_drafts")
    .select("id, client_id, tenant_id, title, created_by")
    .eq("id", approval.draft_id)
    .maybeSingle();
  // The answer is recorded either way; failing to find the draft only costs
  // the notification.
  if (!draft) return "recorded";

  // If a creator is set, notify them; otherwise the tenant's founders.
  let targets: string[] = [];
  if (draft.created_by) targets = [draft.created_by];
  else {
    // Was `profiles.role = 'owner'` — a legacy enum nothing in this app ever
    // sets, so on the no-creator path nobody was notified at all, even when
    // the client had answered. The live role lives in tenant_members.
    const { data: founders } = await supabase
      .from("tenant_members")
      .select("user_id")
      .eq("tenant_id", draft.tenant_id)
      .eq("role", "founder");
    targets = (founders ?? []).map((o) => o.user_id);
  }
  const verb = decision === "approve" ? "aprovou" : "pediu ajustes em";
  for (const userId of targets) {
    await notifyUser({
      userId,
      // No session here — this runs off a bearer token — so the tenant comes
      // from the draft being approved, not from the caller.
      tenantId: draft.tenant_id,
      type: "approval.response",
      title: `Cliente ${verb} "${draft.title}"`,
      body: comment ?? null,
      link: `/content-engine/drafts/${draft.id}/edit`,
    });
  }

  return "recorded";
}

// Throttle per-token. A legitimate client clicks approve or reject once;
// anything beyond 10/min for the same token is either a bug or abuse.
function approvalRateLimitOk(token: string): boolean {
  const rl = checkRateLimit({
    key: `approval:${token}`,
    limit: 10,
    windowMs: 60_000,
  });
  return rl.allowed;
}

function parseComment(raw: FormDataEntryValue | null): string | null {
  const cleaned = cleanText((raw ?? "").toString(), { maxLength: 2000 });
  return cleaned.length > 0 ? cleaned : null;
}

export async function approveViaTokenAction(formData: FormData): Promise<void> {
  const token = (formData.get("token") ?? "").toString();
  const comment = parseComment(formData.get("comment"));
  const locale = (formData.get("locale") ?? "pt-BR").toString();
  if (!token) return;
  // Throttled: tell them to slow down rather than showing a thank-you for a
  // click that was never processed.
  if (!approvalRateLimitOk(token)) {
    redirect(`/a/${token}?done=failed&locale=${locale}`);
  }

  const outcome = await persistResponse(token, "approve", comment);

  revalidatePath(`/a/${token}`);
  redirect(`/a/${token}?done=${outcome}&locale=${locale}`);
}

export async function rejectViaTokenAction(formData: FormData): Promise<void> {
  const token = (formData.get("token") ?? "").toString();
  const comment = parseComment(formData.get("comment"));
  const locale = (formData.get("locale") ?? "pt-BR").toString();
  if (!token) return;
  // Throttled: tell them to slow down rather than showing a thank-you for a
  // click that was never processed.
  if (!approvalRateLimitOk(token)) {
    redirect(`/a/${token}?done=failed&locale=${locale}`);
  }

  const outcome = await persistResponse(token, "reject", comment);

  revalidatePath(`/a/${token}`);
  redirect(`/a/${token}?done=${outcome}&locale=${locale}`);
}
