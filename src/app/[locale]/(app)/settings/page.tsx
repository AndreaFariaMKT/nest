import { setRequestLocale, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { PageHeader } from "@/components/ui/PageHeader";
import { getCurrentProfile } from "@/lib/auth";
import { env } from "@/lib/env";
import { disconnectGoogleAction } from "./actions";

type GoogleStatus =
  | "connected"
  | "denied"
  | "state_mismatch"
  | "unauthorized"
  | "exchange_unknown"
  | "userinfo_failed"
  | "persist_failed"
  | "error"
  | string;

export default async function SettingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ google?: GoogleStatus }>;
}) {
  const { locale } = await params;
  const { google: googleStatus } = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations("settings");

  const profile = await getCurrentProfile();
  // /sign-in does not exist; the login route is /[locale]/login. This yielded
  // a 404 instead of a login screen on the one path that reaches it.
  if (!profile) redirect("/login");

  // google_email, not the refresh token: the token is service-role only now
  // (029), and disconnecting nulls both, so this says the same thing.
  const googleConnected = !!profile.google_email;
  const googleEmail = profile.google_email;
  const googleConfigured = env.google.ok;

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <PageHeader title={t("title")} />

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{t("integrations.google.title")}</CardTitle>
              <CardDescription>{t("integrations.google.description")}</CardDescription>
            </div>
            {googleConnected ? (
              <Pill tone="success">{t("integrations.google.connectedPill")}</Pill>
            ) : (
              <Pill tone="muted">{t("integrations.google.notConnectedPill")}</Pill>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {googleStatus ? (
            <GoogleStatusBanner status={googleStatus} />
          ) : null}

          {!googleConfigured ? (
            <p className="text-sm text-muted-foreground">
              {t("integrations.google.notConfigured")}
            </p>
          ) : googleConnected ? (
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm">
                <span className="text-muted-foreground">
                  {t("integrations.google.connectedAs")}
                </span>{" "}
                <span className="font-medium">{googleEmail}</span>
              </p>
              <form action={disconnectGoogleAction}>
                <Button variant="secondary" type="submit">
                  {t("integrations.google.disconnect")}
                </Button>
              </form>
            </div>
          ) : (
            <a
              href="/api/google/auth"
              className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              {t("integrations.google.connect")}
            </a>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function GoogleStatusBanner({ status }: { status: string }) {
  const isSuccess = status === "connected";
  return (
    <div
      className={
        isSuccess
          ? "rounded-md bg-emerald-50 p-3 text-sm text-emerald-900 dark:bg-emerald-900/20 dark:text-emerald-200"
          : "rounded-md bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-900/20 dark:text-amber-200"
      }
    >
      {isSuccess
        ? "Google connected successfully."
        : `Google connection failed: ${status.replace(/_/g, " ")}`}
    </div>
  );
}
