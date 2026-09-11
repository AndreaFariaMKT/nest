import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  /** Size to the content instead of filling the row. See Select's note on why
   *  this is a prop and not a `w-auto` in `className`. */
  inline?: boolean;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, inline = false, ...rest }, ref) => (
    <input
      ref={ref}
      className={cn(
        "flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
        inline ? "w-auto" : "w-full",
        className,
      )}
      {...rest}
    />
  ),
);
Input.displayName = "Input";
