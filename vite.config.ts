// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
//
// The wrapper's own nitro invocation is disabled (`nitro: false`) — the locked
// version resolves to its "cloudflare-module" default instead of honoring an
// explicit preset in some environments (e.g. fresh CI installs), which shipped
// a broken production build. We call `nitro/vite` directly instead, gated to
// build only, so the preset is never ambiguous.
import { defineConfig as defineViteConfig } from "vite";
import { defineConfig as defineLovableConfig } from "@lovable.dev/vite-tanstack-config";
import { nitro } from "nitro/vite";

export default defineViteConfig(async (env) => {
  const config = await defineLovableConfig({
    tanstackStart: {
      server: { entry: "server" },
    },
    // Honored at runtime but absent from the wrapper's published option type.
    // Remove this directive once the type includes `nitro` — TS will flag it
    // as unused at that point.
    // @ts-expect-error -- see note above
    nitro: false,
  })(env);

  if (env.command === "build") {
    config.plugins = [
      ...(config.plugins ?? []),
      nitro({
        preset: "vercel",
        output: {
          dir: ".vercel/output",
          serverDir: ".vercel/output/functions/__server.func",
          publicDir: ".vercel/output/static",
        },
      }),
    ];
  }

  return config;
});
