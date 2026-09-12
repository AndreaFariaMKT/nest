import { setRequestLocale, getTranslations } from "next-intl/server";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { getCurrentProfile } from "@/lib/auth";
import { PasswordForm } from "./PasswordForm";

export const dynamic = "force-dynamic";

/**
 * Your own account, as opposed to the studio's.
 *
 * Separate from /settings on purpose. That page connects the studio's Google
 * account and holds its tokens, which is why the guard restricts it to the
 * founder — and changing your own password is something every role has to be
 * able to do, most of all the one whose password was chosen by somebody else
 * and read out loud. Putting the form there would have meant either opening
 * that page up or leaving the accountant with a password she cannot change.
 */
export default async function AccountPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("account");
  const profile = await getCurrentProfile();

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        subtitle={profile?.email ?? t("subtitle")}
      />

      <Card>
        <CardHeader>
          <CardTitle>{t("password.title")}</CardTitle>
          <CardDescription>{t("password.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <PasswordForm />
        </CardContent>
      </Card>
    </div>
  );
}
