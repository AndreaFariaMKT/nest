/**
 * The piece record is a single narrow column, not a grid. Without this it
 * inherited the module skeleton's two columns and snapped to one on load.
 */
export default function PieceLoading() {
  return (
    <div className="mx-auto max-w-3xl animate-pulse">
      <div className="h-3 w-24 rounded bg-muted" />
      <div className="mt-4 h-9 w-full max-w-lg rounded bg-muted" />
      <div className="mt-3 h-3 w-72 max-w-full rounded bg-muted" />

      <div className="mt-6 space-y-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-2xl border border-border bg-card p-5">
            <div className="h-3 w-28 rounded bg-muted" />
            <div className="mt-4 space-y-2">
              <div className="h-3 w-full rounded bg-muted" />
              <div className="h-3 w-5/6 rounded bg-muted" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
