import { setRequestLocale } from "next-intl/server";

import { PageHeader } from "@/components/ui/PageHeader";

export const dynamic = "force-dynamic";

type Section = { title: string; items: string[] };
const CONTENT: Record<"pt-BR" | "en", { subtitle: string; sections: Section[] }> =
  {
    "pt-BR": {
      subtitle: "Norte, metas e ritmo do negócio.",
      sections: [
        {
          title: "Norte",
          items: [
            "Ser o studio de referência em marca + conteúdo para pequenas empresas",
            "Crescer com clientes de retainer, não projetos avulsos",
          ],
        },
        {
          title: "Metas do ano",
          items: [
            "Dobrar a base de clientes em retainer",
            "MRR previsível cobrindo 100% do custo fixo",
            "Um caso de sucesso publicado por trimestre",
          ],
        },
        {
          title: "Ritmo operacional",
          items: [
            "Ciclo mensal por cliente",
            "Revisão de metas a cada trimestre",
            "Pipeline comercial revisado toda semana",
          ],
        },
      ],
    },
    en: {
      subtitle: "The north star, targets and operating rhythm.",
      sections: [
        {
          title: "North star",
          items: [
            "Be the go-to studio for brand + content for small businesses",
            "Grow on retainer clients, not one-off projects",
          ],
        },
        {
          title: "This year's goals",
          items: [
            "Double the retainer client base",
            "Predictable MRR covering 100% of fixed costs",
            "One published case study per quarter",
          ],
        },
        {
          title: "Operating rhythm",
          items: [
            "Monthly cycle per client",
            "Quarterly goals review",
            "Weekly commercial pipeline review",
          ],
        },
      ],
    },
  };

export default async function BusinessPlanPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const content = CONTENT[locale === "en" ? "en" : "pt-BR"];

  return (
    <>
      <PageHeader title="Business plan" subtitle={content.subtitle} />
      <div className="grid gap-4 md:grid-cols-3">
        {content.sections.map((s) => (
          <section
            key={s.title}
            className="rounded-2xl border border-border bg-card p-5"
          >
            <h2 className="mb-3 font-display text-xl text-foreground">
              {s.title}
            </h2>
            <ul className="space-y-2">
              {s.items.map((i) => (
                <li key={i} className="flex gap-2 text-sm text-muted-foreground">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
                  {i}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}
