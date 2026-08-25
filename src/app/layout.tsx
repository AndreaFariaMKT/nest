import type { Metadata } from "next";
import { Inter } from "next/font/google";
import localFont from "next/font/local";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";
import { getCurrentTenant } from "@/lib/tenant-server";

const sans = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

// Manier — TRIAL FILES, NOT LICENSED. Read this before touching the display face.
//
// The comment here used to read "Indian Type Foundry — licensed to Studio
// Andréa Faria". Both halves were false. The files name themselves
// "Manier Regular-Trial" and carry "Copyright © 2018 by Piotr Łapa".
//
// They also cannot set Portuguese. Each weight holds 70 glyphs — A-Z, a-z,
// 0-9 and a little punctuation — and NONE of the accents this product is
// written in: á à â ã é ê í ó ô õ ú ü ç and every capital form, plus
// ; ' " ( ) [ ] { } – — … / % $ @ # * + =
//
// The browser falls back per character, so "Configurações" renders as
// "Configura" in Manier, "çõ" in the system face, "es" in Manier again —
// mismatched letterforms inside one word. 27 page titles in messages/pt-BR.json
// are affected, including Calendário, Reuniões, Administração and Visão geral.
//
// Fixing this means buying the licence and shipping the full-charset files, or
// choosing a different display face. Both are the studio's call, not a code
// change — which is why this is a comment and not a swap.
const manier = localFont({
  src: [
    { path: "../../public/fonts/Manier-Thin.otf",         weight: "100", style: "normal" },
    { path: "../../public/fonts/Manier-ThinItalic.otf",   weight: "100", style: "italic" },
    { path: "../../public/fonts/Manier-Light.otf",        weight: "300", style: "normal" },
    { path: "../../public/fonts/Manier-LightItalic.otf",  weight: "300", style: "italic" },
    { path: "../../public/fonts/Manier-Regular.otf",      weight: "400", style: "normal" },
    { path: "../../public/fonts/Manier-RegularItalic.otf", weight: "400", style: "italic" },
    { path: "../../public/fonts/Manier-Medium.otf",       weight: "500", style: "normal" },
    { path: "../../public/fonts/Manier-MediumItalic.otf", weight: "500", style: "italic" },
    { path: "../../public/fonts/Manier-Bold.otf",         weight: "700", style: "normal" },
    { path: "../../public/fonts/Manier-BoldItalic.otf",   weight: "700", style: "italic" },
    { path: "../../public/fonts/Manier-Heavy.otf",        weight: "900", style: "normal" },
    { path: "../../public/fonts/Manier-HeavyItalic.otf",  weight: "900", style: "italic" },
  ],
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Nest",
  description: "Operational platform for Studio Andréa Faria.",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const tenant = await getCurrentTenant();
  return (
    <html
      className={`${sans.variable} ${manier.variable}`}
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
