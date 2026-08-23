import { setRequestLocale, getTranslations } from "next-intl/server";

import { createClient } from "@/lib/supabase/server";
import { getPortalClient } from "@/lib/client-portal";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  MediaList,
  type MediaRow,
} from "../../social/_components/MediaList";
import { NotLinked } from "../_NotLinked";

export const dynamic = "force-dynamic";

export default async function PortalMedia({
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
    .from("media_assets")
    .select("id, client_id, title, url, access_note, description, captured_on")
    .eq("client_id", client.id)
    .order("captured_on", { ascending: false });

  return (
    <>
      <PageHeader
        title={ts("media.title")}
        subtitle={ts("media.subtitlePortal")}
      />
      <MediaList
        emptyKey="emptyPortal"
        items={(data ?? []) as MediaRow[]}
        clientName={() => client.name}
        locale={locale}
        canEdit={false}
        showClient={false}
      />
    </>
  );
}
