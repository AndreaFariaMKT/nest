import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import type { Route } from "next";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { createClient } from "@/lib/supabase/server";
import { backlogStock, clientHealth, todayIso, type SocialPiece } from "@/lib/social";

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
          {t("moduleCard.disabled")}
        </CardContent>
      </Card>
    );
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("content_drafts")
    .select("status, caption, publish_on")
    .eq("client_id", clientId);

  const pieces = (data ?? []) as unknown as SocialPiece[];
  const health = clientHealth(pieces, perCycle, todayIso());
  const stock = backlogStock(health.stock.count, perCycle);

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
                  n: stock.fortnights.toFixed(1),
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
