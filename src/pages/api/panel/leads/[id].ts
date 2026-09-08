import { z } from "astro/zod";
import type { APIRoute } from "astro";
import { moverLead } from "../../../../lib/db";
import { ETAPA_IDS } from "../../../../lib/pipeline";

export const prerender = false;

const esquema = z
  .object({
    etapa: z.enum(ETAPA_IDS),
    motivo: z.string().trim().min(1).max(500).optional(),
    retomar_el: z.string().trim().min(1).max(30).optional(),
  })
  // Las mismas dos reglas que impone la base con CHECK. Validarlas aqui devuelve
  // un mensaje que se puede leer, en vez de un error de SQLite.
  .refine((datos) => datos.etapa !== "descartado" || Boolean(datos.motivo), {
    message: "Descartar exige un motivo.",
  })
  .refine((datos) => datos.etapa !== "retomar" || Boolean(datos.retomar_el), {
    message: "Retomar exige una fecha.",
  });

export const PATCH: APIRoute = async ({ params, request, locals }) => {
  // El middleware ya bloqueo a quien no paso por Access. Esto es la red de
  // seguridad por si algun dia una ruta nueva se escapa de esa lista.
  if (!locals.usuario) {
    return json({ error: "No autorizado." }, 401);
  }

  const id = params.id;
  if (!id) return json({ error: "Falta el identificador." }, 400);

  const cuerpo = await request.json().catch(() => null);
  const resultado = esquema.safeParse(cuerpo);

  if (!resultado.success) {
    return json(
      { error: resultado.error.issues[0]?.message ?? "Datos inválidos." },
      400,
    );
  }

  // Los campos se limpian al salir: un lead que estuvo descartado y vuelve a
  // negociacion no debe arrastrar el motivo por el que se descarto.
  const movido = await moverLead(
    id,
    {
      etapa: resultado.data.etapa,
      motivo:
        resultado.data.etapa === "descartado"
          ? (resultado.data.motivo ?? null)
          : null,
      retomar_el:
        resultado.data.etapa === "retomar"
          ? (resultado.data.retomar_el ?? null)
          : null,
    },
    locals.usuario.email,
  );

  if (!movido) return json({ error: "Ese lead ya no existe." }, 404);

  return json({ ok: true });
};

function json(cuerpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(cuerpo), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
