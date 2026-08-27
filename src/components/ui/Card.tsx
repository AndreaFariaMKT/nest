import { cn } from "@/lib/utils";

export function Card({
  className,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-card text-card-foreground",
        className,
      )}
      {...rest}
    />
  );
}

export function CardHeader({
  className,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex flex-col space-y-1.5 px-6 py-5", className)}
      {...rest}
    />
  );
}

export function CardTitle({
  className,
  ...rest
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      // No `tracking-tight` here. It was the only tracking in the app and it
      // was on the *smaller* of the two display sizes — backwards: a serif
      // needs its letterfit opened up as it gets smaller, not closed. The
      // negative tracking lives on PageHeader, at 36px, where it belongs.
      className={cn("font-display text-xl leading-snug", className)}
      {...rest}
    />
  );
}

export function CardDescription({
  className,
  ...rest
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn("text-sm text-muted-foreground", className)} {...rest} />
  );
}

export function CardContent({
  className,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-6 pb-5 pt-0", className)} {...rest} />;
}

export function CardFooter({
  className,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex items-center px-6 pb-5 pt-0", className)}
      {...rest}
    />
  );
}
