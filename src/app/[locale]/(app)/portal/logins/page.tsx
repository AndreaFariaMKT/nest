import { setRequestLocale, getTranslations } from "next-intl/server";

import { OPTION_LIST_CAP } from "@/lib/pagination";
import { createClient } from "@/lib/supabase/server";
import { getPortalClient } from "@/lib/client-portal";
import { PageHeader } from "@/components/ui/PageHeader";
import { todayIso } from "@/lib/social";
import { LoginList, type LoginRow } from "../../social/_components/LoginList";
import { NotLinked } from "../_NotLinked";
import { ModuleNote } from "../../social/_components/Shared";

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
    .order("platform")
    .limit(OPTION_LIST_CAP);

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
        emptyKey="emptyPortal"
        items={items}
        clientName={() => client.name}
        locale={locale}
        today={todayIso()}
        canEdit={false}
        showClient={false}
      />
      <ModuleNote>
        {ts("logins.notePortal")}
      </ModuleNote>
    </>
  );
}
