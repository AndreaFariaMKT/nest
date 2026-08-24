"use client";

import { useTranslations } from "next-intl";
import { useRouter, usePathname } from "@/i18n/routing";

export interface ClientOption {
  slug: string;
  name: string;
}

/**
 * The module's client filter.
 *
 * It used to sit beside a row of thirteen tabs; the screens moved into the
 * sidebar, and this stayed, because it is the one control that belongs to the
 * page rather than to the navigation — it changes what the screen in front of
 * you is about, not which screen you are on.
 *
 * The choice rides in the query string so the sidebar's links can carry it
 * across screens: picking a client on the backlog and clicking to the
 * fortnight should not silently widen back to every client.
 */
export function ClientFilter({
  clients,
  currentClient,
}: {
  clients: ClientOption[];
  currentClient: string;
}) {
  const t = useTranslations("social");
  const router = useRouter();
  const pathname = usePathname();

  function pick(slug: string) {
    router.replace({
      pathname: pathname as "/social",
      query: slug ? { client: slug } : {},
    });
  }

  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">{t("filter.client")}</span>
      <select
        value={currentClient}
        onChange={(e) => pick(e.target.value)}
        className="h-9 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      >
        <option value="">{t("filter.allClients")}</option>
        {clients.map((c) => (
          <option key={c.slug} value={c.slug}>
            {c.name}
          </option>
        ))}
      </select>
    </label>
  );
}
