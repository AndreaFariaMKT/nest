import { notFound } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";
import { monthLabel } from "@/lib/monthly-report";

type Report = Database["public"]["Tables"]["monthly_reports"]["Row"];

type ReportContent = {
  summary: string;
  highlights: string[];
  lessons: string[];
  nextPillars: string[];
  input?: {
    counts: Record<string, number>;
    pillars: Array<{ name: string; count: number }>;
    topDrafts: Array<{ title: string; pillar: string | null; status: string }>;
  };
  generatedAt?: string;
};

export default async function ReportDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("reports");

  const supabase = await createClient();
  const { data } = await supabase
    .from("monthly_reports")
    .select("*, client:clients(name, slug)")
    .eq("id", id)
    .maybeSingle();
  if (!data) notFound();

  type JoinedReport = Report & {
    client:
      | { name: string; slug: string }
      | Array<{ name: string; slug: string }>
      | null;
  };
  const report = data as unknown as JoinedReport;
  const client = Array.isArray(report.client)
    ? report.client[0] ?? null
    : report.client;

  const content = (report.content ?? {}) as ReportContent;
  const label = monthLabel(report.year, report.month, locale);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-8">
        {client ? (
          <Link
            href={`/clients/${client.slug}`}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← {client.name}
          </Link>
        ) : null}
        <h1 className="mt-2 font-display text-4xl text-foreground">
          {t("monthlyTitle", { period: label })}
        </h1>
        <p className="mt-1 text-xs text-muted-foreground">
          {t("generatedAt", {
            when: new Intl.DateTimeFormat(locale, {
              dateStyle: "medium",
              timeStyle: "short",
            }).format(new Date(report.generated_at)),
          })}
          {report.model ? ` · ${report.model}` : ""}
        </p>
      </div>

      {content.input?.counts ? (
        <section className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-4">
          {Object.entries(content.input.counts).map(([key, value]) => (
            <div
              key={key}
              className="rounded-lg border border-border bg-card p-3 text-sm"
            >
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {t(`counts.${key}`, { default: key })}
              </div>
              <div className="mt-0.5 font-display text-xl">{value}</div>
            </div>
          ))}
        </section>
      ) : null}

      <section className="mb-8 rounded-lg border border-border bg-card p-5">
        <h2 className="mb-2 font-display text-xl">{t("sections.summary")}</h2>
        <p className="text-sm leading-relaxed">{content.summary}</p>
      </section>

      {content.highlights?.length > 0 ? (
        <section className="mb-8 rounded-lg border border-border bg-card p-5">
          <h2 className="mb-2 font-display text-xl">
            {t("sections.highlights")}
          </h2>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {content.highlights.map((h, i) => (
              <li key={i}>{h}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {content.lessons?.length > 0 ? (
        <section className="mb-8 rounded-lg border border-border bg-card p-5">
          <h2 className="mb-2 font-display text-xl">{t("sections.lessons")}</h2>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {content.lessons.map((l, i) => (
              <li key={i}>{l}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {content.nextPillars?.length > 0 ? (
        <section className="mb-8 rounded-lg border border-border bg-card p-5">
          <h2 className="mb-2 font-display text-xl">
            {t("sections.nextPillars")}
          </h2>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {content.nextPillars.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
