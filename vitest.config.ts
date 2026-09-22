import { defineConfig } from "vitest/config";

// Sin `getViteConfig` de Astro a proposito: lo que se prueba son funciones puras
// de `src/lib/`, que no tocan D1 ni modulos virtuales de Astro. Cargar el
// adaptador de Cloudflare solo para correrlas haria el arranque mas lento y
// ataria los tests a workerd. Lo que dependa de la base se prueba en el panel.
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
