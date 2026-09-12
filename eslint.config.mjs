import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";

// eslint-config-next 15 still ships the legacy .eslintrc format and ESLint 9
// reads only flat config, so FlatCompat bridges the two. That is Next's own
// documented path, not a workaround for anything here.
//
// There was no ESLint config in this repo at all. `npm run lint` ran
// `next lint`, which found nothing to read and dropped into its interactive
// "how would you like to configure ESLint?" prompt — so the lint step was
// unrunnable in CI, and ci.yml carried a TODO saying so.
const compat = new FlatCompat({
  baseDirectory: dirname(fileURLToPath(import.meta.url)),
});

export default [
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "coverage/**",
      "playwright-report/**",
      "test-results/**",
      // Both generated and both saying so in their own first lines: one from
      // the live database schema, one by `next dev`.
      "src/types/database.gen.ts",
      "next-env.d.ts",
    ],
  },

  ...compat.extends("next/core-web-vitals", "next/typescript"),

  {
    rules: {
      // Off, because this app has no `pages/` directory. The rule compares an
      // internal href against the files in it and, finding none, flags every
      // one — including `<a href="/api/google/auth">`, which is an API route
      // and MUST be a real navigation: the OAuth redirect is the point, and a
      // client-side <Link> would never leave the app.
      "@next/next/no-html-link-for-pages": "off",

      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          // `const { tenant_id, ...editable } = row` is how this codebase drops
          // columns a caller must not write. The names being unused is the
          // whole technique.
          ignoreRestSiblings: true,
          // An underscore is the established way to say "required by the
          // signature, deliberately unused" — server actions whose first
          // argument is the previous form state do it throughout.
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },

  {
    // The config file's own default export has no name to give it.
    files: ["eslint.config.mjs"],
    rules: { "import/no-anonymous-default-export": "off" },
  },
];
