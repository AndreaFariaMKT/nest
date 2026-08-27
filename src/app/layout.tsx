import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";
import { getCurrentTenant } from "@/lib/tenant-server";

const sans = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

// Fraunces — SIL Open Font License 1.1, served by next/font/google.
//
// This replaced Manier, which shipped here as unlicensed trial files
// ("Manier Regular-Trial", © 2018 Piotr Łapa) that could not set Portuguese.
// Each weight carried 70 glyphs — A-Z, a-z, 0-9 and a little punctuation —
// and none of á à â ã é ê í ó ô õ ú ü ç, their capitals, or ; ' " ( ) / % – —.
// The browser falls back per character, so "Configurações" rendered as
// "Configura" + "çõ" + "es" in two different faces inside one word, across
// 524 pt-BR strings.
//
// Fraunces was chosen to hold Manier's register rather than replace it:
// Manier measured as an editorial display serif (cap height 700, x-height 499,
// wide caps against narrow lowercase). Fraunces is the same voice with a full
// Latin charset, and it carries a real optical-size axis — so one variable
// file does what twelve static ones were loaded for and never did. Only
// Regular was ever used; no weight class appears with `font-display` anywhere.
//
// SOFT and WONK are pinned low in tailwind.config.ts: this is a serif with a
// point of view, not a novelty face. opsz is left to `font-optical-sizing:
// auto` so a 36px page title and a 20px card title are drawn differently.
const display = Fraunces({
  subsets: ["latin"],
  axes: ["SOFT", "WONK", "opsz"],
  variable: "--font-display",
  display: "swap",
});

/**
 * Per tenant, because the tab is the one place both houses are seen side by
 * side — and because there was no icon at all: every tab showed Next's default
 * glyph, including the /p and /a pages the studio sends to its clients, and
 * every tab in the app was titled "Nest" whichever house you were in.
 */
export async function generateMetadata(): Promise<Metadata> {
  const tenant = await getCurrentTenant();
  return {
    title: { default: tenant.name, template: `%s · ${tenant.name}` },
    description: "Operational platform for Studio Andréa Faria.",
    icons: { icon: `/icon-${tenant.theme}.svg` },
  };
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const tenant = await getCurrentTenant();
  return (
    <html
      className={`${sans.variable} ${display.variable}`}
      data-theme={tenant.theme}
      suppressHydrationWarning
    >
      <body className="min-h-screen bg-background font-sans text-foreground">
        {children}
        <SpeedInsights />
      </body>
    </html>
  );
}
