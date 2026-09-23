import type { APIRoute } from "astro";
import {
  actualizarEnlace,
  alternarVisible,
  borrarEnlace,
  moverEnlace,
  obtenerEnlace,
} from "../../../../lib/db";
import { datosDelFormulario } from "../../../../lib/enlaces-panel";
import { redirigir } from "../../../../lib/redireccion";
import { validarEnlace } from "../../../../lib/enlaces";

export const prerender = false;

const LISTA = "/panel/enlaces/";

/**
 * Editar, mostrar u ocultar, subir, bajar o borrar. Todo por POST con un campo
 * `accion`, igual que en contenido: el panel usa formularios nativos sin
 * JavaScript, y un formulario solo sabe hacer GET y POST.
 */
export const POST: APIRoute = async ({ params, request, locals }) => {
  if (!locals.usuario) {
    return new Response("No autorizado.", { status: 401 });
  }

  const id = params.id;
  const enlace = id ? await obtenerEnlace(id) : null;
  if (!id || !enlace)
    return redirigir(LISTA, { error: "Ese enlace ya no existe." });

  const formulario = await request.formData();
  const accion = formulario.get("accion");

  if (accion === "editar") {
    const datos = datosDelFormulario(formulario);
    const resultado = validarEnlace(datos);
    const edicion = `/panel/enlaces/${id}/`;
    if (!resultado.ok)
      return redirigir(edicion, { error: resultado.error, datos });
    await actualizarEnlace(id, resultado.enlace);
    return redirigir(LISTA, {
      aviso: `Se guardó «${resultado.enlace.titulo}».`,
    });
  }

  if (accion === "visible") {
    const visible = await alternarVisible(id);
    if (visible === null)
      return redirigir(LISTA, { error: "Ese enlace ya no existe." });
    return redirigir(LISTA, {
      aviso: visible
        ? `«${enlace.titulo}» se ve en la página.`
        : `«${enlace.titulo}» quedó oculto.`,
    });
  }

  if (accion === "subir" || accion === "bajar") {
    // En un extremo de la lista no hay con quien cambiar: no es un error, y
    // avisarlo solo haria ruido.
    await moverEnlace(id, accion);
    return redirigir(LISTA);
  }

  if (accion === "borrar") {
    await borrarEnlace(id);
    return redirigir(LISTA, { aviso: `Se borró «${enlace.titulo}».` });
  }

  return redirigir(LISTA, { error: "Acción desconocida." });
};
