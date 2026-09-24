import type { APIRoute } from "astro";
import { buscarRedireccion, guardarPost } from "../../../../lib/db";
import { leerMarkdown, aHtml } from "../../../../lib/frontmatter";
import { redirigir } from "../../../../lib/redireccion";
import { describirCambios, esquemaSlug } from "../../../../lib/articulo";
import { describirSinMedir } from "../../../../lib/medir-imagenes";

export const prerender = false;

/**
 * Sube un `.md`. Si ya existe uno con ese slug lo reemplaza y guarda la version
 * anterior como revision, que es la forma de corregir un articulo.
 *
 * La conversion a HTML ocurre aqui y no al servir la pagina: se hace una vez por
 * guardado en vez de una por visita, y el codigo que procesa texto de un tercero
 * queda detras de Cloudflare Access en lugar de expuesto al publico.
 */
export const POST: APIRoute = async ({ request, locals }) => {
  if (!locals.usuario) {
    return new Response("No autorizado.", { status: 401 });
  }

  const formulario = await request.formData();
  const archivo = formulario.get("archivo");

  if (!(archivo instanceof File) || archivo.size === 0) {
    return noSeSubio("Elige un archivo .md.");
  }
  if (!archivo.name.toLowerCase().endsWith(".md")) {
    return noSeSubio("El archivo tiene que ser un .md.");
  }
  // Un articulo largo ronda las 20 KB. El tope evita que un archivo equivocado
  // —un video renombrado, por ejemplo— llegue al parser.
  if (archivo.size > 512 * 1024) {
    return noSeSubio("El archivo pasa de 512 KB; eso no es un artículo.");
  }

  const slug = esquemaSlug.safeParse(archivo.name.replace(/\.md$/i, ""));
  if (!slug.success) {
    return noSeSubio(
      slug.error.issues[0]?.message ?? "Nombre de archivo inválido.",
    );
  }

  // Una URL vieja no puede volver a ser articulo: subir la copia antigua con su
  // nombre original crearia un duplicado justo donde deberia redirigir.
  const hacia = await buscarRedireccion(slug.data);
  if (hacia) {
    return noSeSubio(
      `Esa URL ahora redirige a «${hacia}». Renombra el archivo a ${hacia}.md.`,
    );
  }

  let datos, cuerpo;
  try {
    ({ datos, cuerpo } = leerMarkdown(await archivo.text()));
  } catch (error) {
    // El mensaje viene de `leerMarkdown` y dice que campo falla: es lo que la
    // persona que subio el archivo necesita para arreglarlo.
    return noSeSubio(
      error instanceof Error ? error.message : "El archivo no se pudo leer.",
    );
  }

  // El origen de la peticion y no una constante: asi las rutas relativas de las
  // imagenes se resuelven contra el mismo sitio en `astro dev` y en produccion.
  const { html, sinMedir } = await aHtml(cuerpo, {
    origen: new URL(request.url).origin,
  });
  const guardado = await guardarPost(
    { id: slug.data, coleccion: "blog", datos, cuerpo, html },
    locals.usuario.email,
  );

  const partes = guardado.creado
    ? [`Se subió «${datos.title}».`]
    : [
        `Se actualizó «${datos.title}».`,
        describirCambios(guardado.anterior, datos),
      ];
  partes.push(describirSinMedir(sinMedir));
  return redirigir(LISTA, { aviso: partes.filter(Boolean).join(" ") });
};

const LISTA = "/panel/contenido/";

// Todo error de este endpoint es de la subida, y casi siempre del frontmatter:
// «no se guardó» sugeriria un fallo del servidor.
function noSeSubio(error: string): Response {
  return redirigir(LISTA, { error, rotulo: "No se subió" });
}
