import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import tailwindcss from "@tailwindcss/vite";

/**
 * Public mount point. `/` locally and on Netlify; `/mushak/` when the app runs
 * behind the unified container's router next to Lokkhi.
 */
const base = process.env.MUSHAK_BASE_PATH ?? "/";

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg"],
      manifest: {
        name: "Mushak",
        short_name: "Mushak",
        description: "Inventory management for small merchants",
        start_url: base,
        scope: base,
        display: "standalone",
        background_color: "#ffffff",
        theme_color: "#000000",
        icons: [
          {
            src: `${base}icon.svg`,
            sizes: "any",
            type: "image/svg+xml",
          },
        ],
      },
      workbox: {
        // Keep new deploys from getting stuck behind an old cached shell.
        clientsClaim: true,
        skipWaiting: true,
        // On the combined Vercel deployment Mushak is served at `/` and Lokkhi
        // at `/lokkhi/` on the same origin. Exclude Lokkhi navigations so the
        // root-scoped SW never hijacks or serves stale responses for it.
        navigateFallbackDenylist: [/^\/lokkhi/],
      },
    }),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:8080",
        changeOrigin: true,
      },
    },
  },
  // `npm run prod-env:mushak` serves the built app with this config, so the
  // production bundle gets the same /api proxy as the dev server.
  preview: {
    host: "0.0.0.0",
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": {
        target: "http://localhost:8080",
        changeOrigin: true,
      },
    },
  },
});
