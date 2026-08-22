import { setRequestLocale, getTranslations } from "next-intl/server";

import { createClient } from "@/lib/supabase/server";
import { getPortalClient } from "@/lib/client-portal";
import { PageHeader } from "@/components/ui/PageHeader";
import { todayIso } from "@/lib/social";
import { LoginList, type LoginRow } from "../../social/_components/LoginList";
import { NotLinked } from "../_NotLinked";

export const dynamic = "force-dynamic";

export default async function PortalLogins({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, ts, client] = await Promise.all([
    getTranslations("portal"),
    getTranslations("social"),
    getPortalClient(),
  ]);
  if (!client) return <NotLinked message={t("notLinked")} />;

  const supabase = await createClient();
  const { data } = await supabase
    .from("shared_logins")
    .select(
      "id, client_id, platform, site, username, secret_enc, holder, mfa, access_roles, note, rotated_on",
    )
    .eq("client_id", client.id)
    .order("platform");

  // Ciphertext stays server-side; the page only knows whether a password exists.
  const items: LoginRow[] = (data ?? []).map(({ secret_enc, ...row }) => ({
    ...row,
    has_secret: !!secret_enc,
  }));

  return (
    <>
      <PageHeader
        title={ts("logins.title")}
        subtitle={ts("logins.subtitlePortal")}
      />
      <LoginList
        items={items}
        clientName={() => client.name}
        locale={locale}
        today={todayIso()}
        canEdit={false}
        showClient={false}
      />
      <p className="mt-4 rounded-xl border-l-2 border-brand bg-muted/40 px-4 py-3 text-sm leading-relaxed text-muted-foreground">
        {ts("logins.notePortal")}
      </p>
    </>
  );
}
