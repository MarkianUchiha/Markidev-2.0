import { defineCollection, z } from 'astro:content';

// Definir el esquema para la colección de trabajos
export const collections = {
  trabajos: defineCollection({
    type: 'data',
    schema: z.object({
      title: z.string(),
      description: z.string(),
      image: z.string(),
      tags: z.array(z.string()),
    }),
  }),
};
