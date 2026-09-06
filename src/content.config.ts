import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

// Los articulos nacen de preguntas que los clientes hacen de verdad, asi que
// `question` guarda esa pregunta tal cual se formula. El titulo puede diferir
// para que funcione como encabezado, pero la pregunta literal es la que se
// reutiliza en el marcado FAQ que leen los buscadores y los asistentes de IA.
const blog = defineCollection({
  loader: glob({ base: "./src/content/blog", pattern: "**/*.md" }),
  schema: z.object({
    title: z.string().max(70),
    // Se convierte en la meta description; fuera de este rango Google la recorta
    // o la sustituye por texto suyo.
    description: z.string().min(70).max(160),
    question: z.string().optional(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    // Permite dejar borradores en el repositorio sin que lleguen al sitio.
    draft: z.boolean().default(false),
    tags: z.array(z.string()).default([]),
  }),
});

// Cada caso necesita decir que se hizo y que cambio para el cliente. `result`
// es obligatorio a proposito: un caso sin resultado no convence a nadie y no
// deberia poder publicarse.
const work = defineCollection({
  loader: glob({ base: "./src/content/work", pattern: "**/*.md" }),
  schema: z.object({
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
    draft: z.boolean().default(false),
  }),
});

export const collections = { blog, work };
