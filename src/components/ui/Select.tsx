import { forwardRef, type SelectHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/**
 * The `<select>` that four finance forms were each spelling by hand.
 *
 * Every one of them carried the same twelve-class string inline, and they had
 * already drifted — two used `px-2`, one `px-3`, and none matched `Input`'s
 * height rule exactly. A picker sitting a pixel off the field beside it is the
 * kind of thing nobody reports and everybody sees.
 */
export const Select = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement>
>(({ className, ...rest }, ref) => (
  <select
    ref={ref}
    className={cn(
      "flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
      className,
    )}
    {...rest}
  />
));
Select.displayName = "Select";
