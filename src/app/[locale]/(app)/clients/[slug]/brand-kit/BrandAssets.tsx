"use client";

import { useRef, useTransition, type ChangeEvent } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { Pill } from "@/components/ui/Pill";
import {
  deleteBrandAssetAction,
  uploadBrandAssetAction,
} from "./actions";

export type BrandAssetListItem = {
  id: string;
  kind: string;
  label: string | null;
  storage_path: string;
  mime_type: string | null;
  publicUrl: string;
};

export function BrandAssets({
  locale,
  clientId,
  clientSlug,
  assets,
}: {
  locale: string;
  clientId: string;
  clientSlug: string;
  assets: BrandAssetListItem[];
}) {
  const t = useTranslations("brandKit");
  const fileRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.set("file", file);
    fd.set("clientId", clientId);
    fd.set("clientSlug", clientSlug);
    fd.set("locale", locale);
    startTransition(() => uploadBrandAssetAction(fd));
    event.target.value = "";
  }

  function onRemove(id: string) {
    const fd = new FormData();
    fd.set("id", id);
    fd.set("clientSlug", clientSlug);
    fd.set("locale", locale);
    startTransition(() => deleteBrandAssetAction(fd));
  }

  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-xl">{t("sections.assets")}</h2>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={isPending}
            className="text-sm text-muted-foreground hover:text-foreground disabled:opacity-50"
          >
            + {t("actions.uploadAsset")}
          </button>
          <input
            ref={fileRef}
            type="file"
            onChange={onFileChange}
            accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
            className="hidden"
            data-testid="brand-asset-file"
          />
        </div>
      </div>

      {assets.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {t("sections.assetsEmpty")}
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {assets.map((asset) => (
            <figure
              key={asset.id}
              className="group overflow-hidden rounded-md border border-border bg-card"
              data-testid="brand-asset-card"
            >
              <div className="relative aspect-square bg-muted">
                {asset.mime_type?.startsWith("image/") ? (
                  <Image
                    src={asset.publicUrl}
                    alt={asset.label ?? ""}
                    fill
                    sizes="(max-width: 768px) 50vw, 25vw"
                    className="object-cover"
                    unoptimized={asset.mime_type === "image/svg+xml"}
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                    {asset.mime_type ?? "file"}
                  </div>
                )}
              </div>
              <figcaption className="flex items-center justify-between gap-2 px-2 py-1.5">
                <Pill tone="muted" className="text-[10px] capitalize">
                  {asset.kind}
                </Pill>
                <button
                  type="button"
                  onClick={() => onRemove(asset.id)}
                  disabled={isPending}
                  className="text-xs text-muted-foreground hover:text-destructive disabled:opacity-50"
                  aria-label={t("actions.removeAsset")}
                >
                  ×
                </button>
              </figcaption>
            </figure>
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground">{t("assets.hint")}</p>
    </section>
  );
}
