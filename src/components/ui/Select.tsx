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
type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  /**
   * Size to the content instead of filling the row.
   *
   * A prop rather than a `w-auto` in `className`, because `cn` is plain clsx —
   * it concatenates, it does not merge. Both `w-full` and `w-auto` reach the
   * element and CSS source order decides; tailwind emits `.w-auto` before
   * `.w-full`, so the override loses and the control silently fills its row.
   * Ordering is not a contract, so the width stops being expressed in a class
   * the caller can be overruled on.
   */
  inline?: boolean;
};

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, inline = false, ...rest }, ref) => (
    <select
      ref={ref}
      className={cn(
        "flex h-10 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
        inline ? "w-auto" : "w-full",
        className,
      )}
      {...rest}
    />
  ),
);
Select.displayName = "Select";
