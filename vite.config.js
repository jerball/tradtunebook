import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "apple-touch-icon.png"],
      manifest: {
        name: "Trad Tune Book",
        short_name: "Tune Book",
        description: "A personal tunebook for Irish traditional music",
        theme_color: "#1a1814",
        background_color: "#f4ede0",
        display: "standalone",
        start_url: "/",
        icons: [
          { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" }
        ]
      },
      workbox: {
        runtimeCaching: [
          {
            // thesession.org API — cache responses so lookups work offline after first hit
            urlPattern: /^https:\/\/thesession\.org\/.*format=json.*/,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "session-org-api",
              expiration: { maxEntries: 500, maxAgeSeconds: 60 * 60 * 24 * 30 }
            }
          },
          {
            // thesession.org data dump on GitHub (aliases file)
            urlPattern: /^https:\/\/raw\.githubusercontent\.com\/adactio\/TheSession-data\/.*/,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "session-org-data",
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 7 }
            }
          }
        ]
      }
    })
  ],
  server: {
    port: 5173
  },
  build: {
    target: "es2020",
    sourcemap: true
  }
});
