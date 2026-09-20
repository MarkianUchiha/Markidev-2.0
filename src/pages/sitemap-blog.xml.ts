import type { APIRoute } from "astro";
import { getPublishedPosts } from "../lib/content";

// `@astrojs/sitemap` arma su indice con las rutas que conoce al compilar. Los
// articulos dejaron de estar entre ellas al mudarse a D1, asi que si no se
// listaran aqui simplemente desaparecerian de los buscadores: el sitemap
// seguiria existiendo, completo en apariencia, y sin una sola URL del blog.
//
// Este archivo cubre solo el blog. El resto del sitio sigue saliendo del
// sitemap generado en el build, y `robots.txt` anuncia los dos.
export const prerender = false;

const SITIO = "https://markidev.com";

const escapar = (texto: string) =>
  texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

export const GET: APIRoute = async () => {
  const posts = await getPublishedPosts();

  const urls = posts.map((post) => {
    // Google usa `lastmod` para decidir si vuelve a rastrear. Si se mandara
    // siempre la fecha de publicacion, una correccion pasaria inadvertida.
    const modificado = post.data.updatedDate ?? post.data.pubDate;
    return [
      "  <url>",
      `    <loc>${escapar(`${SITIO}/blog/${post.id}/`)}</loc>`,
      `    <lastmod>${modificado.toISOString()}</lastmod>`,
      "  </url>",
    ].join("\n");
  });

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls,
    "</urlset>",
  ].join("\n");

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=60, stale-while-revalidate=600",
    },
  });
};
