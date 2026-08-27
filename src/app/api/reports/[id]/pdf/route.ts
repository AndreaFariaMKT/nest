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
export const runtime = "nodejs";
// Chromium cold-start + render needs more than the default budget.
export const maxDuration = 60;

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

  // Everything below this point launches Chromium, which is why this route
  // asks for a 60-second budget. The bytes it produces are a pure function of
  // the stored snapshot: `content` is written once when the report is
  // generated, so the same id and the same `generated_at` render the same PDF
  // every time. Downloading the same report twice paid for two browsers.
  //
  // The validator carries `generated_at` and the locale, so regenerating a
  // report — or opening it in the other language — misses, as it should.
  // `private` keeps it in the one browser that authenticated for it and out of
  // any shared cache; this is one client's numbers.
  const etag = `W/"${report.id}-${report.generated_at}-${locale}"`;
  const cacheHeaders = {
    ETag: etag,
    "Cache-Control": "private, max-age=300, must-revalidate",
  };
  if (_request.headers.get("if-none-match") === etag) {
    return new NextResponse(null, { status: 304, headers: cacheHeaders });
  }

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
      ...cacheHeaders,
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
