import { Analytics } from "@vercel/analytics/next";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!routing.locales.includes(locale as (typeof routing.locales)[number])) {
    notFound();
  }

  setRequestLocale(locale);
  const messages = await getMessages();

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      {children}
      {/*
        Deliberately here and not in the root layout. Vercel Analytics sends
        both a masked `route` AND the raw `path`, and the public token routes
        `/p/[token]` and `/a/[token]` live outside `[locale]` — so mounting
        this at the root beaconed every portal and approval token to a third
        party as a page path. `log.ts` already treats portal_token as a secret.
      */}
      <Analytics />
    </NextIntlClientProvider>
  );
}
