import type { APIRoute } from "astro";
import { getPublishedPosts, getPublishedWork } from "../lib/content";
import { site } from "../data/site";

// llms.txt: el resumen del sitio que leen los asistentes cuando alguien les
// pregunta algo que este sitio responde. Es markdown plano, no una API: un
// titulo, una frase que diga que es esto, y listas de enlaces con contexto.
//
// Se genera y no se escribe a mano en public/ por una razon concreta: un
// archivo estatico se queda viejo el dia que se publique el segundo articulo,
// y nadie se acuerda de actualizarlo. Aqui sale del mismo contenido que el
// sitio, asi que no puede mentir.
//
// Se listan solo las paginas publicadas. El panel queda fuera: es interno y ya
// va con noindex.

const SITIO = "https://markidev.com";

export const prerender = true;

export const GET: APIRoute = async () => {
  const posts = await getPublishedPosts();
  const trabajos = await getPublishedWork();

  const lineas: string[] = [
    `# ${site.name}`,
    "",
    "> Estudio independiente de automatización y digitalización de negocios.",
    "> Sistemas a medida, puntos de venta, pedidos por WhatsApp y sitios web,",
    "> hechos a la medida de negocios reales. México y Latinoamérica.",
    "",
    `Lo lleva ${site.author}, una sola persona. El trabajo es remoto. El contacto`,
    "va por WhatsApp, correo o una llamada de 30 minutos que se agenda en línea.",
    "",
    "## Páginas",
    "",
    `- [Inicio](${SITIO}/): qué hace MarkiDev y para quién.`,
    `- [Sobre mí](${SITIO}/sobre-mi/): quién está detrás, cómo cobra, cuánto tarda, y con qué no ayuda.`,
    `- [Trabajos](${SITIO}/trabajos/): casos reales con el resultado que tuvo cada uno.`,
    `- [Blog](${SITIO}/blog/): respuestas a las preguntas que los clientes hacen antes de contratar.`,
    `- [Contacto](${SITIO}/contacto/): formulario, WhatsApp, correo y agenda.`,
    `- [Aviso de privacidad](${SITIO}/aviso-de-privacidad/): tratamiento de datos personales (LFPDPPP).`,
    "",
  ];

  if (trabajos.length > 0) {
    lineas.push("## Casos", "");
    for (const t of trabajos) {
      // El resultado y no la descripcion: es lo unico que distingue un caso de
      // otro para quien esta comparando.
      lineas.push(
        `- [${t.data.title}](${SITIO}/trabajos/${t.id}/): ${t.data.client}, ${t.data.year}. ${t.data.result}`,
      );
    }
    lineas.push("");
  }

  if (posts.length > 0) {
    lineas.push("## Artículos", "");
    for (const p of posts) {
      lineas.push(
        `- [${p.data.title}](${SITIO}/blog/${p.id}/): ${p.data.description}`,
      );
    }
    lineas.push("");
  }

  return new Response(lineas.join("\n"), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
};
