import { getCollection, type CollectionEntry } from "astro:content";
import { navigation } from "../data/site";

// Filtrar borradores en un solo lugar evita que una pagina nueva los publique
// por olvido. Se filtran siempre, tambien en desarrollo, para que lo que se ve
// al construir sea lo mismo que se publica.

export async function getPublishedPosts(): Promise<CollectionEntry<"blog">[]> {
  const posts = await getCollection("blog", ({ data }) => !data.draft);
  return posts.sort(
    (a, b) => b.data.pubDate.getTime() - a.data.pubDate.getTime(),
  );
}

export async function getPublishedWork(): Promise<CollectionEntry<"work">[]> {
  const work = await getCollection("work", ({ data }) => !data.draft);
  // Primero los destacados y despues por año descendente: en un portafolio manda
  // que caso vende mejor, no cual es mas reciente.
  return work.sort((a, b) => {
    if (a.data.featured !== b.data.featured) return a.data.featured ? -1 : 1;
    return b.data.year - a.data.year;
  });
}

// Fecha larga en español para las entradas del blog. `timeZone` fija el dia:
// sin ella una fecha sin hora se interpreta en UTC y puede mostrarse un dia antes.
export function formatDate(date: Date): string {
  return date.toLocaleDateString("es-MX", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

// Resuelve que entradas del menu se muestran. Las que dependen de una coleccion
// aparecen cuando esa coleccion ya tiene algo publicado.
export async function getVisibleNavigation() {
  const [posts, work] = await Promise.all([getPublishedPosts(), getPublishedWork()]);
  const counts = { blog: posts.length, work: work.length };

  return navigation.filter((item) =>
    "collection" in item ? counts[item.collection] > 0 : item.available,
  );
}
