import { setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/routing";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
import { getTheme } from "@/lib/theme-server";
import { getSessionUser } from "@/lib/auth";

export default async function AppLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [user, theme] = await Promise.all([getSessionUser(), getTheme()]);

  if (!user) {
    redirect({ href: "/login", locale: locale as "pt-BR" | "en" });
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex max-w-[1440px] flex-col gap-4 p-4">
        <TopBar locale={locale} theme={theme} />
        <div className="flex gap-4">
          <Sidebar theme={theme} />
          <main className="min-w-0 flex-1 rounded-2xl bg-card px-6 py-6 shadow-sm">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
