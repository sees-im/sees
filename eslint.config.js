import js from "@eslint/js";
import eslintPluginPrettier from "eslint-plugin-prettier/recommended";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  // Build output and machine-generated sources. Without `.vercel`/`.wrangler`
  // here, eslint lints the whole bundled app (megabytes of emitted .mjs) and
  // eslint-plugin-prettier flags every line of it.
  {
    ignores: [
      "dist",
      ".output",
      ".vinxi",
      ".vercel",
      ".wrangler",
      "src/routeTree.gen.ts",
      "src/lib/currencyIcons.generated.ts",
    ],
  },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "server-only",
              message:
                "TanStack Start does not use the Next.js `server-only` package. Rename the module to `*.server.ts` or mark it with `@tanstack/react-start/server-only`.",
            },
          ],
        },
      ],
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
  {
    // `*.server.ts` files are server-only modules, not React. TanStack Start's
    // `useSession` helper trips the hooks rule purely on its `use` prefix.
    files: ["**/*.server.ts"],
    rules: { "react-hooks/rules-of-hooks": "off" },
  },
  eslintPluginPrettier,
);
