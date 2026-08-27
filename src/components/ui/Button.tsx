import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "brand" | "danger";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

const variants: Record<Variant, string> = {
  primary:
    "bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-ring",
  secondary:
    "bg-accent text-accent-foreground hover:bg-accent/80 focus-visible:ring-ring",
  ghost:
    "bg-transparent text-foreground hover:bg-muted focus-visible:ring-ring",
  // The module's own two: the brand fill it uses for the primary move, and a
  // destructive outline for "send it back" / "not approved".
  brand:
    "bg-brand text-brand-foreground hover:bg-brand/90 focus-visible:ring-ring",
  danger:
    "border border-destructive/40 bg-background text-destructive hover:bg-destructive/10 focus-visible:ring-ring",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", ...rest }, ref) => (
    <button
      ref={ref}
      className={cn(
        "inline-flex h-10 items-center justify-center rounded-md px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50",
        variants[variant],
        className,
      )}
      {...rest}
    />
  ),
);
Button.displayName = "Button";
