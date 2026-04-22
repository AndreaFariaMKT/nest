// Pure helpers for brand asset uploads — I/O-free so they're unit-testable.

export const ALLOWED_MIMES = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/svg+xml",
] as const;

export const MAX_ASSET_BYTES = 5 * 1024 * 1024; // 5 MB — matches storage.buckets

export type BrandAssetKind =
  | "logo"
  | "photo"
  | "illustration"
  | "svg"
  | "font";

export type AssetValidation =
  | { ok: true }
  | { ok: false; error: "tooLarge" | "invalidMime" };

export function isAllowedMimeType(mime: string): boolean {
  return (ALLOWED_MIMES as readonly string[]).includes(mime);
}

export function detectAssetKind(
  fileName: string,
  mimeType: string,
): BrandAssetKind {
  const lower = fileName.toLowerCase();
  if (mimeType === "image/svg+xml" || lower.endsWith(".svg")) return "svg";
  if (lower.includes("logo")) return "logo";
  if (mimeType.startsWith("font/")) return "font";
  if (mimeType.startsWith("image/")) return "photo";
  return "photo";
}

export function buildAssetPath(kitId: string, fileName: string): string {
  const ts = Date.now();
  const ext =
    (fileName.split(".").pop() ?? "bin").toLowerCase().replace(/[^a-z0-9]/g, "") ||
    "bin";
  const rawBase = fileName.replace(/\.[^.]+$/, "");
  const base =
    rawBase
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "asset";
  return `${kitId}/${ts}-${base}.${ext}`;
}

export function validateAssetFile(file: {
  size: number;
  type: string;
}): AssetValidation {
  if (file.size > MAX_ASSET_BYTES) return { ok: false, error: "tooLarge" };
  if (!isAllowedMimeType(file.type)) return { ok: false, error: "invalidMime" };
  return { ok: true };
}
