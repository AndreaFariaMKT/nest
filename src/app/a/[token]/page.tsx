import { notFound } from "next/navigation";
import Image from "next/image";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { approveViaTokenAction, rejectViaTokenAction } from "./actions";

export const dynamic = "force-dynamic";

type JoinedSlide = {
  id: string;
  position: number;
  headline: string | null;
  body: string | null;
  creatives: Array<{ image_url: string; version: number }> | null;
};
type JoinedDraft = {
  id: string;
  title: string;
  hook: string | null;
  caption: string | null;
  hashtags: string[];
  client: { name: string } | Array<{ name: string }> | null;
  slides: JoinedSlide[];
};
type JoinedApproval = {
  id: string;
  token: string;
  expires_at: string | null;
  approved_at: string | null;
  rejected_at: string | null;
  client_comment: string | null;
  draft: JoinedDraft | JoinedDraft[] | null;
};

function pickOne<T>(v: T | T[] | null): T | null {
  if (!v) return null;
  return Array.isArray(v) ? v[0] ?? null : v;
}

// Public approval page — outside the (app) layout, outside the [locale]
// layout too. Chooses locale heuristically from Accept-Language / ?locale=.
export default async function ApprovalPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { token } = await params;
  const sp = await searchParams;
  const thanks = sp.thanks === "1";
  const rawLocale = (Array.isArray(sp.locale) ? sp.locale[0] : sp.locale) ?? "pt-BR";
  const locale = rawLocale.startsWith("en") ? "en" : "pt-BR";

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  const { data } = await admin
    .from("approvals")
    .select(
      `id, token, expires_at, approved_at, rejected_at, client_comment,
       draft:content_drafts(
         id, title, hook, caption, hashtags,
         client:clients(name),
         slides(id, position, headline, body, creatives(image_url, version))
       )`,
    )
    .eq("token", token)
    .maybeSingle();
  if (!data) notFound();

  const approval = data as unknown as JoinedApproval;
  const draft = pickOne(approval.draft);
  if (!draft) notFound();
  const client = pickOne(draft.client);

  const expired =
    approval.expires_at &&
    new Date(approval.expires_at).getTime() < Date.now();
  const answered = !!(approval.approved_at || approval.rejected_at);

  const slides = [...(draft.slides ?? [])].sort(
    (a, b) => a.position - b.position,
  );
  const thumbs = slides.map((s) => {
    const latest = (s.creatives ?? []).sort((a, b) => b.version - a.version)[0];
    return {
      position: s.position,
      imageUrl: latest?.image_url ?? null,
      headline: s.headline ?? "",
      body: s.body ?? "",
    };
  });

  const t = I18N[locale];

  return (
    <main className="mx-auto min-h-screen max-w-3xl bg-background px-6 py-10">
      <header className="mb-8 border-b border-border pb-6">
        <div className="text-xs uppercase tracking-widest text-muted-foreground">
          {t.kicker}
        </div>
        <h1 className="mt-1 font-display text-3xl text-foreground">
          {client?.name ?? "—"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{draft.title}</p>
      </header>

      {draft.hook ? (
        <p className="mb-6 text-base italic">{draft.hook}</p>
      ) : null}

      <section className="mb-8 grid grid-cols-2 gap-2 md:grid-cols-3">
        {thumbs.length === 0 ? (
          <p className="col-span-full text-sm text-muted-foreground">
            {t.noSlides}
          </p>
        ) : (
          thumbs.map((slide) => (
            <figure
              key={slide.position}
              className="overflow-hidden rounded-md border border-border bg-card"
            >
              <div className="relative aspect-[4/5] w-full bg-muted">
                {slide.imageUrl ? (
                  <Image
                    src={slide.imageUrl}
                    alt={`Slide ${slide.position}`}
                    fill
                    sizes="(max-width: 768px) 50vw, 33vw"
                    className="object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center p-4 text-center text-xs text-muted-foreground">
                    {slide.headline || `${t.slideLabel} ${slide.position}`}
                  </div>
                )}
              </div>
            </figure>
          ))
        )}
      </section>

      {draft.caption ? (
        <section className="mb-8 rounded-md border border-border bg-card p-4">
          <h2 className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {t.captionLabel}
          </h2>
          <p className="whitespace-pre-wrap text-sm">{draft.caption}</p>
          {draft.hashtags.length > 0 ? (
            <p className="mt-3 text-xs text-muted-foreground">
              {draft.hashtags.join(" ")}
            </p>
          ) : null}
        </section>
      ) : null}

      {thanks ? (
        <div className="rounded-md border border-emerald-500/40 bg-emerald-50 p-4 text-sm text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
          {t.thanks}
        </div>
      ) : expired ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          {t.expired}
        </div>
      ) : answered ? (
        <div
          className="rounded-md border border-border bg-muted p-4 text-sm"
          data-testid="already-answered"
        >
          {approval.approved_at ? t.alreadyApproved : t.alreadyRejected}
          {approval.client_comment ? (
            <p className="mt-2 italic text-muted-foreground">
              “{approval.client_comment}”
            </p>
          ) : null}
        </div>
      ) : (
        <section className="space-y-4" data-testid="decision-block">
          <p className="text-sm text-muted-foreground">{t.prompt}</p>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <form action={approveViaTokenAction} className="space-y-2">
              <input type="hidden" name="token" value={token} />
              <input type="hidden" name="locale" value={locale} />
              <textarea
                name="comment"
                rows={3}
                placeholder={t.optionalComment}
                maxLength={2000}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <button
                type="submit"
                className="inline-flex h-10 w-full items-center justify-center rounded-md bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-700"
                data-testid="approve-btn"
              >
                {t.approve}
              </button>
            </form>

            <form action={rejectViaTokenAction} className="space-y-2">
              <input type="hidden" name="token" value={token} />
              <input type="hidden" name="locale" value={locale} />
              <textarea
                name="comment"
                required
                rows={3}
                placeholder={t.changesComment}
                maxLength={2000}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <button
                type="submit"
                className="inline-flex h-10 w-full items-center justify-center rounded-md border border-destructive/40 bg-background px-4 text-sm font-medium text-destructive hover:bg-destructive/10"
                data-testid="reject-btn"
              >
                {t.reject}
              </button>
            </form>
          </div>
        </section>
      )}
    </main>
  );
}

const I18N = {
  "pt-BR": {
    kicker: "Aprovação de conteúdo",
    noSlides: "Os criativos ainda estão sendo preparados.",
    slideLabel: "Slide",
    captionLabel: "Legenda",
    prompt:
      "Confere o carrossel abaixo. Se estiver tudo certo, aprova. Se quiser ajustes, escreve no campo e clica em Pedir mudanças.",
    optionalComment: "Comentário (opcional)",
    changesComment: "O que gostaria de ajustar?",
    approve: "Aprovar",
    reject: "Pedir mudanças",
    thanks: "Pronto! Resposta registrada. O studio vai cuidar do resto.",
    alreadyApproved: "Você já aprovou esse carrossel. Obrigada!",
    alreadyRejected:
      "Você já pediu mudanças nesse carrossel. O studio está trabalhando nelas.",
    expired: "Esse link expirou. Peça um novo ao studio.",
  },
  en: {
    kicker: "Content approval",
    noSlides: "Creatives are still being prepared.",
    slideLabel: "Slide",
    captionLabel: "Caption",
    prompt:
      "Review the carousel below. If it's good, approve. Otherwise, tell us what to adjust and click Request changes.",
    optionalComment: "Comment (optional)",
    changesComment: "What would you like to adjust?",
    approve: "Approve",
    reject: "Request changes",
    thanks: "Done — your response was recorded. The studio takes it from here.",
    alreadyApproved: "You've already approved this carousel. Thanks!",
    alreadyRejected:
      "You've already requested changes on this carousel. The studio is on it.",
    expired: "This link expired. Ask the studio for a new one.",
  },
} as const;
