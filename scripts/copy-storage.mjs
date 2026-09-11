#!/usr/bin/env node
/**
 * Copy Storage objects from one Supabase project to another.
 *
 * The database dump carries the `storage.buckets` ROWS — the migrations create
 * them with `insert into storage.buckets`, so they restore with the schema.
 * It does not carry the FILES. Without this, every brand logo, every rendered
 * carousel and every reel in the app resolves to a 404 against a bucket that
 * exists and is empty, which looks like the app broke rather than like the
 * migration is unfinished.
 *
 * Resumable on purpose: it skips an object already present at the destination
 * with the same size. A 500 MB video bucket over a domestic connection will be
 * interrupted, and the answer to that has to be "run it again", not "start
 * over".
 *
 *   OLD_URL=... OLD_SERVICE_KEY=... \
 *   NEW_URL=... NEW_SERVICE_KEY=... \
 *   node scripts/copy-storage.mjs [--dry-run]
 */
import { createClient } from "@supabase/supabase-js";

const need = (n) => {
  const v = process.env[n];
  if (!v) {
    console.error(`Falta a variável ${n}.`);
    process.exit(1);
  }
  return v;
};

const DRY = process.argv.includes("--dry-run");

const from = createClient(need("OLD_URL"), need("OLD_SERVICE_KEY"), {
  auth: { persistSession: false },
});
const to = createClient(need("NEW_URL"), need("NEW_SERVICE_KEY"), {
  auth: { persistSession: false },
});

/**
 * The three buckets and their settings, mirrored from the migrations that
 * create them (002, 005/035, 011). Used only when the destination bucket is
 * missing — normally the dump already restored the row, and then these values
 * are not consulted at all.
 */
const BUCKETS = [
  {
    id: "brand-assets",
    public: true,
    fileSizeLimit: 5242880,
    allowedMimeTypes: [
      "image/png",
      "image/jpeg",
      "image/gif",
      "image/webp",
      "image/svg+xml",
    ],
  },
  {
    id: "creatives",
    public: true,
    fileSizeLimit: 10485760,
    // 035 widened this to accept what a designer exports, not only what the
    // renderer emits.
    allowedMimeTypes: ["image/png", "image/jpeg"],
  },
  {
    id: "reel-videos",
    public: true,
    fileSizeLimit: 524288000,
    allowedMimeTypes: ["video/mp4", "video/quicktime", "video/webm"],
  },
];

/**
 * List every object under a bucket.
 *
 * Storage's `list` is per-prefix and paginated, and a folder is not a real
 * object — it comes back as an entry with no `id`. So this recurses on those
 * and pages through the rest.
 */
async function walk(client, bucket, prefix = "", out = []) {
  const PAGE = 100;
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await client.storage
      .from(bucket)
      .list(prefix, { limit: PAGE, offset, sortBy: { column: "name", order: "asc" } });

    if (error) throw new Error(`list ${bucket}/${prefix}: ${error.message}`);
    if (!data || data.length === 0) break;

    for (const entry of data) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.id === null) {
        await walk(client, bucket, path, out);
      } else {
        out.push({ path, size: entry.metadata?.size ?? 0, mime: entry.metadata?.mimetype });
      }
    }
    if (data.length < PAGE) break;
  }
  return out;
}

async function ensureBucket(spec) {
  const { data } = await to.storage.getBucket(spec.id);
  if (data) return "existe";
  if (DRY) return "criaria";
  const { error } = await to.storage.createBucket(spec.id, {
    public: spec.public,
    fileSizeLimit: spec.fileSizeLimit,
    allowedMimeTypes: spec.allowedMimeTypes,
  });
  if (error) throw new Error(`createBucket ${spec.id}: ${error.message}`);
  return "criado";
}

const mb = (n) => (n / 1048576).toFixed(1);

async function main() {
  console.log(DRY ? "SIMULAÇÃO — nada será gravado.\n" : "Copiando arquivos.\n");

  let copied = 0;
  let skipped = 0;
  let failed = 0;
  let bytes = 0;

  for (const spec of BUCKETS) {
    const objects = await walk(from, spec.id);

    // Nada para copiar: não criamos o bucket. Ele vem no dump do banco — as
    // migrations o criam com `insert into storage.buckets` — então criá-lo
    // aqui é trabalho redundante que só serve para falhar.
    if (objects.length === 0) {
      console.log(`${spec.id} — vazio na origem, nada a fazer`);
      continue;
    }

    const state = await ensureBucket(spec);
    const total = objects.reduce((s, o) => s + o.size, 0);

    console.log(
      `${spec.id} — bucket ${state} · ${objects.length} arquivo(s) · ${mb(total)} MB`,
    );

    // What the destination already holds, so a re-run resumes instead of
    // re-uploading everything.
    const there = new Map(
      (await walk(to, spec.id).catch(() => [])).map((o) => [o.path, o.size]),
    );

    for (const obj of objects) {
      if (there.get(obj.path) === obj.size) {
        skipped += 1;
        continue;
      }
      if (DRY) {
        console.log(`   copiaria ${obj.path} (${mb(obj.size)} MB)`);
        copied += 1;
        continue;
      }

      try {
        const dl = await from.storage.from(spec.id).download(obj.path);
        if (dl.error) throw new Error(dl.error.message);

        const up = await to.storage
          .from(spec.id)
          .upload(obj.path, dl.data, {
            contentType: obj.mime || "application/octet-stream",
            // A partial file from an interrupted run must be replaced, not
            // refused — that is what makes re-running safe.
            upsert: true,
          });
        if (up.error) throw new Error(up.error.message);

        copied += 1;
        bytes += obj.size;
        process.stdout.write(`   ${copied} copiados\r`);
      } catch (e) {
        failed += 1;
        console.error(`   FALHOU ${spec.id}/${obj.path}: ${e.message}`);
      }
    }
    console.log("");
  }

  console.log(
    `\ncopiados ${copied} · já existiam ${skipped} · falhas ${failed} · ${mb(bytes)} MB`,
  );

  if (failed > 0) {
    console.error(
      "\nHouve falhas. Rode de novo: o que já foi copiado é pulado.",
    );
    process.exit(1);
  }
  console.log("Storage completo.");
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
