"use client";

import { useId, useRef, useTransition } from "react";
import { useTranslations } from "next-intl";

import { switchTenantAction } from "@/app/[locale]/(app)/_tenant-actions";

/**
 * Which house the login is working in. Rendered only for a login that belongs
 * to more than one — for everyone else there is nothing to choose.
 */
export function TenantSwitcher({
  locale,
  current,
  tenants,
}: {
  locale: string;
  current: string;
  tenants: readonly { id: string; name: string }[];
}) {
  const t = useTranslations("common");
  const id = useId();
  const form = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();

  if (tenants.length < 2) return null;

  return (
    <form ref={form} action={switchTenantAction}>
      <input type="hidden" name="locale" value={locale} />
      <label
        htmlFor={id}
        className="mb-1 block px-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-sidebar-muted"
      >
        {t("company")}
      </label>
      <select
        id={id}
        name="tenantId"
        defaultValue={current}
        disabled={pending}
        onChange={() =>
          startTransition(() => {
            form.current?.requestSubmit();
          })
        }
        className="w-full rounded-lg bg-white/5 px-2 py-1.5 text-xs text-sidebar-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {tenants.map((tenant) => (
          <option key={tenant.id} value={tenant.id} className="text-ink">
            {tenant.name}
          </option>
        ))}
      </select>
    </form>
  );
}
