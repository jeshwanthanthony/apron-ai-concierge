// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  // Force-enable the Nitro build off-Lovable (the plugin otherwise skips it
  // outside Lovable's sandbox, which breaks `vite build`). This targets
  // Cloudflare Workers and emits a deployable bundle in `dist/` with a
  // generated wrangler config. Override the target with NITRO_PRESET if needed
  // (e.g. `cloudflare-pages` for a Pages/Git deploy).
  nitro: { preset: "cloudflare-module" },
});

