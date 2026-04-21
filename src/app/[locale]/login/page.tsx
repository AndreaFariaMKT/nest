import { setRequestLocale, getTranslations } from "next-intl/server";
import { LoginForm } from "./LoginForm";

export default async function LoginPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("auth");

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-1 text-center">
          <h1 className="font-display text-4xl">{t("welcomeBack")}</h1>
          <p className="text-sm text-muted-foreground">{t("welcomeSubtitle")}</p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
