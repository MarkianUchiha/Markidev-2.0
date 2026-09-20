import { z } from "astro/zod";
import type { APIRoute } from "astro";
import { guardarPost } from "../../../../lib/db";
import { leerMarkdown, aHtml } from "../../../../lib/frontmatter";

export const prerender = false;

// El slug es la URL del articulo, asi que se restringe a lo que puede vivir en
// una: minusculas, numeros y guiones. Se toma del nombre del archivo, que es
// como funcionaba cuando el blog eran archivos en el repositorio.
const esquemaSlug = z
  .string()
  .trim()
  .min(3)
  .max(80)
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "El nombre del archivo solo puede llevar minúsculas, números y guiones.",
  );

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
    return redirigir("Elige un archivo .md.");
  }
  if (!archivo.name.toLowerCase().endsWith(".md")) {
    return redirigir("El archivo tiene que ser un .md.");
  }
  // Un articulo largo ronda las 20 KB. El tope evita que un archivo equivocado
  // —un video renombrado, por ejemplo— llegue al parser.
  if (archivo.size > 512 * 1024) {
    return redirigir("El archivo pasa de 512 KB; eso no es un artículo.");
  }

  const slug = esquemaSlug.safeParse(archivo.name.replace(/\.md$/i, ""));
  if (!slug.success) {
    return redirigir(
      slug.error.issues[0]?.message ?? "Nombre de archivo inválido.",
    );
  }

  let datos, cuerpo;
  try {
    ({ datos, cuerpo } = leerMarkdown(await archivo.text()));
  } catch (error) {
    // El mensaje viene de `leerMarkdown` y dice que campo falla: es lo que la
    // persona que subio el archivo necesita para arreglarlo.
    return redirigir(
      error instanceof Error ? error.message : "El archivo no se pudo leer.",
    );
  }

  const { creado } = await guardarPost(
    {
      id: slug.data,
      coleccion: "blog",
      datos,
      cuerpo,
      html: await aHtml(cuerpo),
    },
    locals.usuario.email,
  );

  return redirigir(
    null,
    creado ? `Se subió «${datos.title}».` : `Se actualizó «${datos.title}».`,
  );
};

function redirigir(error: string | null, aviso?: string): Response {
  const parametros = new URLSearchParams();
  if (error) parametros.set("error", error);
  if (aviso) parametros.set("aviso", aviso);
  const consulta = parametros.toString();

  return new Response(null, {
    status: 303,
    headers: { Location: `/panel/contenido/${consulta ? `?${consulta}` : ""}` },
  });
}
