import { setRequestLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Pill } from "@/components/ui/Pill";
import { createClient } from "@/lib/supabase/server";
import { isOwner } from "@/lib/auth";
import type { Database, UserRole } from "@/types/database";
import { InviteForm } from "./_components/InviteForm";

type Profile = Pick<
  Database["public"]["Tables"]["profiles"]["Row"],
  "id" | "email" | "full_name" | "avatar_url" | "locale" | "role" | "created_at"
>;

const roleTone: Record<UserRole, "default" | "muted" | "warning"> = {
  owner: "warning",
  staff: "default",
  client: "muted",
};

export default async function TeamPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  // Owner-gate (RLS on profiles allows all authed reads, but only the owner
  // needs to see this page — everyone else gets 404).
  if (!(await isOwner())) notFound();

  const t = await getTranslations("team");

  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    // Not `*`: 029 revokes the google_* token columns from `authenticated`,
    // and a star select expands to them.
    .select("id, email, full_name, avatar_url, locale, role, created_at")
    .order("role", { ascending: true })
    .order("full_name", { ascending: true });
  const members = (data ?? []) as Profile[];

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-8">
        <h1 className="font-display text-4xl text-foreground">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <section className="mb-10 rounded-lg border border-border bg-card p-5">
        <h2 className="font-display text-xl">{t("inviteTitle")}</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          {t("inviteSubtitle")}
        </p>
        <InviteForm locale={locale} />
      </section>

      <section>
        <h2 className="mb-3 font-display text-xl">{t("membersTitle")}</h2>
        <ul className="space-y-2">
          {members.map((member) => (
            <li
              key={member.id}
              className="flex items-center justify-between gap-3 rounded-md border border-border bg-card p-3 text-sm"
              data-testid="team-member"
            >
              <div>
                <div className="font-medium">
                  {member.full_name ?? member.email}
                </div>
                <div className="text-xs text-muted-foreground">
                  {member.email}
                </div>
              </div>
              <Pill tone={roleTone[member.role]}>{t(`roles.${member.role}`)}</Pill>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export const dynamic = "force-dynamic";
