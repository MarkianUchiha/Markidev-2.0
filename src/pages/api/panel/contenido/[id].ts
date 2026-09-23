import type { APIRoute } from "astro";
import {
  obtenerPost,
  alternarPublicado,
  borrarPost,
  editarPost,
} from "../../../../lib/db";
import { validarEdicion } from "../../../../lib/articulo";
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
 * Editar, publicar, ocultar o borrar. Van todos por POST y no por PATCH/DELETE
 * porque el panel usa formularios nativos —sin isla de React, que aqui no hace
 * falta— y un formulario solo sabe hacer GET y POST.
 */
export const POST: APIRoute = async ({ params, request, locals }) => {
  if (!locals.usuario) {
    return new Response("No autorizado.", { status: 401 });
  }

  const id = params.id;
  if (!id) return redirigir(LISTA, { error: "Falta el artículo." });

  const formulario = await request.formData();
  const accion = formulario.get("accion");

  if (accion === "editar") {
    const datos = {
      title: texto(formulario.get("title")),
      description: texto(formulario.get("description")),
      slug: texto(formulario.get("slug")),
    };
    // Tras un error se vuelve a la pantalla de edicion con lo escrito: si no, la
    // correccion se perderia y habria que teclearla otra vez.
    const edicion = `/panel/contenido/${id}/editar/`;
    const validado = validarEdicion(datos);
    if (!validado.ok) {
      return redirigir(edicion, { error: validado.error, datos });
    }

    const resultado = await editarPost(
      id,
      validado.edicion,
      locals.usuario.email,
    );
    if (!resultado.ok) {
      return redirigir(edicion, { error: resultado.error, datos });
    }
    return redirigir(LISTA, {
      aviso: resultado.cambios
        ? `Se guardó «${validado.edicion.title}». ${resultado.cambios}`
        : "No había nada que cambiar.",
    });
  }

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

// Un campo que no llego, o que llego como archivo, cuenta como vacio: el
// esquema se encarga de decir que falta.
function texto(valor: FormDataEntryValue | null): string | undefined {
  return typeof valor === "string" ? valor : undefined;
}
