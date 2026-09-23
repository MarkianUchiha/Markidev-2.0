import type { APIRoute } from "astro";
import { obtenerPost, alternarPublicado, borrarPost } from "../../../../lib/db";
import { aMarkdown } from "../../../../lib/frontmatter";

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
  if (!id) return redirigir("Falta el artículo.");

  const accion = (await request.formData()).get("accion");

  if (accion === "publicado") {
    const estado = await alternarPublicado(id);
    if (estado === null) {
      return redirigir("Ese artículo ya no existe.", undefined, "No se cambió");
    }
    return redirigir(
      null,
      estado ? `«${id}» está publicado.` : `«${id}» quedó oculto.`,
    );
  }

  if (accion === "borrar") {
    const borrado = await borrarPost(id);
    if (!borrado) {
      return redirigir("Ese artículo ya no existe.", undefined, "No se borró");
    }
    return redirigir(null, `Se borró «${id}» y sus revisiones.`);
  }

  return redirigir("Acción desconocida.");
};

// `rotulo` lo decide quien conoce la accion: la pagina del panel recibe errores
// de subir, publicar y borrar, y no sabe de cual viene cada uno. Sin el, cae en
// el generico de `Mensaje.astro`.
function redirigir(
  error: string | null,
  aviso?: string,
  rotulo?: string,
): Response {
  const parametros = new URLSearchParams();
  if (error) parametros.set("error", error);
  if (rotulo) parametros.set("rotulo", rotulo);
  if (aviso) parametros.set("aviso", aviso);
  const consulta = parametros.toString();

  return new Response(null, {
    status: 303,
    headers: { Location: `/panel/contenido/${consulta ? `?${consulta}` : ""}` },
  });
}
