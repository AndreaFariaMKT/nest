import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import type { Route } from "next";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { createClient } from "@/lib/supabase/server";
import { clientHealth, todayIso, type SocialPiece } from "@/lib/social";

/**
 * A client's Social Media module, seen from the client's own page: is the shelf
 * deep enough, is anything sitting with them, what went live. The link carries
 * the client filter so the module opens already scoped.
 */
export async function SocialModuleCard({
  clientId,
  slug,
  perCycle,
  enabled,
}: {
  clientId: string;
  slug: string;
  perCycle: number;
  enabled: boolean;
}) {
  const t = await getTranslations("social");

  if (!enabled) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("moduleCard.title")}</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <p>{t("moduleCard.disabled")}</p>
          {/* The switch is a checkbox on this client's own edit form. Saying
              so here is the difference between a dead sentence and a next
              step. */}
          <Link
            href={`/clients/${slug}/edit` as Route}
            className="mt-3 inline-flex items-center rounded-md border border-brand px-3 py-1.5 text-sm text-brand transition-colors hover:bg-brand hover:text-brand-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {t("overview.moduleOffAction")}
          </Link>
        </CardContent>
      </Card>
    );
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("content_drafts")
    .select("status, caption, publish_on")
    // Social pieces only — the client card's health dot — the exact symptom 026 exists to prevent.
    .eq("engine", "social")
    .eq("client_id", clientId);

  const pieces = (data ?? []) as unknown as SocialPiece[];
  const health = clientHealth(pieces, perCycle, todayIso());
  // clientHealth already returns this. Calling backlogStock again with its own
  // output produced the same value a second time.
  const stock = health.stock;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="text-base">{t("moduleCard.title")}</CardTitle>
        <Link
          href={`/social?client=${slug}` as Route}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          {t("moduleCard.open")}
        </Link>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <Pill
          tone={
            health.level === "ok"
              ? "success"
              : health.level === "warn"
                ? "warning"
                : "danger"
          }
        >
          {t(`health.${health.reason}`, { count: health.count })}
        </Pill>
        <dl className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
          <div>
            <dt>{t("moduleCard.backlog")}</dt>
            <dd className="text-sm text-foreground">
              {stock.count}{" "}
              <span className="text-xs text-muted-foreground">
                {t("moduleCard.fortnights", {
                  n: Math.round(stock.fortnights * 10) / 10,
                })}
              </span>
            </dd>
          </div>
          <div>
            <dt>{t("moduleCard.withClient")}</dt>
            <dd className="text-sm text-foreground">{health.withClient}</dd>
          </div>
          <div>
            <dt>{t("moduleCard.live")}</dt>
            <dd className="text-sm text-foreground">{health.live}</dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  );
}
