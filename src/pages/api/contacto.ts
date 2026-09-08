import { env } from "cloudflare:workers";
import { z } from "astro/zod";
import type { APIRoute } from "astro";
import { crearLead } from "../../lib/db";

// El sitio es estatico; este endpoint es de las pocas piezas que corren por
// peticion. Sin esta linea Astro intentaria pre-renderizarlo y no existiria.
export const prerender = false;

const esquema = z.object({
  nombre: z.string().trim().min(2, "Escribe tu nombre.").max(120),
  // Un correo o un telefono, lo que la persona prefiera. Exigir formato de correo
  // pierde a quien solo quiere dejar su numero.
  contacto: z.string().trim().min(5, "Deja un correo o un teléfono.").max(160),
  mensaje: z.string().trim().min(10, "Cuéntame un poco más.").max(4000),
  // LFPDPPP: el consentimiento tiene que ser explicito y verificable.
  privacidad: z.literal("on", {
    message: "Necesito tu consentimiento para guardar el mensaje.",
  }),
});

export const POST: APIRoute = async ({ request }) => {
  const datos = await request.formData();

  // Campo trampa: invisible para una persona, irresistible para un bot. Si trae
  // algo se responde 200 y se tira en silencio; un error le enseñaria al bot que
  // fue detectado.
  if (String(datos.get("empresa") ?? "") !== "") {
    return redirigir("/contacto/?enviado=1");
  }

  const resultado = esquema.safeParse({
    nombre: datos.get("nombre"),
    contacto: datos.get("contacto"),
    mensaje: datos.get("mensaje"),
    privacidad: datos.get("privacidad"),
  });

  if (!resultado.success) {
    const primero = resultado.error.issues[0]?.message ?? "Revisa los datos.";
    return redirigir(`/contacto/?error=${encodeURIComponent(primero)}`);
  }

  const humano = await validarTurnstile(
    datos.get("cf-turnstile-response"),
    request,
  );
  if (!humano) {
    return redirigir(
      "/contacto/?error=No%20se%20pudo%20verificar%20que%20eres%20una%20persona.",
    );
  }

  // El orden importa y no es negociable: primero se guarda, despues se avisa. Si
  // Resend falla, el lead ya esta en la base y se ve en el tablero. Al reves se
  // pierde sin que ninguno de los dos se entere.
  try {
    await crearLead(
      {
        nombre: resultado.data.nombre,
        contacto: resultado.data.contacto,
        canal: "formulario",
        mensaje: resultado.data.mensaje,
      },
      "formulario",
    );
  } catch (error) {
    console.error("No se pudo guardar el lead", error);
    return redirigir(
      "/contacto/?error=No%20se%20pudo%20guardar%20tu%20mensaje.%20Escríbeme%20por%20WhatsApp.",
    );
  }

  // Si el aviso falla no se le dice nada a quien escribio: su mensaje ya esta a
  // salvo, y hacerlo reenviar duplicaria el lead.
  try {
    await avisarPorCorreo(resultado.data);
  } catch (error) {
    console.error("Lead guardado, pero el aviso por correo fallo", error);
  }

  return redirigir("/contacto/?enviado=1");
};

function redirigir(destino: string): Response {
  // 303 obliga al navegador a pasar a GET. Con 302 algunos reenvian el POST al
  // recargar y se duplica el lead.
  return new Response(null, { status: 303, headers: { Location: destino } });
}

async function validarTurnstile(
  token: FormDataEntryValue | null,
  request: Request,
) {
  // Mientras no exista la llave, el formulario funciona con el campo trampa y la
  // validacion del servidor. Se endurece solo cuando aparezca el primer spam.
  if (!env.TURNSTILE_SECRET_KEY) return true;
  if (typeof token !== "string" || token === "") return false;

  const cuerpo = new FormData();
  cuerpo.append("secret", env.TURNSTILE_SECRET_KEY);
  cuerpo.append("response", token);

  const ip = request.headers.get("CF-Connecting-IP");
  if (ip) cuerpo.append("remoteip", ip);

  const respuesta = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    { method: "POST", body: cuerpo },
  );

  const { success } = (await respuesta.json()) as { success: boolean };
  return success;
}

async function avisarPorCorreo(datos: z.infer<typeof esquema>) {
  if (!env.RESEND_API_KEY || !env.RESEND_FROM || !env.RESEND_TO) return;

  // Se llama la API directo en vez de instalar el SDK: es una sola peticion y
  // una dependencia menos que mantener dentro del Worker.
  const respuesta = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: env.RESEND_FROM,
      to: env.RESEND_TO,
      // Responder al correo contesta a quien escribio, no a uno mismo.
      reply_to: datos.contacto.includes("@") ? datos.contacto : undefined,
      subject: `Nuevo lead: ${datos.nombre}`,
      text: `Nombre: ${datos.nombre}\nContacto: ${datos.contacto}\n\n${datos.mensaje}\n\nVerlo en el tablero: https://markidev.com/panel/`,
    }),
  });

  if (!respuesta.ok) {
    throw new Error(`Resend respondio ${respuesta.status}`);
  }
}
