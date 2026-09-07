export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/**
 * Find a slug nobody is using, given a way to ask.
 *
 * This existed twice — once in clients/actions.ts and once in
 * services/actions.ts, identical apart from the table name — and projects
 * would have made three. The probe is a callback rather than a Supabase query
 * so the loop can be tested without a database, and so a caller whose
 * uniqueness is scoped (projects are unique per tenant, clients globally) can
 * express that itself.
 *
 * The original loop was `while (true)` around a query. It terminates in
 * practice, but "in practice" is doing real work there: a probe that always
 * answers "taken" — a broken filter, an RLS policy hiding the row it is
 * checking for — spins against the database forever inside a server action.
 * The cap turns that into a slug with a random tail, which is ugly and
 * finite.
 */
export async function uniqueSlug(
  base: string,
  fallback: string,
  isTaken: (slug: string) => Promise<boolean>,
  maxTries = 50,
): Promise<string> {
  const root = base || fallback;
  let candidate = root;

  for (let suffix = 2; suffix <= maxTries; suffix++) {
    if (!(await isTaken(candidate))) return candidate;
    candidate = `${root}-${suffix}`;
  }

  // Fifty collisions on one name is not a naming problem any more. Take the
  // random tail and let the write proceed rather than hanging the request.
  return `${root}-${Math.random().toString(36).slice(2, 8)}`;
}
