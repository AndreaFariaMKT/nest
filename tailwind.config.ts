import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        // Fraunces is a serif, so the swap-period fallback is one too. This
        // used to read `system-ui, sans-serif`: with `display: "swap"` every
        // page title was drawn in a sans first and then reflowed into a serif.
        //
        // SOFT/WONK are pinned here so all 84 `font-display` usages inherit
        // one cut instead of each guessing. WONK stays 0 — its alternate
        // glyphs are drawn for large sizes and read as noise on a 20px card
        // title. PageHeader turns it on for the one line per screen that is
        // big enough to earn it. opsz is left to `font-optical-sizing: auto`
        // in globals.css.
        display: [
          ["var(--font-display)", "Georgia", "Times New Roman", "serif"],
          { fontVariationSettings: '"SOFT" 20, "WONK" 0' },
        ],
      },
      colors: {
        // Design tokens — consumed via CSS variables in globals.css
        background: "hsl(var(--background) / <alpha-value>)",
        foreground: "hsl(var(--foreground) / <alpha-value>)",
        muted: {
          DEFAULT: "hsl(var(--muted) / <alpha-value>)",
          foreground: "hsl(var(--muted-foreground) / <alpha-value>)",
        },
        border: "hsl(var(--border) / <alpha-value>)",
        input: "hsl(var(--input) / <alpha-value>)",
        ring: "hsl(var(--ring) / <alpha-value>)",
        primary: {
          DEFAULT: "hsl(var(--primary) / <alpha-value>)",
          foreground: "hsl(var(--primary-foreground) / <alpha-value>)",
        },
        accent: {
          DEFAULT: "hsl(var(--accent) / <alpha-value>)",
          foreground: "hsl(var(--accent-foreground) / <alpha-value>)",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive) / <alpha-value>)",
          foreground: "hsl(var(--destructive-foreground) / <alpha-value>)",
        },
        card: {
          DEFAULT: "hsl(var(--card) / <alpha-value>)",
          foreground: "hsl(var(--card-foreground) / <alpha-value>)",
        },
        brand: {
          DEFAULT: "hsl(var(--brand) / <alpha-value>)",
          foreground: "hsl(var(--brand-foreground) / <alpha-value>)",
          soft: "hsl(var(--brand-soft) / <alpha-value>)",
          "soft-foreground": "hsl(var(--brand-soft-foreground) / <alpha-value>)",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar) / <alpha-value>)",
          foreground: "hsl(var(--sidebar-foreground) / <alpha-value>)",
          muted: "hsl(var(--sidebar-muted) / <alpha-value>)",
          active: "hsl(var(--sidebar-active) / <alpha-value>)",
          "active-foreground": "hsl(var(--sidebar-active-foreground) / <alpha-value>)",
          border: "hsl(var(--sidebar-border) / <alpha-value>)",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [],
};

export default config;
