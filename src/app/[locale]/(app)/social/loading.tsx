/**
 * The social module's own skeleton.
 *
 * The shared one at (app)/loading.tsx draws a dashboard: a 3-up stat row and
 * three equal columns. That is /today's shape, and it matches no screen in
 * this module — so every navigation here started parsing a layout that then
 * vanished. A skeleton of the wrong shape reads worse than no skeleton at all.
 *
 * It also sits above ModuleShell, so switching tabs blanked the tab bar you
 * had just clicked. Holding the strip in place is most of what makes moving
 * between these screens feel instant.
 */
export default function SocialLoading() {
  return (
    <div className="animate-pulse">
      <div className="mb-6">
        <div className="h-8 w-64 rounded bg-muted" />
        <div className="mt-3 h-4 w-96 max-w-full rounded bg-muted" />
      </div>

      {/* The tab strip, in place — same shape as ModuleNav. */}
      <div className="mb-6 border-b border-border pb-4">
        <div className="flex flex-wrap gap-1">
          {[24, 28, 20, 22, 24, 26, 22].map((w, i) => (
            <div key={i} className="h-8 rounded-md bg-muted"
              style={{ width: `${w * 4}px` }} />
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {[0, 1].map((col) => (
          <div key={col} className="rounded-2xl border border-border bg-card p-5">
            <div className="h-4 w-32 rounded bg-muted" />
            <div className="mt-4 space-y-3">
              {[0, 1, 2, 3].map((row) => (
                <div key={row} className="flex items-center gap-3">
                  <div className="h-2 w-2 shrink-0 rounded-full bg-muted" />
                  <div className="h-3 flex-1 rounded bg-muted" />
                  <div className="h-3 w-16 shrink-0 rounded bg-muted" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
