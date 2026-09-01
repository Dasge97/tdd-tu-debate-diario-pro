import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: "/app/",
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) }
  },
  server: {
    port: 5173,
    proxy: {
      "/api": { target: "http://localhost:3000", changeOrigin: true },
      "/uploads": { target: "http://localhost:3000", changeOrigin: true }
    }
  },
  plugins: [
    vue(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "apple-touch-icon.png"],
      manifest: {
        id: "/app/",
        name: "TuDebateDiario",
        short_name: "TDD",
        description:
          "Cinco debates de actualidad cada día. Vota tu posición, comenta y debate con la comunidad.",
        lang: "es",
        dir: "ltr",
        start_url: "/app/",
        scope: "/app/",
        display: "standalone",
        orientation: "portrait",
        background_color: "#f3f1ed",
        theme_color: "#fffdf9",
        categories: ["news", "social"],
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "icons/icon-512-maskable.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable"
          }
        ],
        shortcuts: [
          { name: "Debates de hoy", url: "/app/", icons: [{ src: "icons/icon-192.png", sizes: "192x192" }] },
          { name: "Buscar", url: "/app/buscar" },
          { name: "Mensajes", url: "/app/mensajes" }
        ]
      },
      workbox: {
        navigateFallback: "/app/index.html",
        navigateFallbackDenylist: [/^\/api/, /^\/uploads/, /^\/legal/, /^\/soporte/],
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith("/uploads/"),
            handler: "CacheFirst",
            options: {
              cacheName: "tdd-uploads",
              expiration: { maxEntries: 120, maxAgeSeconds: 60 * 60 * 24 * 30 }
            }
          },
          {
            urlPattern: ({ url }) => url.pathname.startsWith("/api/v1/debates"),
            handler: "NetworkFirst",
            options: {
              cacheName: "tdd-debates",
              networkTimeoutSeconds: 4,
              expiration: { maxEntries: 80, maxAgeSeconds: 60 * 60 * 6 }
            }
          }
        ]
      }
    })
  ]
});
