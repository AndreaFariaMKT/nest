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

// Manier · Indian Type Foundry — licensed to Studio Andréa Faria
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
