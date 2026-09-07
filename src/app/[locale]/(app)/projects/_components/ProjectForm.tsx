"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";

import { FormError } from "@/components/ui/FormError";
import { Link } from "@/i18n/routing";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Textarea } from "@/components/ui/Textarea";
import { PROJECT_TYPES, PROJECT_STATUSES } from "@/lib/projects";
import type { ProjectRow } from "@/lib/projects-db";
import type { ProjectFormState } from "../actions";

export type ClientChoice = { id: string; name: string };
export type PersonChoice = { id: string; label: string };

const initialState: ProjectFormState = {};

export function ProjectForm({
  locale,
  initial,
  clients,
  people,
  memberIds,
  action,
  submitLabel,
}: {
  locale: string;
  initial?: ProjectRow | null;
  clients: ClientChoice[];
  people: PersonChoice[];
  memberIds: string[];
  action: (
    state: ProjectFormState,
    formData: FormData,
  ) => Promise<ProjectFormState>;
  submitLabel: string;
}) {
  const t = useTranslations("projects.form");
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="max-w-2xl space-y-5">
      <input type="hidden" name="locale" value={locale} />
      {initial ? <input type="hidden" name="id" value={initial.id} /> : null}

      <div className="space-y-1.5">
        <Label htmlFor="name">{t("name")}</Label>
        <Input
          id="name"
          name="name"
          required
          maxLength={120}
          defaultValue={initial?.name ?? ""}
        />
        {state.fieldErrors?.name ? (
          <FormError error={t(`errors.${state.fieldErrors.name}`)} />
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="type">{t("type")}</Label>
          {/* No pre-selected value: the type drives the flow that will assign
              the work, so defaulting it quietly picks someone's tasks for
              them. */}
          <select
            id="type"
            name="type"
            required
            defaultValue={initial?.type ?? ""}
            className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="" disabled>
              {t("pickType")}
            </option>
            {PROJECT_TYPES.map((type) => (
              <option key={type} value={type}>
                {t(`types.${type}`)}
              </option>
            ))}
          </select>
          {state.fieldErrors?.type ? (
            <FormError error={t(`errors.${state.fieldErrors.type}`)} />
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="status">{t("status")}</Label>
          <select
            id="status"
            name="status"
            defaultValue={initial?.status ?? "active"}
            className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {PROJECT_STATUSES.map((status) => (
              <option key={status} value={status}>
                {t(`statuses.${status}`)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="client_id">{t("client")}</Label>
        <select
          id="client_id"
          name="client_id"
          defaultValue={initial?.client_id ?? ""}
          className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">{t("internal")}</option>
          {clients.map((client) => (
            <option key={client.id} value={client.id}>
              {client.name}
            </option>
          ))}
        </select>
        {/* The brief asked for razão social, CNPJ, endereço, telefone and
            email on this form. They identify the company, not the engagement,
            so they live on the client and are edited there — carried per
            project they would be the same CNPJ in four places, and four places
            to correct. The link goes to where they are. */}
        <p className="text-xs text-muted-foreground">
          {t("fiscalHint")}{" "}
          <Link href="/clients" className="underline">
            {t("fiscalLink")}
          </Link>
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="starts_on">{t("startsOn")}</Label>
          <Input
            id="starts_on"
            name="starts_on"
            type="date"
            defaultValue={initial?.starts_on ?? ""}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ends_on">{t("endsOn")}</Label>
          <Input
            id="ends_on"
            name="ends_on"
            type="date"
            defaultValue={initial?.ends_on ?? ""}
          />
          {state.fieldErrors?.dates ? (
            <FormError error={t(`errors.${state.fieldErrors.dates}`)} />
          ) : null}
        </div>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">{t("team")}</legend>
        <p className="text-xs text-muted-foreground">{t("teamHint")}</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {people.map((person) => (
            <label
              key={person.id}
              className="flex items-center gap-2 rounded-md border border-border p-2 text-sm"
            >
              <input
                type="checkbox"
                name="member_ids"
                value={person.id}
                defaultChecked={memberIds.includes(person.id)}
                className="h-4 w-4"
              />
              {person.label}
            </label>
          ))}
        </div>
      </fieldset>

      {/* The commercials. "Financeiro: Contrato, Proposta, ... valor do
          serviço, formas e datas dos pagamentos acordados." The fiscal data
          from the same sentence lives on the client — see the note above. */}
      <fieldset className="space-y-4 rounded-2xl border border-border p-4">
        <legend className="px-1 text-sm font-medium">{t("finance")}</legend>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="service_value">{t("serviceValue")}</Label>
            <Input
              id="service_value"
              name="service_value"
              inputMode="decimal"
              placeholder="0,00"
              defaultValue={
                initial?.service_value_cents != null
                  ? (initial.service_value_cents / 100).toLocaleString("pt-BR", {
                      minimumFractionDigits: 2,
                    })
                  : ""
              }
            />
            {state.fieldErrors?.value ? (
              <FormError error={t(`errors.${state.fieldErrors.value}`)} />
            ) : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="currency">{t("currency")}</Label>
            <select
              id="currency"
              name="currency"
              defaultValue={initial?.currency ?? "BRL"}
              className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="BRL">BRL</option>
              <option value="USD">USD</option>
            </select>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="contract_url">{t("contractUrl")}</Label>
            <Input
              id="contract_url"
              name="contract_url"
              type="url"
              maxLength={500}
              defaultValue={initial?.contract_url ?? ""}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="proposal_url">{t("proposalUrl")}</Label>
            <Input
              id="proposal_url"
              name="proposal_url"
              type="url"
              maxLength={500}
              defaultValue={initial?.proposal_url ?? ""}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="payment_terms">{t("paymentTerms")}</Label>
          <Textarea
            id="payment_terms"
            name="payment_terms"
            rows={3}
            maxLength={1000}
            defaultValue={initial?.payment_terms ?? ""}
          />
          <p className="text-xs text-muted-foreground">
            {t("paymentTermsHint")}
          </p>
        </div>
      </fieldset>

      <div className="space-y-1.5">
        <Label htmlFor="scope">{t("scope")}</Label>
        <Textarea
          id="scope"
          name="scope"
          rows={6}
          maxLength={4000}
          defaultValue={initial?.scope ?? ""}
        />
        <p className="text-xs text-muted-foreground">{t("scopeHint")}</p>
      </div>

      {state.error ? <FormError error={state.error} /> : null}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {submitLabel}
        </Button>
        <Link
          href="/projects"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          {t("cancel")}
        </Link>
      </div>
    </form>
  );
}
