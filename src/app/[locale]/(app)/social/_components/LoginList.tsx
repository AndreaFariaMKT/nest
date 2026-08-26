import { useTranslations } from "next-intl";

import { Pill } from "@/components/ui/Pill";
import { cn } from "@/lib/utils";
import { daysBetween } from "@/lib/social";
import { isAppRole } from "@/lib/roles";
import { EmptyState, useDateLabel } from "./Shared";
import { LoginForm, RevealSecret } from "./LoginForm";
import { ConfirmDeleteButton } from "./ConfirmDeleteButton";
import { deleteLoginAction } from "../actions";

export interface LoginRow {
  id: string;
  client_id: string;
  platform: string;
  site: string | null;
  username: string;
  has_secret: boolean;
  holder: string;
  mfa: string | null;
  access_roles: string[];
  note: string | null;
  rotated_on: string | null;
}

/** Past this, the record gets a nudge — not a rule, a reminder. */
const STALE_DAYS = 30;

export function LoginList({
  items,
  clientName,
  locale,
  today,
  canEdit,
  clients,
  secretsReady = false,
  showClient = true,
  emptyKey,
}: {
  items: LoginRow[];
  clientName: (id: string) => string;
  locale: string;
  today: string;
  canEdit: boolean;
  /** Only the studio screen passes these, and only it renders the edit form. */
  clients?: { id: string; name: string }[];
  secretsReady?: boolean;
  /**
   * Which empty message to show. The default says "nothing for this filter" —
   * true on the studio screen, which has a client picker, and false in the
   * portal, which has none: a client was being pointed at a control that is
   * not on their screen.
   */
  emptyKey?: string;
  showClient?: boolean;
}) {
  const t = useTranslations("social.logins");
  const roleLabel = useTranslations("social.roleShort");
  const date = useDateLabel();

  if (!items.length) {
    return (
      <EmptyState>
        {emptyKey ? t(emptyKey) : t("empty")}
      </EmptyState>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((a) => {
        const stale =
          !!a.rotated_on && daysBetween(a.rotated_on, today) > STALE_DAYS;
        return (
          <article
            key={a.id}
            className={cn(
              "rounded-2xl border border-border bg-card p-5",
              stale && "border-l-4 border-l-amber-500",
            )}
          >
            <header className="mb-4 flex flex-wrap items-center gap-3">
              {showClient ? (
                <Pill tone="muted" className="text-[10px]">
                  {clientName(a.client_id)}
                </Pill>
              ) : null}
              <div className="min-w-0 flex-1">
                <h3 className="font-display text-base leading-tight text-foreground">
                  {a.platform}
                </h3>
                {a.site ? (
                  <p className="mt-0.5 text-xs text-muted-foreground">{a.site}</p>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-1">
                {a.access_roles.map((r) => (
                  <Pill key={r} tone="brand" className="text-[10px]">
                    {isAppRole(r) ? roleLabel(r) : r}
                  </Pill>
                ))}
              </div>
            </header>

            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <span className="mb-1 block text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                  {t("username")}
                </span>
                <span className="block break-all font-mono text-xs">
                  {a.username}
                </span>
              </div>
              <div>
                <span className="mb-1 block text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                  {t("password")}
                </span>
                {a.has_secret ? (
                  <RevealSecret id={a.id} />
                ) : (
                  <span className="text-xs text-muted-foreground">
                    {t("partnerAccess")}
                  </span>
                )}
              </div>
              <div>
                <span className="mb-1 block text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                  {t("lastChanged")}
                </span>
                <span className="flex flex-wrap items-center gap-2 text-xs">
                  {a.rotated_on ? date(a.rotated_on) : t("never")}
                  {stale ? (
                    <Pill tone="warning" className="text-[10px]">
                      {t("over30")}
                    </Pill>
                  ) : null}
                </span>
              </div>
            </div>

            <footer className="mt-4 flex flex-wrap items-center gap-4 border-t border-border pt-3 text-[11px] text-muted-foreground">
              <span>{t("heldBy", { who: a.holder })}</span>
              <span>{t("secondFactor", { what: a.mfa ?? t("none") })}</span>
              {canEdit ? (
                <span className="ml-auto">
                  <ConfirmDeleteButton
                    id={a.id}
                    locale={locale}
                    label={t("delete")}
                    confirmLabel={t("deleteConfirm")}
                    action={deleteLoginAction}
                  />
                </span>
              ) : null}
            </footer>

            {a.note ? (
              <p className="mt-3 border-t border-border pt-3 text-sm leading-relaxed text-muted-foreground">
                {a.note}
              </p>
            ) : null}

            {/* The amber "over 30 days" pill above asks for a rotation. Until
                now the only way to record one was to delete the login and
                retype platform, site, username, holder, MFA, access roles and
                note — so the nudge asked for something the screen could not
                do. */}
            {canEdit && clients ? (
              <div className="mt-3 border-t border-border pt-3">
                <LoginForm
                  locale={locale}
                  clients={clients}
                  today={today}
                  secretsReady={secretsReady}
                  initial={a}
                />
              </div>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}
