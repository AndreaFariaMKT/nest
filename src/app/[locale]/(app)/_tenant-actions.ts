"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

import { redirect } from "@/i18n/routing";
import { getMyTenants } from "@/lib/tenant-server";
import { TENANT_COOKIE } from "@/lib/tenant";
import { VIEW_ROLE_COOKIE } from "@/lib/roles-server";

/**
 * Move the logged-in user into another of their houses.
 *
 * Checked here and not only in the database: current_tenant_id() would ignore
 * a house the user does not belong to, but storing one would leave the
 * switcher showing a choice that is silently not in effect.
 */
export async function switchTenantAction(formData: FormData): Promise<void> {
  const locale = (formData.get("locale") ?? "pt-BR").toString();
  const target = (formData.get("tenantId") ?? "").toString();

  const mine = await getMyTenants();
  if (mine.some((t) => t.id === target)) {
    const jar = await cookies();
    jar.set(TENANT_COOKIE, target, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 365,
    });
    // A "view as" preview is a lens on the house it was chosen in. Carried
    // across, a founder of AFM previewing as accountant would land in Nest
    // under a role she does not hold there.
    jar.delete(VIEW_ROLE_COOKIE);
  }

  revalidatePath("/", "layout");
  // Home, not back where they were: the page they were on may be a row of the
  // house they just left, which the new one cannot see.
  redirect({ href: "/today", locale: locale as "pt-BR" | "en" });
}
