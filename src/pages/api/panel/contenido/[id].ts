import type { APIRoute } from "astro";
import { obtenerPost, alternarPublicado, borrarPost } from "../../../../lib/db";
import { aMarkdown } from "../../../../lib/frontmatter";
import { redirigir } from "../../../../lib/redireccion";

export const prerender = false;

/**
 * Baja el `.md`. Es la contraparte de subirlo: sin esto, corregir un articulo
 * obligaria a reescribirlo desde cero, porque el repositorio ya no lo tiene.
 *
 * No devuelve el archivo original byte a byte —las fechas se normalizan— pero al
 * volver a subirlo produce los mismos datos.
 */
export const GET: APIRoute = async ({ params, locals }) => {
  if (!locals.usuario) {
    return new Response("No autorizado.", { status: 401 });
  }

  const id = params.id;
  // `soloPublicado: false`: desde el panel se baja tambien un borrador, que es
  // justo el que se esta trabajando.
  const post = id ? await obtenerPost(id, { soloPublicado: false }) : null;
  if (!post) return new Response("No encontrado.", { status: 404 });

  return new Response(aMarkdown(post.datos, post.cuerpo), {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${post.id}.md"`,
    },
  });
};

/**
 * Publicar, ocultar o borrar. Van los tres por POST y no por PATCH/DELETE
 * porque el panel usa formularios nativos —sin isla de React, que aqui no hace
 * falta— y un formulario solo sabe hacer GET y POST.
 */
export const POST: APIRoute = async ({ params, request, locals }) => {
  if (!locals.usuario) {
    return new Response("No autorizado.", { status: 401 });
  }

  const id = params.id;
  if (!id) return redirigir(LISTA, { error: "Falta el artículo." });

  const accion = (await request.formData()).get("accion");

  // El rotulo lo pone cada accion: la lista recibe errores de subir, publicar y
  // borrar, y solo aqui se sabe de cual viene cada uno.
  if (accion === "publicado") {
    const estado = await alternarPublicado(id);
    if (estado === null) {
      return redirigir(LISTA, {
        error: "Ese artículo ya no existe.",
        rotulo: "No se cambió",
      });
    }
    return redirigir(LISTA, {
      aviso: estado ? `«${id}» está publicado.` : `«${id}» quedó oculto.`,
    });
  }

  if (accion === "borrar") {
    const borrado = await borrarPost(id);
    if (!borrado) {
      return redirigir(LISTA, {
        error: "Ese artículo ya no existe.",
        rotulo: "No se borró",
      });
    }
    return redirigir(LISTA, { aviso: `Se borró «${id}» y sus revisiones.` });
  }

  return redirigir(LISTA, { error: "Acción desconocida." });
};

const LISTA = "/panel/contenido/";
