import { useTranslations } from "next-intl";

import { Pill } from "@/components/ui/Pill";
import { EmptyState, useDateLabel } from "./Shared";
import { ConfirmDeleteButton } from "./ConfirmDeleteButton";
import { AccountEditForm } from "./AccountForm";
import { deleteSocialAccountAction } from "../actions";

export interface AccountRow {
  id: string;
  client_id: string;
  platform: string;
  account_ref: string | null;
  has_secret: boolean;
  api_version: string | null;
  publish_mode: string;
  enabled: boolean;
  note: string | null;
  rotated_on: string | null;
}

/**
 * What each client publishes as, and whether it is actually live.
 *
 * The state that matters is not "has a row" — it is the pair (has a token,
 * is switched on). A row with one and not the other is the most likely thing
 * an operator is looking at during onboarding, so the list says which is
 * missing rather than showing a single ambiguous badge.
 */
export function AccountList({
  items,
  clientName,
  locale,
  secretsReady,
}: {
  items: AccountRow[];
  clientName: (id: string) => string;
  locale: string;
  secretsReady: boolean;
}) {
  const t = useTranslations("social.accounts");
  const date = useDateLabel();

  if (items.length === 0) return <EmptyState>{t("empty")}</EmptyState>;

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <ul className="divide-y divide-border">
        {items.map((a) => {
          const live = a.enabled && a.has_secret;
          return (
            <li key={a.id}>
              <div className="flex flex-wrap items-start justify-between gap-3 px-5 py-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    {clientName(a.client_id)} · {t(`platforms.${a.platform}`)}
                  </p>
                  {a.account_ref ? (
                    <p className="mt-0.5 break-all font-mono text-xs text-muted-foreground">
                      {a.account_ref}
                    </p>
                  ) : null}
                  <p className="mt-1 text-xs text-muted-foreground">
                    {a.rotated_on
                      ? t("rotated", { date: date(a.rotated_on) })
                      : t("neverRotated")}
                    {a.api_version ? ` · ${a.api_version}` : ""}
                    {a.platform === "tiktok"
                      ? ` · ${t(`modes.${a.publish_mode}`)}`
                      : ""}
                  </p>
                  {a.note ? (
                    <p className="mt-1 text-xs text-muted-foreground">{a.note}</p>
                  ) : null}
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <Pill tone={live ? "success" : "warning"} className="text-[10px]">
                    {live
                      ? t("statusLive")
                      : !a.has_secret
                        ? t("statusNoToken")
                        : t("statusOff")}
                  </Pill>
                  <ConfirmDeleteButton
                    action={deleteSocialAccountAction}
                    id={a.id}
                    locale={locale}
                    label={t("remove")}
                    confirmLabel={t("removeConfirm")}
                  />
                </div>
              </div>

              {/* Rotating a token and switching an account off are the two
                  things you do in a hurry. Both used to require deleting the
                  row, which stops publishing mid-flight. */}
              <details className="[&[open]>summary]:text-brand">
                <summary className="cursor-pointer list-none px-5 pb-3 text-xs font-medium text-muted-foreground hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  {t("edit")}
                </summary>
                <AccountEditForm
                  locale={locale}
                  account={a}
                  clientName={clientName(a.client_id)}
                  secretsReady={secretsReady}
                />
              </details>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
