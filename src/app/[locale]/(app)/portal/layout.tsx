import { getTranslations } from "next-intl/server";

import { getPortalClient, isPortalPreview } from "@/lib/client-portal";

/**
 * The band that says "you are not a client".
 *
 * A founder can now preview the portal — before, "view as client" showed her
 * nothing but empty boxes, because she is not any client's portal_user_id. A
 * preview that looks identical to the real thing is its own hazard, though:
 * this is the screen where someone answers a client's question, and doing that
 * with a different client's data in front of you is worse than not seeing it
 * at all. So it says whose portal this is, every screen, unmissably.
 */
export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [preview, client, t] = await Promise.all([
    isPortalPreview(),
    getPortalClient(),
    getTranslations("portal"),
  ]);

  return (
    <>
      {preview ? (
        <p
          role="status"
          className="mb-5 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-300"
        >
          {client
            ? t("previewing", { name: client.name })
            : t("previewingNoClient")}
        </p>
      ) : null}
      {children}
    </>
  );
}
