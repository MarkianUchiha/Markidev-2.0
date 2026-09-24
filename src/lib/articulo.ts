import { z } from "astro/zod";
import { esquemaBlog } from "./frontmatter";

// Reglas de lo que se puede cambiar de un articulo sin volver a subirlo. Viven
// aqui y no en cada endpoint para que la subida y la edicion del panel no puedan
// validar distinto (`specs/editar-articulo.md`).

const SOLO_SLUG =
  "La URL solo puede llevar minúsculas, números y guiones sueltos.";

// El slug es la URL del articulo, asi que se restringe a lo que puede vivir en
// una: minusculas, numeros y guiones. Cada regla lleva su mensaje porque es lo
// que se enseña en el panel; sin el, Zod responde en ingles.
export const esquemaSlug = z
  .string({ message: "Falta la URL." })
  .trim()
  .min(3, "La URL necesita al menos 3 caracteres.")
  .max(80, "La URL pasa de 80 caracteres.")
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, SOLO_SLUG);

// Se recorta ANTES de validar. Al reves, 69 caracteres mas un espacio pasaban el
// minimo de 70, se guardaban recortados y el articulo dejaba de cumplir
// `esquemaBlog`: `aPost` lo descartaba y desaparecia del sitio y del panel.
function recortar(entrada: unknown): unknown {
  if (typeof entrada !== "object" || entrada === null) return entrada;
  return Object.fromEntries(
    Object.entries(entrada).map(([campo, valor]) => [
      campo,
      typeof valor === "string" ? valor.trim() : valor,
    ]),
  );
}

// `pick` y no un esquema propio: si cambia el limite del titulo en el
// frontmatter, la edicion lo hereda sin que nadie se acuerde de copiarlo.
const esquemaEdicion = z.preprocess(
  recortar,
  esquemaBlog
    .pick({ title: true, description: true })
    .extend({ slug: esquemaSlug }),
);

export type Edicion = z.output<typeof esquemaEdicion>;

export function validarEdicion(
  entrada: Record<string, unknown>,
): { ok: true; edicion: Edicion } | { ok: false; error: string } {
  const r = esquemaEdicion.safeParse(entrada);
  if (!r.success) return { ok: false, error: r.error.issues[0].message };
  return { ok: true, edicion: r.data };
}

/** Lo que se compara al avisar. `slug` falta en la subida, donde no cambia. */
interface Presentacion {
  title: string;
  description: string;
  slug?: string;
}

/**
 * El texto que dice que cambio respecto a lo que habia. Es la defensa contra
 * subir una copia vieja del `.md`: una correccion revertida se ve en el aviso en
 * vez de pasar en silencio. Vacio si no cambio nada de esto.
 */
export function describirCambios(
  antes: Presentacion,
  despues: Presentacion,
): string {
  const cambios: string[] = [];
  if (antes.title !== despues.title) {
    cambios.push(`Cambió el título: «${antes.title}» → «${despues.title}».`);
  }
  if (antes.description !== despues.description) {
    cambios.push(
      `Cambió la descripción: «${antes.description}» → «${despues.description}».`,
    );
  }
  if (antes.slug && despues.slug && antes.slug !== despues.slug) {
    cambios.push(
      `Cambió la URL: /blog/${antes.slug}/ → /blog/${despues.slug}/.`,
    );
  }
  return cambios.join(" ");
}

// Solo las letras y los numeros, sin acentos ni mayusculas: para comparar dos
// frases sin que un «¿», una tilde o un espacio las hagan distintas.
const esencia = (texto: string) =>
  texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, "");

/**
 * La pregunta del frontmatter que se pinta como encabezado del articulo, o null
 * si no hay que pintar nada. Sirve cuando el titulo no es una pregunta: un
 * encabezado en forma de pregunta, respondido en el primer parrafo, es lo que
 * los buscadores y los asistentes con IA citan. Si dice lo mismo que el titulo,
 * no se repite.
 */
export function preguntaVisible(
  titulo: string,
  pregunta: string | undefined,
): string | null {
  const limpia = pregunta?.trim();
  if (!limpia) return null;
  return esencia(limpia) === esencia(titulo) ? null : limpia;
}
