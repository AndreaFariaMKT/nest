import { useLocale } from "next-intl";

import { formatIsoDate } from "@/lib/social";

/**
 * The two wrappers that appeared, byte for byte, in nine and five files
 * respectively. Keeping them here means a change to the module's voice is one
 * edit rather than fourteen.
 */

/** The footnote every module screen closes with. */
export function ModuleNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-4 rounded-xl border-l-2 border-brand bg-muted/40 px-4 py-3 text-sm leading-relaxed text-muted-foreground">
      {children}
    </p>
  );
}

/** "There is nothing here", said the same way everywhere. */
export function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-2xl border border-border bg-card px-5 py-12 text-center text-sm text-muted-foreground">
      {children}
    </p>
  );
}

/** A screen's section heading, with an optional count on the right. */
export function SectionTitle({
  title,
  hint,
}: {
  title: string;
  hint?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-5 pb-2 pt-4">
      <h2 className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
        {title}
      </h2>
      {hint ? <span className="text-xs text-brand">{hint}</span> : null}
    </div>
  );
}

/** The small caps label the module uses above every field and panel. */
export function FieldLabel({
  htmlFor,
  children,
  id,
}: {
  htmlFor?: string;
  id?: string;
  children: React.ReactNode;
}) {
  return (
    <label
      id={id}
      htmlFor={htmlFor}
      className="mb-1.5 block text-[10px] font-medium uppercase tracking-widest text-muted-foreground"
    >
      {children}
    </label>
  );
}

/**
 * "Sat 12 Sep 2026", the same on every screen. Backed by formatIsoDate so the
 * shape lives with the rest of the date rules rather than in a component.
 */
export function useDateLabel() {
  const locale = useLocale();
  return (iso: string | null | undefined) => formatIsoDate(iso, locale);
}
