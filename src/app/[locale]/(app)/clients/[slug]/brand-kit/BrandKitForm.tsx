"use client";

import { useActionState, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Textarea } from "@/components/ui/Textarea";
import type { BrandColor, Database } from "@/types/database";
import { upsertBrandKitAction, type BrandKitFormState } from "./actions";

type BrandKit = Database["public"]["Tables"]["brand_kits"]["Row"];

const emptyColor: BrandColor = { name: "", hex: "#000000" };

export function BrandKitForm({
  locale,
  clientId,
  clientSlug,
  defaultName,
  initial,
}: {
  locale: string;
  clientId: string;
  clientSlug: string;
  defaultName: string;
  initial: BrandKit | null;
}) {
  const t = useTranslations("brandKit");
  const tCommon = useTranslations("common");
  const [state, formAction, isPending] = useActionState<
    BrandKitFormState,
    FormData
  >(upsertBrandKitAction, {});

  const [palette, setPalette] = useState<BrandColor[]>(
    initial?.palette && initial.palette.length > 0
      ? initial.palette
      : [{ name: "Primary", hex: "#1a1a1a" }],
  );
  const [headings, setHeadings] = useState<string>(
    initial?.typography?.headings ?? "",
  );
  const [body, setBody] = useState<string>(initial?.typography?.body ?? "");

  const paletteJson = useMemo(() => JSON.stringify(palette), [palette]);
  const typographyJson = useMemo(
    () => JSON.stringify({ headings, body }),
    [headings, body],
  );

  function updateColor(index: number, patch: Partial<BrandColor>) {
    setPalette((current) =>
      current.map((color, i) => (i === index ? { ...color, ...patch } : color)),
    );
  }

  function addColor() {
    setPalette((current) => [...current, { ...emptyColor }]);
  }

  function removeColor(index: number) {
    setPalette((current) => current.filter((_, i) => i !== index));
  }

  return (
    <form action={formAction} className="space-y-8">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="clientId" value={clientId} />
      <input type="hidden" name="clientSlug" value={clientSlug} />
      <input type="hidden" name="palette" value={paletteJson} />
      <input type="hidden" name="typography" value={typographyJson} />

      {/* Name */}
      <section className="space-y-1.5">
        <Label htmlFor="name">{t("fields.name")}</Label>
        <Input
          id="name"
          name="name"
          required
          minLength={2}
          maxLength={80}
          defaultValue={initial?.name ?? defaultName}
        />
        {state.fieldErrors?.name ? (
          <p className="text-xs text-destructive">
            {t(`errors.${state.fieldErrors.name}`)}
          </p>
        ) : null}
      </section>

      {/* Palette */}
      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-xl">{t("sections.palette")}</h2>
          <button
            type="button"
            onClick={addColor}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            + {t("actions.addColor")}
          </button>
        </div>
        <div className="space-y-2">
          {palette.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("sections.paletteEmpty")}
            </p>
          ) : null}
          {palette.map((color, index) => (
            <div
              key={index}
              className="flex items-center gap-3 rounded-md border border-border bg-card px-3 py-2"
            >
              <label className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-md border border-border">
                <input
                  type="color"
                  value={color.hex}
                  onChange={(event) =>
                    updateColor(index, { hex: event.target.value })
                  }
                  className="h-12 w-12 cursor-pointer border-0 p-0"
                  aria-label={t("fields.colorHex")}
                />
              </label>
              <Input
                value={color.name}
                onChange={(event) =>
                  updateColor(index, { name: event.target.value })
                }
                placeholder={t("fields.colorName")}
                maxLength={40}
                className="h-9"
              />
              <Input
                value={color.hex}
                onChange={(event) =>
                  updateColor(index, { hex: event.target.value })
                }
                placeholder="#000000"
                maxLength={7}
                pattern="^#[0-9a-fA-F]{6}$"
                className="h-9 w-28 font-mono text-xs"
              />
              <button
                type="button"
                onClick={() => removeColor(index)}
                className="text-sm text-muted-foreground hover:text-destructive"
                aria-label={t("actions.removeColor")}
              >
                ×
              </button>
            </div>
          ))}
        </div>
        {state.fieldErrors?.palette ? (
          <p className="text-xs text-destructive">
            {t(`errors.${state.fieldErrors.palette}`)}
          </p>
        ) : null}
      </section>

      {/* Typography */}
      <section className="space-y-3">
        <h2 className="font-display text-xl">{t("sections.typography")}</h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="headings">{t("fields.headings")}</Label>
            <Input
              id="headings"
              value={headings}
              onChange={(event) => setHeadings(event.target.value)}
              placeholder="Manier"
              maxLength={80}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="body">{t("fields.body")}</Label>
            <Input
              id="body"
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder="Inter"
              maxLength={80}
            />
          </div>
        </div>
      </section>

      {/* Voice & tone */}
      <section className="space-y-1.5">
        <Label htmlFor="voice_tone">{t("fields.voiceTone")}</Label>
        <Textarea
          id="voice_tone"
          name="voice_tone"
          rows={3}
          maxLength={1000}
          defaultValue={initial?.voice_tone ?? ""}
          placeholder={t("placeholders.voiceTone")}
        />
      </section>

      {/* Do / Don't */}
      <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="do_list">{t("fields.doList")}</Label>
          <Textarea
            id="do_list"
            name="do_list"
            rows={5}
            maxLength={2000}
            defaultValue={initial?.do_list?.join("\n") ?? ""}
            placeholder={t("placeholders.oneLinePerItem")}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="dont_list">{t("fields.dontList")}</Label>
          <Textarea
            id="dont_list"
            name="dont_list"
            rows={5}
            maxLength={2000}
            defaultValue={initial?.dont_list?.join("\n") ?? ""}
            placeholder={t("placeholders.oneLinePerItem")}
          />
        </div>
      </section>

      {/* Guidelines URL */}
      <section className="space-y-1.5">
        <Label htmlFor="guidelines_url">{t("fields.guidelinesUrl")}</Label>
        <Input
          id="guidelines_url"
          name="guidelines_url"
          type="url"
          placeholder="https://"
          maxLength={300}
          defaultValue={initial?.guidelines_url ?? ""}
        />
      </section>

      {state.error ? (
        <p className="text-sm text-destructive">{state.error}</p>
      ) : null}

      <div className="flex items-center justify-end gap-2 border-t border-border pt-6">
        <Link
          href={`/clients/${clientSlug}`}
          className="inline-flex h-10 items-center rounded-md px-4 text-sm text-muted-foreground hover:text-foreground"
        >
          {tCommon("cancel")}
        </Link>
        <Button type="submit" disabled={isPending}>
          {isPending ? tCommon("loading") : t("save")}
        </Button>
      </div>
    </form>
  );
}
