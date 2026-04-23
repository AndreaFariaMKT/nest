import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  buildReportHtml,
  renderReportToPdf,
  type ReportPdfInput,
} from "@/lib/report-pdf";
import { monthLabel } from "@/lib/monthly-report";
import { log } from "@/lib/log";

export const dynamic = "force-dynamic";

/**
 * Render a monthly report as a PDF attachment. Auth: session-based; any
 * role with `has_client_access` on the report's client can download.
 *
 * Returns 404 (not 403) when the report isn't visible, to avoid leaking
 * which report ids exist across clients.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!id) return NextResponse.json({ error: "missing_id" }, { status: 400 });

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("monthly_reports")
    .select("id, year, month, content, generated_at, client:clients(name)")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  type Joined = {
    id: string;
    year: number;
    month: number;
    content: Record<string, unknown>;
    generated_at: string;
    client: { name: string } | Array<{ name: string }> | null;
  };
  const report = data as unknown as Joined;
  const client = Array.isArray(report.client)
    ? report.client[0] ?? null
    : report.client;
  const content = (report.content ?? {}) as {
    summary?: string;
    highlights?: string[];
    lessons?: string[];
    nextPillars?: string[];
    input?: {
      counts?: Record<string, number>;
    };
  };

  // Infer locale from Accept-Language; default pt-BR.
  const accept = _request.headers.get("accept-language") ?? "pt-BR";
  const locale = accept.toLowerCase().startsWith("en") ? "en" : "pt-BR";

  const counts: Array<{ label: string; value: string }> = [];
  if (content.input?.counts) {
    for (const [k, v] of Object.entries(content.input.counts)) {
      counts.push({
        label: humanizeCountKey(k, locale),
        value: new Intl.NumberFormat(locale).format(v),
      });
    }
  }

  const pdfInput: ReportPdfInput = {
    clientName: client?.name ?? "—",
    periodLabel: monthLabel(report.year, report.month, locale),
    generatedAtLabel: new Intl.DateTimeFormat(locale, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(report.generated_at)),
    summary: content.summary ?? "—",
    highlights: content.highlights ?? [],
    lessons: content.lessons ?? [],
    nextPillars: content.nextPillars ?? [],
    counts,
  };

  const html = buildReportHtml(pdfInput);

  let pdf: Buffer;
  try {
    pdf = await renderReportToPdf(html);
  } catch (err) {
    log.error("reports.pdf", "render failed", {
      id,
      err: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: "render_failed" },
      { status: 500 },
    );
  }

  log.info("reports.pdf", "rendered", {
    id,
    clientName: pdfInput.clientName,
    bytes: pdf.length,
  });

  const safeName = (client?.name ?? "report")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const filename = `${safeName}-${report.year}-${String(report.month).padStart(2, "0")}.pdf`;

  return new NextResponse(new Uint8Array(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

const COUNT_LABELS: Record<string, { "pt-BR": string; en: string }> = {
  draftsCreated: { "pt-BR": "Drafts criados", en: "Drafts created" },
  draftsApproved: { "pt-BR": "Drafts aprovados", en: "Drafts approved" },
  postsPublished: { "pt-BR": "Posts publicados", en: "Posts published" },
  tasksCompleted: { "pt-BR": "Tarefas concluídas", en: "Tasks completed" },
  tasksOpen: { "pt-BR": "Tarefas abertas", en: "Tasks open" },
  meetingsHeld: { "pt-BR": "Reuniões", en: "Meetings" },
  approvalsSent: { "pt-BR": "Aprovações enviadas", en: "Approvals sent" },
  approvalsApproved: { "pt-BR": "Cliente aprovou", en: "Client approved" },
  approvalsRejected: { "pt-BR": "Mudanças pedidas", en: "Changes requested" },
};

function humanizeCountKey(key: string, locale: string): string {
  const entry = COUNT_LABELS[key];
  if (!entry) return key;
  return locale.startsWith("pt") ? entry["pt-BR"] : entry.en;
}
