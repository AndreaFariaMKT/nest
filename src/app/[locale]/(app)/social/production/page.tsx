import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import type { Route } from "next";

import { PageHeader } from "@/components/ui/PageHeader";
import { Pill } from "@/components/ui/Pill";
import { dayOf, DESIGN_STATES, formatLabel, type DesignState } from "@/lib/social";
import { loadScope } from "../_data";
import { ModuleShell } from "../_components/ModuleShell";

export const dynamic = "force-dynamic";

export default async function ProductionPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("social");
  const scope = await loadScope(searchParams);
  const isDesign = scope.caps.includes("design") && !scope.caps.includes("coordinate");
  const name = (id: string) =>
    scope.clients.find((c) => c.id === id)?.name ?? "—";

  const queue = scope.pieces.filter((p) => p.status === "creative_review");
  const open = queue.filter((p) => p.design_state !== "signed_off").length;

  return (
    <>
      <PageHeader
        title={t(isDesign ? "production.titleDesign" : "production.title")}
        subtitle={t(isDesign ? "production.subtitleDesign" : "production.subtitle")}
      />
      <ModuleShell scope={scope} />

      <div className="mb-4 flex justify-end">
        <Pill tone={open ? "warning" : "success"}>
          {t("production.open", { n: open })}
        </Pill>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        {(DESIGN_STATES as readonly DesignState[]).map((state) => {
          const items = queue.filter((p) => p.design_state === state);
          return (
            <section
              key={state}
              className="min-h-[220px] rounded-2xl bg-muted/50 p-3"
            >
              <header className="mb-3 flex items-center justify-between px-1 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                <span>{t(`designState.${state}`)}</span>
                <span>{items.length}</span>
              </header>

              <div className="space-y-2">
                {items.map((p) => (
                  <Link
                    key={p.id}
                    href={`/social/pieces/${p.id}` as Route}
                    className="block rounded-xl border border-border bg-card p-3 transition-colors hover:border-brand"
                  >
                    <p className="text-sm leading-snug text-foreground">
                      {p.title}
                    </p>
                    <p className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                      <Pill tone="muted" className="text-[10px]">
                        {name(p.client_id)}
                      </Pill>
                      <span>
                        {formatLabel(p.post_type, p.slide_count, (k) =>
                          t(`format.${k}`),
                        )}
                      </span>
                      {p.publish_on ? <span>· {p.publish_on}</span> : null}
                    </p>

                    {p.note_design ? (
                      <p className="mt-2 rounded-md bg-amber-500/10 px-2 py-1.5 text-[11px] leading-relaxed text-amber-700 dark:text-amber-300">
                        {p.note_design}
                      </p>
                    ) : null}

                    <p
                      className={`mt-2 text-[11px] ${
                        p.material_url ? "text-emerald-600" : "text-destructive"
                      }`}
                    >
                      {p.material_url
                        ? t("production.folderAttached")
                        : t("production.noFolder")}
                    </p>
                    {p.approved_internal_at ? (
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {t("production.textApproved", {
                          date: dayOf(p.approved_internal_at) ?? "—",
                        })}
                      </p>
                    ) : null}
                  </Link>
                ))}
                {items.length === 0 ? (
                  <p className="py-6 text-center text-xs text-muted-foreground/60">
                    —
                  </p>
                ) : null}
              </div>
            </section>
          );
        })}
      </div>

      <p className="mt-4 rounded-xl border-l-2 border-brand bg-muted/40 px-4 py-3 text-sm leading-relaxed text-muted-foreground">
        {t(isDesign ? "production.noteDesign" : "production.note")}
      </p>
    </>
  );
}
