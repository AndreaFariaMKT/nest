import { cn } from "@/lib/utils";

type Tone = "default" | "brand" | "success" | "warning" | "muted" | "danger";

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
