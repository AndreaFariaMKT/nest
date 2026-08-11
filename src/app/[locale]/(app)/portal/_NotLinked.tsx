export function NotLinked({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card px-8 py-16 text-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}
