"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

/**
 * The studio's error boundary.
 *
 * Without one, an unhandled throw fell through to Next's default page — which
 * loses the sidebar, the locale and any way back other than the browser's back
 * button. Worse, nothing recorded it: the person saw a broken screen and there
 * was no row anywhere saying it had happened.
 *
 * The code shown is the bridge. It is the thing a person quotes on the phone,
 * and the thing that turns "it broke this morning" into one lookup.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("errors");
  const [ref, setRef] = useState<string | null>(null);

  useEffect(() => {
    // The route decides source, actor and tenant — never the browser.
    fetch("/api/client-error", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        message: error.message,
        stack: error.stack,
        digest: error.digest,
        path: window.location.pathname,
      }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setRef(d?.ref ?? null))
      .catch(() => {
        // A failure to report a failure is not worth a second error screen.
      });
  }, [error]);

  return (
    <div className="mx-auto max-w-lg px-6 py-16 text-center">
      <h1 className="font-display text-2xl text-foreground">{t("title")}</h1>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        {t("body")}
      </p>
      {ref ? (
        <p className="mt-4 font-mono text-sm text-brand">{t("ref", { ref })}</p>
      ) : null}
      <button
        type="button"
        onClick={reset}
        className="mt-6 rounded-md bg-brand px-4 py-2 text-sm font-medium text-brand-foreground hover:bg-brand/90"
      >
        {t("retry")}
      </button>
    </div>
  );
}
