import { z } from "astro/zod";
import type { APIRoute } from "astro";
import { crearLead } from "../../../../lib/db";
import { CANAL_IDS } from "../../../../lib/pipeline";

export const prerender = false;

const esquema = z.object({
  nombre: z.string().trim().min(2).max(120),
  contacto: z.string().trim().max(160).optional(),
  canal: z.enum(CANAL_IDS),
  mensaje: z.string().trim().max(4000).optional(),
  // Llega como texto desde el formulario y puede venir vacio.
  valor_estimado: z
    .string()
    .trim()
    .optional()
    .transform((valor) => (valor ? Number.parseInt(valor, 10) : null))
    .refine((valor) => valor === null || Number.isFinite(valor), {
      message: "El valor estimado tiene que ser un número.",
    }),
});

/**
 * Alta manual. Es tan importante como el formulario publico: el cliente que mas
 * factura llega recomendado y escribe por WhatsApp, asi que un tablero que solo
 * comiera del formulario dejaria fuera justo a ese segmento.
 */
export const POST: APIRoute = async ({ request, locals }) => {
  if (!locals.usuario) {
    return new Response("No autorizado.", { status: 401 });
  }

  const datos = await request.formData();
  const resultado = esquema.safeParse({
    nombre: datos.get("nombre"),
    contacto: datos.get("contacto") || undefined,
    canal: datos.get("canal"),
    mensaje: datos.get("mensaje") || undefined,
    valor_estimado: datos.get("valor_estimado") || undefined,
  });

  if (!resultado.success) {
    const mensaje = resultado.error.issues[0]?.message ?? "Revisa los datos.";
    return redirigir(`/panel/?error=${encodeURIComponent(mensaje)}`);
  }

  await crearLead(
    {
      nombre: resultado.data.nombre,
      contacto: resultado.data.contacto ?? null,
      canal: resultado.data.canal,
      mensaje: resultado.data.mensaje ?? null,
      valor_estimado: resultado.data.valor_estimado,
    },
    locals.usuario.email,
  );

  return redirigir("/panel/");
};

function redirigir(destino: string): Response {
  return new Response(null, { status: 303, headers: { Location: destino } });
}
