// @ts-check
import { defineConfig } from "astro/config";

import cloudflare from "@astrojs/cloudflare";
import tailwindcss from "@tailwindcss/vite";
import sitemap from "@astrojs/sitemap";

// https://astro.build/config
export default defineConfig({
  // El sitemap y las URL canonicas dependen de este valor.
  site: "https://markidev.com",

  adapter: cloudflare(),

  vite: {
    plugins: [tailwindcss()],
  },

  integrations: [sitemap()],
});
