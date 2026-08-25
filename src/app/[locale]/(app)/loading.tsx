// Instant skeleton shown on every route transition until the page's data
// resolves — the navigation feels immediate even while server data loads.
export default function Loading() {
  return (
    <div className=" animate-pulse" aria-busy aria-label="…">
      <div className="mb-8">
        <div className="h-3 w-28 rounded bg-muted" />
        <div className="mt-3 h-8 w-72 rounded bg-muted" />
      </div>
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-border bg-card p-5">
            <div className="h-3 w-20 rounded bg-muted" />
            <div className="mt-4 h-8 w-16 rounded bg-muted" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-border bg-card p-5">
            <div className="mb-4 h-3 w-24 rounded bg-muted" />
            <div className="space-y-3">
              <div className="h-4 w-full rounded bg-muted" />
              <div className="h-4 w-5/6 rounded bg-muted" />
              <div className="h-4 w-2/3 rounded bg-muted" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
