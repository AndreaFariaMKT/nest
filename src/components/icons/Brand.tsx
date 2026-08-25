import type { SVGProps } from "react";

import type { Theme } from "@/lib/theme";

/**
 * The two houses' real marks.
 *
 * What stood here before was `NestMark` — a generic house outline drawn from
 * two strokes — rendered for BOTH tenants, with the name beside it as plain
 * text. A placeholder on every screen, in the one place a brand studio's own
 * software should not have one.
 *
 * Two shapes per house, because a sidebar needs both:
 *
 * - `BrandMark` is the compact glyph for the collapsed rail and the mobile
 *   bar. AFM's is its symbol; Nest's is the `n` from its wordmark, since Nest
 *   has no separate symbol.
 * - `BrandLockup` is the horizontal signature for the expanded sidebar. Nest's
 *   wordmark IS the lockup; AFM's is symbol plus name.
 *
 * Both take `currentColor`, so the sidebar tints them like everything else.
 * The viewBoxes are cropped to the artwork — the source files are 800×800
 * with the mark somewhere in the middle, and using them as-is would render a
 * logo a fifth of its box surrounded by air.
 */

const AFM_SYMBOL =
  "M644.03,301.38l-81.91,25.68,14.31,48.07c2.04,6.86-5.84,12.37-11.58,8.09l-121.57-90.63-288.83,90.57,5.87,18.34,367.22-.11c8.52,0,10.36,11.99,2.23,14.54l-45.67,14.32-187.58,58.82,5.86,18.34,189.69-.05c9.43,0,18.3-4.46,23.93-12.01l68.75-92.23,1.3-1.75,1.12-1.5,52.06-69.84c6.13-8.22,7.91-18.89,4.79-28.65h0Z";

/** The four letters of the Nest wordmark, from Nest-Logo2.svg. */
const NEST_N =
  "M102.48,111.95h-1.68c-7.96,0-13.56,2.78-16.74,7.02-.27.36-.68.59-1.14.59-.77,0-1.41-.63-1.41-1.43v-5.39h-11.74v45.39h11.76v-23.99c0-7.87,4.96-12.53,13.79-12.53h1.68c9.19,0,13.54,4.56,13.54,12.53v23.99h11.76v-25.78c0-13.61-6.99-20.41-19.81-20.41Z";
const NEST_E =
  "M161.17,111.14h-2.04c-15.21,0-26.88,7.34-26.88,22.19v2.78c0,15.03,11.68,22.03,26.88,22.03h2.04c16.18,0,24.68-6.71,26.35-15.94h-10.97c-1.68,5.1-7.07,7.52-15.4,7.52h-2.04c-9.91,0-15.57-4.38-15.65-12.44h44.49v-3.94c0-14.86-11.76-22.19-26.8-22.19h.01ZM143.48,132.26c.03-1.33.04-2.61.38-3.9.23-.91.57-1.79,1.03-2.6.91-1.62,2.25-2.93,3.83-3.86,1.83-1.1,3.92-1.7,6.03-2.03,1.43-.22,2.86-.3,4.3-.3h2.12c2.43,0,4.89.27,7.21,1.03,1.94.63,3.8,1.59,5.28,3.02,1.38,1.33,2.38,3.02,2.85,4.89.2.78.27,1.54.3,2.34,0,.1.04,1.42.04,1.42h-33.39.01Z";
const NEST_S =
  "M253.04,132.24h-42.9c.1-8.05,5.76-12.44,15.65-12.44h2.02c8.32,0,13.71,2.42,15.4,7.52h10.97c-1.68-9.22-10.17-15.94-26.37-15.94h-2.02c-14.81,0-26.23,6.65-26.83,20.88h-.03c0,.22-.01,2.03-.03,3.44,0,.88.69,1.59,1.56,1.59h42.92c-.1,8.05-5.76,12.44-15.66,12.44h-2.02c-8.32,0-13.71-2.42-15.4-7.52h-10.97c1.68,9.22,10.17,15.94,26.37,15.94h2.02c14.81,0,26.23-6.65,26.83-20.88l.04-3.41c0-.89-.69-1.61-1.57-1.61h.01Z";
const NEST_T =
  "M308.76,127.05v-5.03h-34.32v-10.07h-11.76v29.07c0,2.05.46,4.07,1.44,5.87,2.35,4.37,8.19,11.26,21.6,11.26,11.32,0,23.04-5.63,23.04-18.53v-2.6h-10.97v2.06c0,6.18-3.8,9.48-11.5,9.48s-11.85-1.09-11.85-7.26v-14.24h34.32Z";

/** Compact glyph — collapsed sidebar, mobile bar, favicons. */
export function BrandMark({
  theme,
  ...props
}: SVGProps<SVGSVGElement> & { theme: Theme }) {
  if (theme === "afm") {
    return (
      <svg viewBox="125 295 530 190" fill="currentColor" {...props}>
        <path d={AFM_SYMBOL} />
      </svg>
    );
  }
  return (
    <svg viewBox="69 108 56 52" fill="currentColor" {...props}>
      <path d={NEST_N} />
    </svg>
  );
}

/** Horizontal signature — expanded sidebar. */
export function BrandLockup({
  theme,
  ...props
}: SVGProps<SVGSVGElement> & { theme: Theme }) {
  if (theme === "afm") {
    // Symbol and name on one baseline. The name is set in the sidebar's own
    // display face rather than as outlines, so it stays selectable text and
    // does not need a third copy of the letterforms.
    return (
      <span className="flex items-baseline gap-2">
        <svg
          viewBox="125 295 530 190"
          fill="currentColor"
          className="h-3 w-auto shrink-0 translate-y-[1px]"
          aria-hidden="true"
        >
          <path d={AFM_SYMBOL} />
        </svg>
        <span className="font-display text-2xl lowercase tracking-tight">
          andrea faria
        </span>
      </span>
    );
  }
  return (
    <svg viewBox="69 108 244 52" fill="currentColor" {...props}>
      <path d={NEST_N} />
      <path d={NEST_E} />
      <path d={NEST_S} />
      <path d={NEST_T} />
    </svg>
  );
}
