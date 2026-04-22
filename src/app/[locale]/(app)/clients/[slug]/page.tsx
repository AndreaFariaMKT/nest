import { setRequestLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/routing";
import { Pill } from "@/components/ui/Pill";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { createClient } from "@/lib/supabase/server";
import { isOwner } from "@/lib/auth";
import { formatCentsAsBrl, sumCents } from "@/lib/money";
import type { BrandColor, Database } from "@/types/database";
import { ArchiveButton } from "./ArchiveButton";
import {
  ClientServicesCard,
  type ActiveAssignment,
  type CatalogService,
} from "./_components/ClientServicesCard";

type Client = Database["public"]["Tables"]["clients"]["Row"];
type BrandKitPreview = Pick<
  Database["public"]["Tables"]["brand_kits"]["Row"],
  "palette" | "typography"
>;
type ContractPreview = Pick<
  Database["public"]["Tables"]["contracts"]["Row"],
  "id" | "title" | "monthly_value_cents" | "starts_on" | "ends_on" | "auto_renew"
>;

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

  const { data: kitData } = await supabase
    .from("brand_kits")
    .select("palette, typography")
    .eq("client_id", client.id)
    .maybeSingle();
  const kit = (kitData ?? null) as BrandKitPreview | null;

  const ownerView = await isOwner();
  let contracts: ContractPreview[] = [];
  let mrrCents = 0;
  if (ownerView) {
    const { data: contractData } = await supabase
      .from("contracts")
      .select("id, title, monthly_value_cents, starts_on, ends_on, auto_renew")
      .eq("client_id", client.id)
      .order("starts_on", { ascending: false });
    contracts = (contractData ?? []) as ContractPreview[];
    const today = new Date().toISOString().slice(0, 10);
    mrrCents = sumCents(
      contracts
        .filter(
          (c) => c.starts_on <= today && (!c.ends_on || c.ends_on >= today),
        )
        .map((c) => c.monthly_value_cents),
    );
  }

  const { data: csData } = await supabase
    .from("client_services")
    .select(
      "service_id, started_on, ended_on, services(id, name, default_monthly_cents)",
    )
    .eq("client_id", client.id)
    .is("ended_on", null);

  type CsRow = {
    service_id: string;
    started_on: string;
    services:
      | {
          id: string;
          name: string;
          default_monthly_cents: number | null;
        }
      | null
      | Array<{
          id: string;
          name: string;
          default_monthly_cents: number | null;
        }>;
  };
  const activeServices: ActiveAssignment[] = (
    (csData ?? []) as unknown as CsRow[]
  )
    .map((r) => {
      const svc = Array.isArray(r.services) ? r.services[0] : r.services;
      if (!svc) return null;
      return {
        serviceId: svc.id,
        serviceName: svc.name,
        defaultMonthlyCents: svc.default_monthly_cents,
        startedOn: r.started_on,
      };
    })
    .filter((x): x is ActiveAssignment => x !== null);

  const { data: catalogData } = await supabase
    .from("services")
    .select("id, name")
    .order("name", { ascending: true });
  const catalog: CatalogService[] = (catalogData ?? []) as CatalogService[];

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
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-base">{t("sections.brandKit")}</CardTitle>
            <Link
              href={`/clients/${client.slug}/brand-kit`}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              {kit ? t("edit") : t("configureBrandKit")}
            </Link>
          </CardHeader>
          <CardContent className="text-sm">
            <BrandKitPreviewBlock
              kit={kit}
              emptyLabel={t("sections.brandKitEmpty")}
            />
          </CardContent>
        </Card>

        {ownerView ? (
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="text-base">
                {t("sections.contracts")}
              </CardTitle>
              <Link
                href={`/clients/${client.slug}/contracts`}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                {t("sections.manageContracts")}
              </Link>
            </CardHeader>
            <CardContent className="text-sm">
              {contracts.length === 0 ? (
                <p className="text-muted-foreground">
                  {t("sections.contractsEmpty")}
                </p>
              ) : (
                <div className="space-y-2">
                  <div className="text-xs text-muted-foreground">
                    {t("sections.mrrLabel", { mrr: formatCentsAsBrl(mrrCents) })}
                  </div>
                  <div className="font-display text-lg">{contracts[0].title}</div>
                  <div className="text-xs text-muted-foreground">
                    {formatCentsAsBrl(contracts[0].monthly_value_cents)}
                    {contracts[0].auto_renew ? ` · ${t("sections.autoRenew")}` : ""}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("sections.services")}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <ClientServicesCard
              locale={locale}
              clientId={client.id}
              clientSlug={client.slug}
              active={activeServices}
              catalog={catalog}
              canWrite={ownerView}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("sections.tasks")}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {t("comingSoon")}
          </CardContent>
        </Card>
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

function BrandKitPreviewBlock({
  kit,
  emptyLabel,
}: {
  kit: BrandKitPreview | null;
  emptyLabel: string;
}) {
  if (!kit || !kit.palette || kit.palette.length === 0) {
    return <p className="text-muted-foreground">{emptyLabel}</p>;
  }
  const palette = kit.palette as BrandColor[];
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {palette.slice(0, 8).map((color, index) => (
          <div
            key={`${color.hex}-${index}`}
            className="h-8 w-8 rounded-md border border-border"
            style={{ backgroundColor: color.hex }}
            title={`${color.name} · ${color.hex}`}
          />
        ))}
      </div>
      {kit.typography?.headings || kit.typography?.body ? (
        <p className="text-xs text-muted-foreground">
          {[kit.typography.headings, kit.typography.body]
            .filter(Boolean)
            .join(" · ")}
        </p>
      ) : null}
    </div>
  );
}

export const dynamic = "force-dynamic";
