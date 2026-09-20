import { defineCollection, reference } from "astro:content";
import { file, glob } from "astro/loaders";
import { z } from "astro/zod";

// El blog ya no es una coleccion de archivos: vive en D1 y se administra desde
// `/panel/contenido/`. Su esquema —el mismo, campo por campo— se mudo a
// `src/lib/frontmatter.ts`, que es donde ahora se valida cada `.md` que alguien
// sube. Aqui no queda nada suyo a proposito: dos definiciones del mismo
// frontmatter acabarian diciendo cosas distintas.

// Cada caso necesita decir que se hizo y que cambio para el cliente. `result`
// es obligatorio a proposito: un caso sin resultado no convence a nadie y no
// deberia poder publicarse.
const work = defineCollection({
  loader: glob({ base: "./src/content/work", pattern: "**/*.md" }),
  schema: ({ image }) =>
    z.object({
      title: z.string().max(70),
      description: z.string().min(70).max(160),
      client: z.string(),
      result: z.string(),
      services: z.array(z.string()).min(1),
      // Solo el año: el mes no aporta nada en un portafolio y envejece peor.
      year: z.number().int().min(2000).max(2100),
      // Sitio del cliente. Se omite cuando el trabajo ya no esta en linea.
      url: z.url().optional(),
      // Controla el orden en la portada, donde el criterio es que caso vende
      // mejor, no cual es mas reciente.
      featured: z.boolean().default(false),
      // Imagen y texto alternativo van juntos para que no pueda publicarse una
      // captura sin `alt`. Es opcional porque un caso puede salir antes que su
      // captura; mientras tanto la tarjeta dibuja el hueco.
      cover: z.object({ src: image(), alt: z.string() }).optional(),
      // El video vive en public/ porque Astro no procesa video ni el loader
      // puede importarlo; el patron evita rutas que apunten fuera de /videos/.
      // El poster si pasa por el build. `caption` es tambien la descripcion
      // accesible.
      video: z
        .object({
          mp4: z.string().regex(/^\/videos\/.+\.mp4$/),
          webm: z.string().regex(/^\/videos\/.+\.webm$/),
          poster: image(),
          caption: z.string(),
        })
        .optional(),
      draft: z.boolean().default(false),
    }),
});

// Los testimonios se transcriben tal cual los escribio cada cliente; solo se
// corrige la ortografia. `work` enlaza al caso cuando existe y `reference`
// hace que el build falle si apunta a uno que no esta, en vez de dejar un
// enlace roto. `order` existe porque getCollection no garantiza el orden.
const testimonials = defineCollection({
  loader: file("./src/content/testimonios.json"),
  schema: z.object({
    order: z.number().int(),
    name: z.string(),
    company: z.string(),
    quote: z.string(),
    work: reference("work").optional(),
  }),
});

export const collections = { work, testimonials };
