"use server";

import { revalidatePath } from "next/cache";

import { log } from "@/lib/log";
import { redirect } from "next/navigation";
import type { Route } from "next";
import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import { currentTenantId } from "@/lib/tenant-server";
import { generate } from "@/lib/claude";
import {
  buildReportSystem,
  buildReportUser,
  MonthlyReportParseError,
  monthBounds,
  monthLabel,
  parseReportPayload,
  type ReportCounts,
  type ReportDraftHighlight,
  type ReportInput,
} from "@/lib/monthly-report";

function localePath(locale: string, path: string): Route {
  return (locale === "pt-BR" ? path : `/${locale}${path}`) as Route;
}

export async function generateMonthlyReportAction(
  formData: FormData,
): Promise<void> {
  const clientId = (formData.get("clientId") ?? "").toString();
  const slug = (formData.get("slug") ?? "").toString();
  const locale = (formData.get("locale") ?? "pt-BR").toString();
  const yearRaw = (formData.get("year") ?? "").toString();
  const monthRaw = (formData.get("month") ?? "").toString();

  if (!clientId) return;

  const now = new Date();
  const year = Number.parseInt(yearRaw, 10) || now.getFullYear();
  const month = Number.parseInt(monthRaw, 10) || now.getMonth() + 1;
  if (month < 1 || month > 12) return;

  const supabase = await createSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: client } = await supabase
    .from("clients")
    .select("id, name, industry")
    .eq("id", clientId)
    .maybeSingle();
  if (!client) return;

  const bounds = monthBounds(year, month);

  const [draftsRes, tasksDoneRes, tasksOpenRes, meetingsRes, approvalsRes, publishedRes] =
    await Promise.all([
      supabase
        .from("content_drafts")
        .select("id, title, pillar, status, created_at")
        .eq("client_id", clientId)
        .gte("created_at", bounds.startISO)
        .lt("created_at", bounds.endISO)
        .order("created_at", { ascending: false }),
      supabase
        .from("tasks")
        .select("id", { count: "exact", head: true })
        .eq("client_id", clientId)
        .eq("status", "done")
        .gte("completed_at", bounds.startISO)
        .lt("completed_at", bounds.endISO),
      supabase
        .from("tasks")
        .select("id", { count: "exact", head: true })
        .eq("client_id", clientId)
        .neq("status", "done")
        .eq("is_template", false),
      supabase
        .from("meetings")
        .select("id", { count: "exact", head: true })
        .eq("client_id", clientId)
        .gte("starts_at", bounds.startISO)
        .lt("starts_at", bounds.endISO)
        .eq("status", "completed"),
      supabase
        .from("approvals")
        .select(
          "id, approved_at, rejected_at, created_at, draft:content_drafts!inner(client_id)",
        )
        .gte("created_at", bounds.startISO)
        .lt("created_at", bounds.endISO),
      supabase
        .from("published_posts")
        .select(
          "id, published_at, draft:content_drafts!inner(client_id)",
        )
        .gte("published_at", bounds.startISO)
        .lt("published_at", bounds.endISO),
    ]);

  type DraftRow = {
    id: string;
    title: string;
    pillar: string | null;
    status: string;
    created_at: string;
  };
  const draftRows = (draftsRes.data ?? []) as DraftRow[];

  // Filter approvals/published by client_id since the joins return all rows
  // matched by `created_at` regardless of who the draft belongs to.
  type ApprovalJoin = {
    id: string;
    approved_at: string | null;
    rejected_at: string | null;
    created_at: string;
    draft:
      | { client_id: string }
      | Array<{ client_id: string }>
      | null;
  };
  const pickOne = <T,>(v: T | T[] | null): T | null =>
    !v ? null : Array.isArray(v) ? v[0] ?? null : v;
  const approvals = ((approvalsRes.data ?? []) as unknown as ApprovalJoin[]).filter(
    (a) => pickOne(a.draft)?.client_id === clientId,
  );

  type PublishedJoin = {
    id: string;
    published_at: string;
    draft: { client_id: string } | Array<{ client_id: string }> | null;
  };
  const publishedPosts = ((publishedRes.data ?? []) as unknown as PublishedJoin[]).filter(
    (p) => pickOne(p.draft)?.client_id === clientId,
  );

  const pillarMap = new Map<string, number>();
  for (const d of draftRows) {
    if (!d.pillar) continue;
    pillarMap.set(d.pillar, (pillarMap.get(d.pillar) ?? 0) + 1);
  }
  const pillars = Array.from(pillarMap.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  const counts: ReportCounts = {
    draftsCreated: draftRows.length,
    draftsApproved: draftRows.filter(
      (d) => d.status === "approved" || d.status === "scheduled" || d.status === "published",
    ).length,
    postsPublished: publishedPosts.length,
    tasksCompleted: tasksDoneRes.count ?? 0,
    tasksOpen: tasksOpenRes.count ?? 0,
    meetingsHeld: meetingsRes.count ?? 0,
    approvalsSent: approvals.length,
    approvalsApproved: approvals.filter((a) => !!a.approved_at).length,
    approvalsRejected: approvals.filter((a) => !!a.rejected_at).length,
  };

  const topDrafts: ReportDraftHighlight[] = draftRows.slice(0, 10).map((d) => ({
    title: d.title,
    pillar: d.pillar,
    status: d.status,
  }));

  const input: ReportInput = {
    clientName: client.name,
    clientIndustry: client.industry,
    period: {
      year,
      month,
      label: monthLabel(year, month, locale),
    },
    counts,
    topDrafts,
    pillars,
  };

  const systemText = buildReportSystem(locale);
  const userText = buildReportUser(input, locale);

  let result;
  try {
    result = await generate({
      kind: "refine", // opus for the reflective tone
      system: [{ type: "text", text: systemText }],
      messages: [{ role: "user", content: userText }],
      maxTokens: 4_000,
    });
  } catch (err) {
    log.error("reports.monthly", "claude_failed", { err });
    return;
  }

  let payload;
  try {
    payload = parseReportPayload(result.text);
  } catch (err) {
    const msg =
      err instanceof MonthlyReportParseError ? err.message : "parse failed";
    log.error("reports.monthly", "parse_failed", {
      reason: msg,
      stopReason: result.stopReason,
      textLength: result.text.length,
    });
    return;
  }

  const content = {
    ...payload,
    input: {
      counts,
      pillars,
      topDrafts,
    },
    generatedAt: new Date().toISOString(),
  };

  const tenantId = await currentTenantId();
  const { data: upserted } = await supabase
    .from("monthly_reports")
    .upsert(
      {
        tenant_id: tenantId,
        client_id: clientId,
        year,
        month,
        generated_by: user?.id ?? null,
        content,
        model: "claude-opus-4-7",
      },
      { onConflict: "client_id,year,month" },
    )
    .select("id")
    .single();

  if (slug) revalidatePath(`/${locale}/clients/${slug}`);
  if (upserted?.id) {
    redirect(localePath(locale, `/reports/${upserted.id}`));
  }
  redirect(localePath(locale, `/clients/${slug}`));
}
