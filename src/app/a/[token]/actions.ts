"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { notifyUser } from "@/lib/notifications";
import { checkRateLimit } from "@/lib/rate-limit";
import { cleanText } from "@/lib/sanitize";

function admin() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

async function persistResponse(
  token: string,
  decision: "approve" | "reject",
  comment: string | null,
): Promise<void> {
  const supabase = admin();

  const { data: approval } = await supabase
    .from("approvals")
    .select("id, draft_id, approved_at, rejected_at, expires_at")
    .eq("token", token)
    .maybeSingle();
  if (!approval) return;

  // Already answered or expired → no-op
  if (approval.approved_at || approval.rejected_at) return;
  if (
    approval.expires_at &&
    new Date(approval.expires_at).getTime() < Date.now()
  ) {
    return;
  }

  const patch: Record<string, unknown> =
    decision === "approve"
      ? { approved_at: new Date().toISOString() }
      : { rejected_at: new Date().toISOString() };
  if (comment) patch.client_comment = comment;

  await supabase.from("approvals").update(patch).eq("id", approval.id);

  // Notify the draft's creator (or the owner if no creator recorded)
  const { data: draft } = await supabase
    .from("content_drafts")
    .select("id, client_id, tenant_id, title, created_by")
    .eq("id", approval.draft_id)
    .maybeSingle();
  if (!draft) return;

  // If a creator_by is set, notify them; otherwise notify any owner.
  let targets: string[] = [];
  if (draft.created_by) targets = [draft.created_by];
  else {
    const { data: owners } = await supabase
      .from("profiles")
      .select("id")
      .eq("role", "owner");
    targets = (owners ?? []).map((o) => o.id);
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
  if (!approvalRateLimitOk(token)) return;

  await persistResponse(token, "approve", comment);

  revalidatePath(`/a/${token}`);
  redirect(`/a/${token}?thanks=1&locale=${locale}`);
}

export async function rejectViaTokenAction(formData: FormData): Promise<void> {
  const token = (formData.get("token") ?? "").toString();
  const comment = parseComment(formData.get("comment"));
  const locale = (formData.get("locale") ?? "pt-BR").toString();
  if (!token) return;
  if (!approvalRateLimitOk(token)) return;

  await persistResponse(token, "reject", comment);

  revalidatePath(`/a/${token}`);
  redirect(`/a/${token}?thanks=1&locale=${locale}`);
}
