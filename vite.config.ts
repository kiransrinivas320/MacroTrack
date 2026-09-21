import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),

    VitePWA({
      registerType: "autoUpdate",

      manifest: {
        name: "MacroTrack",
        short_name: "MacroTrack",
        description: "Track your food, macros, calories, and spending.",
        theme_color: "#111827",
        background_color: "#111827",
        display: "standalone",
        start_url: "/MacroTrack/",
        scope: "/MacroTrack/",
        icons: [
          {
            src: "/MacroTrack/pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/MacroTrack/pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
          },
        ],
      },
    }),
  ],

  base: "/MacroTrack/",
});