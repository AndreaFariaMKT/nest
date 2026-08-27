/**
 * The one line of display type on every screen.
 *
 * It used to be `font-display text-4xl` and nothing else — no weight, no
 * tracking, no leading, and the same 36px on a 375px phone, where
 * "Calendário de conteúdo" wrapped to three lines against the edge of the
 * screen. All 84 `font-display` usages in the app render at weight 400; there
 * was no type scale, only two sizes.
 *
 * Takes an optional `action` — the button or link that sits on the title's
 * right. Fifteen screens hand-rolled their own `<h1 className="font-display
 * text-4xl">` purely because this component had nowhere to put one, which
 * meant the type scale below reached 35 screens and missed the fifteen most
 * visited ones.
 *
 * This is also the only place WONK is turned on. Fraunces' alternate glyphs
 * are cut for large sizes, so the face gets its point of view once per screen,
 * at the largest thing on it, and stays sober everywhere else. SOFT is
 * repeated because `font-variation-settings` replaces the whole list rather
 * than merging with the value set on `.font-display`.
 */
export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  const heading = (
    <div>
      <h1
        className="text-balance font-display text-3xl leading-[1.1] tracking-[-0.015em] text-foreground md:text-4xl"
        style={{ fontVariationSettings: '"SOFT" 20, "WONK" 1' }}
      >
        {title}
      </h1>
      {subtitle ? (
        <p className="mt-2 max-w-[60ch] text-sm leading-relaxed text-muted-foreground">
          {subtitle}
        </p>
      ) : null}
    </div>
  );

  if (!action) return <div className="mb-8">{heading}</div>;

  // Wraps rather than crushing the title: "Calendário de conteúdo" next to a
  // "Novo agendamento" button has nowhere to go on a 375px screen.
  return (
    <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
      {heading}
      <div className="shrink-0">{action}</div>
    </div>
  );
}
