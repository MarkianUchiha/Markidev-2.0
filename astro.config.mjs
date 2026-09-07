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
  // Google. El subconjunto latin ya trae acentos, ñ y los signos de apertura.
  //
  // De Space Grotesk solo se usa el peso 700 (logo, titulares y los numeros del
  // proceso); pedir 500 y 600 seria peso muerto.
  fonts: [
    {
      name: "Space Grotesk",
      cssVariable: "--font-space-grotesk",
      provider: fontProviders.fontsource(),
      weights: [700],
      styles: ["normal"],
      subsets: ["latin"],
    },
    {
      name: "IBM Plex Sans",
      cssVariable: "--font-ibm-plex-sans",
      provider: fontProviders.fontsource(),
      weights: [400, 500, 600],
      styles: ["normal", "italic"],
      subsets: ["latin"],
    },
  ],

  vite: {
    plugins: [tailwindcss()],
  },

  integrations: [sitemap()],
});
