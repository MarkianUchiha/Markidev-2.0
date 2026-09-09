// @ts-check
import { defineConfig, fontProviders } from "astro/config";

import cloudflare from "@astrojs/cloudflare";
import tailwindcss from "@tailwindcss/vite";
import sitemap from "@astrojs/sitemap";
import react from "@astrojs/react";

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
  // Poppins sustituye a Century Gothic, que es de Monotype y no se puede
  // incrustar sin licencia. Comparte su construccion geometrica y circular, y a
  // diferencia de Questrial —la mas parecida en proporciones— si tiene un bold
  // de verdad, que es lo que exigen los titulares.
  //
  // De Poppins solo se usa el 700 (logo, titulares y los numeros del proceso);
  // pedir 500 y 600 seria peso muerto. De Crimson Pro solo la cursiva, que es la
  // unica forma en que aparece: citas y frases destacadas.
  fonts: [
    {
      name: "Poppins",
      cssVariable: "--font-poppins",
      provider: fontProviders.fontsource(),
      weights: [700],
      styles: ["normal"],
      subsets: ["latin"],
    },
    {
      name: "Open Sans",
      cssVariable: "--font-open-sans",
      provider: fontProviders.fontsource(),
      weights: [400, 500, 600],
      styles: ["normal", "italic"],
      subsets: ["latin"],
    },
    {
      name: "Crimson Pro",
      cssVariable: "--font-crimson-pro",
      provider: fontProviders.fontsource(),
      weights: [400],
      styles: ["italic"],
      subsets: ["latin"],
    },
  ],

  vite: {
    plugins: [tailwindcss()],
  },

  // React vive solo dentro de /panel. El sitio publico no carga ni un byte suyo:
  // las islas se declaran pagina por pagina, no globalmente.
  integrations: [
    sitemap({
      // El panel es privado. Aunque se renderiza bajo demanda y no deberia
      // llegar al sitemap, el filtro lo garantiza sin depender de ese detalle.
      filter: (pagina) => !pagina.includes("/panel"),
    }),
    react(),
  ],
});
