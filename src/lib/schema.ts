import type { CollectionEntry } from "astro:content";
import { site, socialLinks } from "../data/site";

// Datos estructurados. No los lee ningun visitante: los leen Google y los
// asistentes que responden citando fuentes, y de ahi sale la ficha con la que
// el sitio aparece en un resultado o en una respuesta.
//
// Todo se arma aqui y no suelto en cada plantilla porque las entidades se
// referencian entre si por `@id`: si la URL del negocio se escribe a mano en
// cinco archivos, basta con que una difiera para que Google vea dos negocios
// distintos en vez de uno.

const SITIO = "https://markidev.com";

// Identificadores estables. El fragmento no apunta a nada del HTML: es la forma
// que tiene Schema.org de decir "esta es la misma entidad de la que hable en la
// otra pagina". Cambiarlos parte el grafo en pedazos sueltos.
export const ID_NEGOCIO = `${SITIO}/#negocio`;
export const ID_PERSONA = `${SITIO}/#marco`;

type Miga = { nombre: string; url: string };

// Solo la fecha, sin hora. `pubDate` nace de un "2026-09-09" del frontmatter,
// que JavaScript interpreta como medianoche UTC; escrito con `toISOString()`
// eso son las 18:00 del dia ANTERIOR en Ciudad de Mexico, y un rastreador que
// ajuste a la zona local vería el articulo publicado un dia antes. El esquema
// acepta la fecha sola, que ademas es lo unico que se sabe de verdad.
function soloFecha(fecha: Date): string {
  return fecha.toISOString().slice(0, 10);
}

/**
 * El negocio. Va en todas las paginas con el mismo `@id` para que las fichas de
 * articulo y de perfil puedan colgarse de el.
 *
 * Es `Organization` y no `ProfessionalService`, que seria el tipo mas especifico
 * para un estudio: `ProfessionalService` hereda de `LocalBusiness` y eso obliga
 * a una direccion fisica y a un area de servicio local. El sitio dejo de
 * anunciarse por ciudad a proposito, asi que declararlo seria contradecir la
 * decision y encima quedar incompleto.
 */
export function negocio() {
  return {
    "@type": "Organization",
    "@id": ID_NEGOCIO,
    name: site.name,
    url: `${SITIO}/`,
    description:
      "Estudio independiente de automatizacion y digitalizacion de negocios: sistemas a medida, puntos de venta, pedidos por WhatsApp y sitios web.",
    email: site.email,
    logo: {
      "@type": "ImageObject",
      url: `${SITIO}/apple-touch-icon.png`,
      width: 180,
      height: 180,
    },
    image: `${SITIO}/og-markidev.png`,
    founder: { "@id": ID_PERSONA },
    areaServed: [
      { "@type": "Country", name: "México" },
      { "@type": "Place", name: "Latinoamérica" },
    ],
    // Solo los perfiles del negocio. Es la misma lista que el pie, que ya deja
    // fuera los personales a proposito.
    sameAs: socialLinks.map((red) => red.url),
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "sales",
      email: site.email,
      url: `${SITIO}/contacto/`,
      availableLanguage: ["es"],
    },
  };
}

/** Marco. Se define una vez y las paginas la referencian por `@id`. */
export function persona() {
  return {
    "@type": "Person",
    "@id": ID_PERSONA,
    name: site.author,
    url: `${SITIO}/sobre-mi/`,
    email: site.email,
    worksFor: { "@id": ID_NEGOCIO },
    sameAs: socialLinks.map((red) => red.url),
  };
}

/** `/sobre-mi` no es un articulo sobre Marco: es la pagina que *es* su perfil. */
export function paginaDePerfil() {
  return {
    "@type": "ProfilePage",
    "@id": `${SITIO}/sobre-mi/#pagina`,
    url: `${SITIO}/sobre-mi/`,
    mainEntity: { "@id": ID_PERSONA },
  };
}

/**
 * Un articulo del blog.
 *
 * `dateModified` cae en `pubDate` cuando no hay fecha de actualizacion: Google
 * lo pide y omitirlo vale menos que repetir la de publicacion, que ademas es
 * cierta.
 */
export function articulo(post: CollectionEntry<"blog">) {
  const url = `${SITIO}/blog/${post.id}/`;
  return {
    "@type": "BlogPosting",
    "@id": `${url}#articulo`,
    headline: post.data.title,
    description: post.data.description,
    datePublished: soloFecha(post.data.pubDate),
    dateModified: soloFecha(post.data.updatedDate ?? post.data.pubDate),
    author: { "@id": ID_PERSONA },
    publisher: { "@id": ID_NEGOCIO },
    inLanguage: "es-MX",
    keywords: post.data.tags,
    mainEntityOfPage: url,
  };
}

/**
 * Un caso de `/trabajos`.
 *
 * Se marca como `Article` y no como `CreativeWork` —que describiria mejor "un
 * trabajo hecho"— porque lo que la pagina contiene es el relato del proyecto, y
 * `Article` es lo que los buscadores saben leer. El trabajo en si vive en
 * `about`, con el cliente y el año.
 */
export function caso(item: CollectionEntry<"work">) {
  const url = `${SITIO}/trabajos/${item.id}/`;
  return {
    "@type": "Article",
    "@id": `${url}#caso`,
    headline: item.data.title,
    description: item.data.description,
    author: { "@id": ID_PERSONA },
    publisher: { "@id": ID_NEGOCIO },
    inLanguage: "es-MX",
    mainEntityOfPage: url,
    about: {
      "@type": "Organization",
      name: item.data.client,
      ...(item.data.url ? { url: item.data.url } : {}),
    },
    // El año es lo unico que se sabe con certeza: el esquema de la coleccion no
    // guarda mes a proposito.
    temporalCoverage: String(item.data.year),
    keywords: item.data.services,
  };
}

/**
 * La ruta de migas. Se declara aunque en pantalla no haya migas dibujadas: esto
 * le dice al buscador donde cuelga la pagina, y es lo que enseña como ruta
 * debajo del titulo en un resultado.
 */
export function migas(items: Miga[]) {
  return {
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.nombre,
      item: `${SITIO}${item.url}`,
    })),
  };
}

/**
 * Envuelve las entidades en un solo `@graph`.
 *
 * Un unico bloque con todo, en vez de varios `<script>` sueltos: asi las
 * referencias por `@id` se resuelven dentro del mismo documento y no dependen
 * de que el rastreador junte piezas por su cuenta.
 */
export function grafo(entidades: object[]) {
  // El `<` se escapa aunque el contenido salga del propio repositorio: basta un
  // titulo que contenga "</script>" para cerrar el bloque antes de tiempo y
  // volcar el resto del JSON como HTML. Es barato y cubre el dia en que el
  // contenido deje de venir de un .md y venga de D1.
  return JSON.stringify({
    "@context": "https://schema.org",
    "@graph": entidades,
  }).replace(/</g, "\\u003c");
}
