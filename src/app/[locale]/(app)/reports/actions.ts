"use server";

import { revalidatePath } from "next/cache";

import { log } from "@/lib/log";
import { todayIso } from "@/lib/social";
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
  // "2026-8", from the month picker. The two hidden year/month inputs it
  // replaced were pinned to today, so this could only ever report on the
  // running month.
  const periodRaw = (formData.get("period") ?? "").toString();

  if (!clientId) return;

  const [yearRaw, monthRaw] = periodRaw.split("-");
  const year = Number.parseInt(yearRaw ?? "", 10);
  const month = Number.parseInt(monthRaw ?? "", 10);

  // Refused, not defaulted. Falling back to "now" on an unreadable period is
  // how someone asks for August, waits for an Opus call, and is handed
  // September — with no indication that they got a different month.
  if (!Number.isFinite(year) || year < 2000 || year > 2100) {
    redirect(localePath(locale, `/clients/${slug}?report=badPeriod`));
  }
  if (!Number.isFinite(month) || month < 1 || month > 12) {
    redirect(localePath(locale, `/clients/${slug}?report=badPeriod`));
  }

  // A month that has not ended yet is a number that will change. The studio
  // writes this report between the 3rd and the 7th, about the month before.
  const [nowYear, nowMonth] = todayIso()
    .split("-")
    .map((n) => Number.parseInt(n, 10));
  if (year > nowYear || (year === nowYear && month >= nowMonth)) {
    redirect(localePath(locale, `/clients/${slug}?report=notClosed`));
  }

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

  const [
    draftsRes,
    tasksDoneRes,
    tasksOpenRes,
    meetingsRes,
    approvalsRes,
    publishedRes,
    socialRes,
  ] = await Promise.all([
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
      // From content_drafts, not published_posts.
      //
      // `published_posts` gets a row only from the publish cron and the
      // Instagram route. Marking a piece live BY HAND — which is how every
      // piece goes out today, since the Meta connection is not active — writes
      // `published_at` on the draft and no row there at all. So this counted
      // zero, and the prompt in monthly-report.ts instructs Claude to "say so
      // honestly if the input shows 0 published posts". The recap sent to the
      // client's own CEO asserted that nothing was published in a month of
      // work — while /social/report, counting from the drafts, showed the true
      // number for the same month.
      supabase
        .from("content_drafts")
        .select("id, published_at, client_id")
        .eq("engine", "social")
        .eq("status", "published")
        .gte("published_at", bounds.startISO)
        .lt("published_at", bounds.endISO),
      // The social module's own approvals. It does not write to `approvals` —
      // it records the answer on the piece — so every count below was zero for
      // the module the studio actually runs on.
      supabase
        .from("content_drafts")
        .select("id, sent_to_client_at, client_approved_at, client_rejected_at")
        .eq("client_id", clientId)
        .eq("engine", "social")
        // Values quoted: the bounds are ISO timestamps and PostgREST splits a
        // filter on dots, which these are full of.
        .or(
          `and(sent_to_client_at.gte."${bounds.startISO}",sent_to_client_at.lt."${bounds.endISO}"),` +
            `and(client_approved_at.gte."${bounds.startISO}",client_approved_at.lt."${bounds.endISO}"),` +
            `and(client_rejected_at.gte."${bounds.startISO}",client_rejected_at.lt."${bounds.endISO}")`,
        ),
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

  // Filtered in SQL now, so the shape is flat and this is a straight count.
  const publishedPosts = (publishedRes.data ?? []).filter(
    (p) => p.client_id === clientId,
  );

  // Counted per column, not per row: one piece can be sent, refused and
  // approved inside the same month, and the report is about the round trip.
  type SocialDecision = {
    sent_to_client_at: string | null;
    client_approved_at: string | null;
    client_rejected_at: string | null;
  };
  const inMonth = (v: string | null) =>
    !!v && v >= bounds.startISO && v < bounds.endISO;
  const socialDecisions = (socialRes.data ?? []) as SocialDecision[];
  const socialSent = socialDecisions.filter((p) =>
    inMonth(p.sent_to_client_at),
  ).length;
  const socialApproved = socialDecisions.filter((p) =>
    inMonth(p.client_approved_at),
  ).length;
  const socialRejected = socialDecisions.filter((p) =>
    inMonth(p.client_rejected_at),
  ).length;

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
    approvalsSent: approvals.length + socialSent,
    approvalsApproved:
      approvals.filter((a) => !!a.approved_at).length + socialApproved,
    approvalsRejected:
      approvals.filter((a) => !!a.rejected_at).length + socialRejected,
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
    // "Generate monthly report" is one click behind an Opus call. Failing it
    // silently sent the owner back to a page that looked exactly the same,
    // with no way to tell whether it had worked.
    redirect(localePath(locale, `/clients/${slug}?report=failed`));
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
    // "Generate monthly report" is one click behind an Opus call. Failing it
    // silently sent the owner back to a page that looked exactly the same,
    // with no way to tell whether it had worked.
    redirect(localePath(locale, `/clients/${slug}?report=failed`));
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
