// @ts-check
import { defineConfig } from "astro/config";

import cloudflare from "@astrojs/cloudflare";
import tailwindcss from "@tailwindcss/vite";
import sitemap from "@astrojs/sitemap";

// https://astro.build/config
export default defineConfig({
  // El sitemap y las URL canonicas dependen de este valor.
  site: "https://markidev.com",


  // Una sola forma canonica de cada URL. Sin esto Cloudflare responde 307 al

  // entrar sin la barra final y las señales de enlace se parten en dos URLs.

  trailingSlash: "always",

  adapter: cloudflare(),

  vite: {
    plugins: [tailwindcss()],
  },

  integrations: [sitemap()],
});
