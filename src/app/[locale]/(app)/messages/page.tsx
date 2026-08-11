import { setRequestLocale, getTranslations } from "next-intl/server";

import { createClient } from "@/lib/supabase/server";
import { currentTenantId } from "@/lib/tenant-server";
import { getSessionUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui/PageHeader";
import { ComposeMessage } from "./ComposeMessage";

export const dynamic = "force-dynamic";

type Message = {
  id: string;
  body: string;
  sender_id: string;
  created_at: string;
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (!parts[0]) return "?";
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}

export default async function MessagesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("messages");

  const supabase = await createClient();
  const tenantId = await currentTenantId();

  const [user, { data: msgData }, { data: people }] = await Promise.all([
    getSessionUser(),
    supabase
      .from("messages")
      .select("id, body, sender_id, created_at")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: true })
      .limit(200),
    supabase.from("profiles").select("id, full_name"),
  ]);

  const messages = (msgData ?? []) as Message[];
  const nameOf = new Map(
    (people ?? []).map((p) => [p.id, p.full_name ?? ""]),
  );

  const timeFmt = new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="mx-auto flex h-full max-w-3xl flex-col">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />

      <div className="mb-4 flex-1 space-y-4 overflow-y-auto rounded-2xl border border-border bg-card p-5">
        {messages.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            {t("empty")}
          </p>
        ) : (
          messages.map((m) => {
            const mine = m.sender_id === user?.id;
            const label = mine ? t("you") : nameOf.get(m.sender_id) || "—";
            return (
              <div
                key={m.id}
                className={`flex gap-3 ${mine ? "flex-row-reverse" : ""}`}
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-soft text-[10px] font-semibold text-brand-soft-foreground">
                  {initials(label)}
                </span>
                <div className={`max-w-[75%] ${mine ? "text-right" : ""}`}>
                  <div className="mb-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{label}</span>
                    <span>{timeFmt.format(new Date(m.created_at))}</span>
                  </div>
                  <div
                    className={`inline-block whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm ${
                      mine
                        ? "bg-brand text-brand-foreground"
                        : "bg-muted text-foreground"
                    }`}
                  >
                    {m.body}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <ComposeMessage
        locale={locale}
        placeholder={t("placeholder")}
        sendLabel={t("send")}
      />
    </div>
  );
}
