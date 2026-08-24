import { setRequestLocale } from "next-intl/server";

import { PageHeader } from "@/components/ui/PageHeader";

export const dynamic = "force-dynamic";

type Section = { title: string; items: string[] };
type Content = {
  subtitle: string;
  sections: Section[];
};

const CONTENT: Record<"pt-BR" | "en", Content> = {
  "pt-BR": {
    subtitle: "Como o studio opera — as regras que não mudam.",
    sections: [
      {
        title: "A gente faz",
        items: [
          "Estratégia de marca e sistemas de identidade",
          "Conteúdo pensado como sistema, não peças soltas",
          "Sites que convertem",
        ],
      },
      {
        title: "A gente não faz",
        items: [
          "Post solto de rede social sem estratégia",
          "Contrato aberto sem fim definido",
          "Trabalho sem briefing",
        ],
      },
      {
        title: "Como a gente soa",
        items: [
          "Caloroso, preciso, confiante",
          "Linguagem simples — sem jargão",
          "A gente lidera pelo resultado do cliente",
        ],
      },
      {
        title: "Cadência",
        items: [
          "Sync semanal do time",
          "Relatório mensal por cliente",
          "Revisão de estratégia a cada trimestre",
        ],
      },
    ],
  },
  en: {
    subtitle: "How the studio operates — the rules that don't move.",
    sections: [
      {
        title: "We do",
        items: [
          "Brand strategy & identity systems",
          "Content built as systems, not one-offs",
          "Websites that convert",
        ],
      },
      {
        title: "We don't",
        items: [
          "One-off social posts with no strategy",
          "Open-ended engagements without a defined end",
          "Work without a brief",
        ],
      },
      {
        title: "How we sound",
        items: [
          "Warm, precise, confident",
          "Plain language — no jargon",
          "We lead with the client's outcome",
        ],
      },
      {
        title: "Cadence",
        items: [
          "Weekly team sync",
          "Monthly client report",
          "Quarterly strategy review",
        ],
      },
    ],
  },
};

export default async function PlaybookPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const content = CONTENT[locale === "en" ? "en" : "pt-BR"];

  return (
    <>
      <PageHeader title="Playbook" subtitle={content.subtitle} />
      {/* Starter content, written into the component — not read from any
          table and not editable in the app. Saying so matters: a founder
          should never be shown goals and a house voice she did not write, in
          her own sidebar, with nothing indicating where they came from. */}
      <p
        role="status"
        className="mb-5 rounded-xl border border-border bg-muted/50 px-4 py-3 text-sm text-muted-foreground"
      >
        {locale === "en"
          ? "This is starter text that ships with the app, not your own. Nothing here is saved or editable yet — tell the studio what it should say."
          : "Este é um texto inicial que vem com o sistema, não é seu. Nada aqui é salvo nem editável ainda — diga o que ele deveria dizer."}
      </p>

      <div className="grid gap-4 md:grid-cols-2">
        {content.sections.map((section) => (
          <section
            key={section.title}
            className="rounded-2xl border border-border bg-card p-5"
          >
            <h2 className="mb-3 font-display text-xl text-foreground">
              {section.title}
            </h2>
            <ul className="space-y-2">
              {section.items.map((item) => (
                <li
                  key={item}
                  className="flex gap-2 text-sm text-muted-foreground"
                >
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
                  {item}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}
