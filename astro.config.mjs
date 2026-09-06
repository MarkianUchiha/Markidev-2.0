// @ts-check
import { defineConfig, fontProviders } from "astro/config";

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

  // Astro baja los archivos durante el build y los sirve desde el propio
  // dominio: ni una peticion a un tercero, ni la IP del visitante viajando a
  // Google. El subconjunto latin ya trae acentos, ñ y los signos de apertura,
  // asi que latin-ext solo agregaria peso muerto.
  fonts: [
    {
      name: "Inter",
      cssVariable: "--font-inter",
      provider: fontProviders.fontsource(),
      weights: [400, 600],
      styles: ["normal", "italic"],
      subsets: ["latin"],
    },
  ],

  vite: {
    plugins: [tailwindcss()],
  },

  integrations: [sitemap()],
});
