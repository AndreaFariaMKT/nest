"use client";

import { FormError } from "@/components/ui/FormError";
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Pill } from "@/components/ui/Pill";
import { formatCentsAsBrl } from "@/lib/money";
import {
  attachClientServiceAction,
  detachClientServiceAction,
} from "../services-actions";

export type ActiveAssignment = {
  serviceId: string;
  serviceName: string;
  defaultMonthlyCents: number | null;
  startedOn: string;
};

export type CatalogService = {
  id: string;
  name: string;
};

export function ClientServicesCard({
  locale,
  clientId,
  clientSlug,
  active,
  catalog,
  canWrite,
}: {
  locale: string;
  clientId: string;
  clientSlug: string;
  active: ActiveAssignment[];
  catalog: CatalogService[];
  canWrite: boolean;
}) {
  const t = useTranslations("clients");
  const [isPending, startTransition] = useTransition();
  // Both writes used to discard their error, so a refusal looked exactly
  // like a success: the row just never appeared.
  const [error, setError] = useState<string | null>(null);

  const assignedIds = new Set(active.map((a) => a.serviceId));
  const available = catalog.filter((s) => !assignedIds.has(s.id));

  function onAttach(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    fd.set("clientId", clientId);
    fd.set("clientSlug", clientSlug);
    fd.set("locale", locale);
    (event.currentTarget as HTMLFormElement).reset();
    startTransition(async () => {
      const result = await attachClientServiceAction(fd);
      setError(result.ok ? null : (result.error ?? "dbFailed"));
    });
  }

  function onDetach(serviceId: string, startedOn: string) {
    const fd = new FormData();
    fd.set("clientId", clientId);
    fd.set("clientSlug", clientSlug);
    fd.set("serviceId", serviceId);
    fd.set("startedOn", startedOn);
    fd.set("locale", locale);
    startTransition(async () => {
      const result = await detachClientServiceAction(fd);
      setError(result.ok ? null : (result.error ?? "dbFailed"));
    });
  }

  return (
    <div className="space-y-3">
      <FormError error={error} />
      {active.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {t("sections.servicesEmpty")}
        </p>
      ) : (
        <ul className="space-y-1.5">
          {active.map((a) => (
            <li
              key={`${a.serviceId}-${a.startedOn}`}
              className="flex items-center justify-between gap-3 rounded-md border border-border bg-background px-3 py-2 text-sm"
              data-testid="client-service-row"
            >
              <div className="flex flex-col">
                <span className="font-medium">{a.serviceName}</span>
                <span className="text-xs text-muted-foreground">
                  {formatCentsAsBrl(a.defaultMonthlyCents)} ·{" "}
                  {new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(
                    new Date(a.startedOn),
                  )}
                </span>
              </div>
              {canWrite ? (
                <button
                  type="button"
                  onClick={() => onDetach(a.serviceId, a.startedOn)}
                  disabled={isPending}
                  className="text-xs text-muted-foreground hover:text-destructive disabled:opacity-50"
                  aria-label={t("actions.detachService")}
                >
                  ×
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {canWrite && available.length > 0 ? (
        <form
          onSubmit={onAttach}
          className="flex items-center gap-2"
          data-testid="attach-service-form"
        >
          <select
            name="serviceId"
            required
            defaultValue=""
            className="flex h-9 flex-1 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="" disabled>
              {t("actions.pickService")}
            </option>
            {available.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={isPending}
            className="inline-flex h-9 items-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {t("actions.attachService")}
          </button>
        </form>
      ) : null}

      {canWrite && catalog.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          {t("actions.catalogEmpty")}
        </p>
      ) : null}

      {/* Render an inert pill to keep alignment with other small cards */}
      {!canWrite && active.length === 0 ? (
        <Pill tone="muted" className="text-[10px]">
          {t("sections.readonly")}
        </Pill>
      ) : null}
    </div>
  );
}
