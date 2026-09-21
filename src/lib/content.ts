import { getCollection, type CollectionEntry } from "astro:content";
import { navigation } from "../data/site";
import { listarPosts, obtenerPost, type Post } from "./db";
import type { EntradaBlog } from "./frontmatter";

export type { EntradaBlog };

// Filtrar borradores en un solo lugar evita que una pagina nueva los publique
// por olvido. Se filtran siempre, tambien en desarrollo, para que lo que se ve
// al construir sea lo mismo que se publica.

// El blog vive en D1 y los trabajos en archivos, asi que esta capa devuelve las
// dos cosas con la misma forma —`{ id, data }`— y quien las consume no tiene
// que saber de donde salieron. Es lo que permite que `blog/index.astro` y
// `llms.txt.ts` sigan igual que cuando el blog era una coleccion.
const aEntrada = (post: Post): EntradaBlog => ({
  id: post.id,
  data: post.datos,
});

// Ya vienen ordenados por fecha descendente y filtrados por publicado desde la
// consulta: ordenar en SQL evita traer los borradores para descartarlos aqui.
export async function getPublishedPosts(): Promise<EntradaBlog[]> {
  const posts = await listarPosts("blog");
  return posts.map(aEntrada);
}

// El HTML ya viene convertido y saneado desde que se guardo, asi que la pagina
// del articulo solo tiene que pintarlo.
export async function getPostHtml(
  id: string,
): Promise<{ entrada: EntradaBlog; html: string } | null> {
  const post = await obtenerPost(id);
  return post ? { entrada: aEntrada(post), html: post.html } : null;
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

// El enlace al caso sale solo si el caso esta publicado: `reference` garantiza
// que existe, pero no que haya salido de borrador.
export async function getTestimonials() {
  const [testimonials, work] = await Promise.all([
    getCollection("testimonials"),
    getPublishedWork(),
  ]);
  const publishedIds = new Set(work.map((item) => item.id));
  return testimonials
    .sort((a, b) => a.data.order - b.data.order)
    .map(({ data }) => ({
      name: data.name,
      company: data.company,
      // El cargo ya nombra la empresa ("Al frente de Suudai"), asi que la
      // tarjeta enseña uno u otro, nunca los dos: repetir el nombre del negocio
      // dos renglones seguidos se lee como un error.
      role: data.role,
      quote: data.quote,
      href:
        data.work && publishedIds.has(data.work.id)
          ? `/trabajos/${data.work.id}/`
          : undefined,
    }));
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
//
// El blog quedo fuera de esa cuenta al mudarse a D1: el menu se pinta tambien en
// las paginas que se prerenderizan, y esas se compilan sin binding. Su entrada
// se declara disponible en `site.ts`, y si algun dia no queda ningun articulo
// publicado, el indice del blog lo dice en pantalla en vez de desaparecer.
export async function getVisibleNavigation() {
  const work = await getPublishedWork();
  const counts = { work: work.length };

  return navigation.filter((item) =>
    "collection" in item ? counts[item.collection] > 0 : item.available,
  );
}
