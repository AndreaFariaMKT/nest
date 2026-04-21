import { setRequestLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/routing";
import { Pill } from "@/components/ui/Pill";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";
import { ArchiveButton } from "./ArchiveButton";

type Client = Database["public"]["Tables"]["clients"]["Row"];

const statusTone = {
  prospect: "warning",
  active: "success",
  paused: "muted",
  archived: "muted",
} as const;

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("clients");

  const supabase = await createClient();
  const { data } = await supabase
    .from("clients")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  if (!data) notFound();
  const client = data as Client;

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-8">
        <Link
          href="/clients"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← {t("title")}
        </Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="font-display text-4xl text-foreground">
                {client.name}
              </h1>
              <Pill tone={statusTone[client.status]}>
                {t(`status.${client.status}`)}
              </Pill>
            </div>
            {client.industry ? (
              <p className="mt-1 text-sm text-muted-foreground">
                {client.industry}
              </p>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={`/clients/${client.slug}/edit`}
              className="inline-flex h-10 items-center rounded-md border border-input bg-background px-4 text-sm font-medium hover:bg-muted"
            >
              {t("edit")}
            </Link>
            <ArchiveButton
              clientId={client.id}
              locale={locale}
              confirmLabel={t("confirmArchive")}
              label={t("archive")}
              disabled={client.status === "archived"}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{t("sections.details")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <DetailRow label={t("fields.website")}>
              {client.website ? (
                <a
                  href={client.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-foreground underline-offset-4 hover:underline"
                >
                  {client.website}
                </a>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </DetailRow>
            <DetailRow label={t("fields.slug")}>
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                {client.slug}
              </code>
            </DetailRow>
            <DetailRow label={t("fields.createdAt")}>
              <span className="text-muted-foreground">
                {new Intl.DateTimeFormat(locale, {
                  dateStyle: "medium",
                }).format(new Date(client.created_at))}
              </span>
            </DetailRow>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("sections.notes")}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {client.notes ? (
              <p className="whitespace-pre-wrap text-foreground">
                {client.notes}
              </p>
            ) : (
              <p className="text-muted-foreground">{t("sections.notesEmpty")}</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
        {(["brandKit", "contracts", "tasks"] as const).map((section) => (
          <Card key={section}>
            <CardHeader>
              <CardTitle className="text-base">
                {t(`sections.${section}`)}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              {t("comingSoon")}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function DetailRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right">{children}</dd>
    </div>
  );
}

export const dynamic = "force-dynamic";
