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
 * One shape per house, at every size: the mark alone, no name beside it. AFM's
 * is its symbol; Nest's is the `n` from its wordmark, since Nest has no
 * separate symbol.
 *
 * It takes `currentColor`, so the sidebar tints it like everything else, and
 * carries role="img" — without it an aria-label on a bare <svg> is not
 * reliably exposed, and removing the visible wordmark was justified on the
 * claim that the mark carries the tenant's name for a screen reader.
 * The viewBoxes are cropped to the artwork — the source files are 800×800
 * with the mark somewhere in the middle, and using them as-is would render a
 * logo a fifth of its box surrounded by air.
 */

const AFM_SYMBOL =
  "M644.03,301.38l-81.91,25.68,14.31,48.07c2.04,6.86-5.84,12.37-11.58,8.09l-121.57-90.63-288.83,90.57,5.87,18.34,367.22-.11c8.52,0,10.36,11.99,2.23,14.54l-45.67,14.32-187.58,58.82,5.86,18.34,189.69-.05c9.43,0,18.3-4.46,23.93-12.01l68.75-92.23,1.3-1.75,1.12-1.5,52.06-69.84c6.13-8.22,7.91-18.89,4.79-28.65h0Z";

/** The `n` of the Nest wordmark, from Nest-Logo2.svg. */
const NEST_N =
  "M102.48,111.95h-1.68c-7.96,0-13.56,2.78-16.74,7.02-.27.36-.68.59-1.14.59-.77,0-1.41-.63-1.41-1.43v-5.39h-11.74v45.39h11.76v-23.99c0-7.87,4.96-12.53,13.79-12.53h1.68c9.19,0,13.54,4.56,13.54,12.53v23.99h11.76v-25.78c0-13.61-6.99-20.41-19.81-20.41Z";

/** Compact glyph — collapsed sidebar, mobile bar, favicons. */
export function BrandMark({
  theme,
  ...props
}: SVGProps<SVGSVGElement> & { theme: Theme }) {
  if (theme === "afm") {
    return (
      <svg viewBox="125 295 530 190" fill="currentColor" role="img" {...props}>
        <path d={AFM_SYMBOL} />
      </svg>
    );
  }
  return (
    <svg viewBox="69 108 56 52" fill="currentColor" role="img" {...props}>
      <path d={NEST_N} />
    </svg>
  );
}

// A lockup lived here — symbol plus the name beside it — and is gone on the
// studio's instruction. The name was set in the app's display face, which is
// not the face either wordmark is drawn in, so the pairing read as two
// different brands in one line. That the display face also cannot render
// "Andréa" only made a wrong idea look broken as well.
//
// The mark stands alone at both sizes now.
