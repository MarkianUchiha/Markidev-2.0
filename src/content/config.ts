import { defineCollection, z } from 'astro:content';

// Esquema existente para trabajos
const trabajos = defineCollection({
  type: 'data',
  schema: z.object({
    title: z.string(),
    description: z.string(),
    image: z.string(),
    images: z.array(z.string()).default([]),
    tags: z.array(z.string()),
    fecha: z.string(),
    url: z.string(),
    cliente: z.string(),
  }),
});

// Nueva colección para el blog
const blog = defineCollection({
  type: 'content', // Nota: 'content' porque son archivos markdown
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.date(),
    author: z.string(),
    image: z.string().optional(),
    tags: z.array(z.string()).optional(),
    draft: z.boolean().default(false),
  }),
});

// Exportar ambas colecciones
export const collections = { 
  trabajos,
  blog 
};