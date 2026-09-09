import { cn } from "@/lib/utils";

export type Tone = "default" | "brand" | "success" | "warning" | "muted" | "danger";

const tones: Record<Tone, string> = {
  default: "bg-accent text-accent-foreground",
  brand: "bg-brand-soft text-brand-soft-foreground",
  success: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-200",
  warning: "bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200",
  muted: "bg-muted text-muted-foreground",
  danger: "bg-destructive/15 text-destructive",
};

export function Pill({
  tone = "default",
  className,
  ...rest
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        tones[tone],
        className,
      )}
      {...rest}
    />
  );
}

/**
 * Pick a tone for a value that arrives as a bare `string`.
 *
 * Most status columns in this schema are CHECK-constrained text rather than
 * enums — a deliberate choice, since an enum needs ALTER TYPE to grow — so the
 * generated types give `string` and indexing a tone map with it does not
 * typecheck. Three near-identical narrowing helpers appeared in one session
 * (projects, reconcile, suppliers) before this existed.
 *
 * Falls back rather than throwing: a value the database allows but a screen
 * has no styling for should render as a plain badge, not crash the list.
 */
export function toneOf(
  map: Readonly<Record<string, Tone>>,
  key: string | null | undefined,
  fallback: Tone = "muted",
): Tone {
  return key && key in map ? map[key] : fallback;
}
