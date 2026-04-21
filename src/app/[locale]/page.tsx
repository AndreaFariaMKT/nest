import { redirect } from "@/i18n/routing";

export default async function RootLocalePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect({ href: "/today", locale: locale as "pt-BR" | "en" });
}
