import type { APIRoute } from "astro";
import { crearEnlace } from "../../../../lib/db";
import { datosDelFormulario } from "../../../../lib/enlaces-panel";
import { redirigir } from "../../../../lib/redireccion";
import { validarEnlace } from "../../../../lib/enlaces";

export const prerender = false;

/**
 * Crea un enlace. La validacion corre aqui aunque el formulario ya tenga
 * `required` y `maxlength`: esos solo ayudan a quien llena el formulario, y una
 * peticion armada a mano se los salta.
 */
export const POST: APIRoute = async ({ request, locals }) => {
  if (!locals.usuario) {
    return new Response("No autorizado.", { status: 401 });
  }

  const datos = datosDelFormulario(await request.formData());
  const resultado = validarEnlace(datos);
  // Lo capturado regresa al formulario: un error de una letra no deberia
  // obligar a escribir todo otra vez.
  if (!resultado.ok)
    return redirigir("/panel/enlaces/", { error: resultado.error, datos });

  await crearEnlace(resultado.enlace);
  return redirigir("/panel/enlaces/", {
    aviso: `Se agregó «${resultado.enlace.titulo}».`,
  });
};
