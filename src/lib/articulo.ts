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

// `pick` y no un esquema propio: si cambia el limite del titulo en el
// frontmatter, la edicion lo hereda sin que nadie se acuerde de copiarlo.
const esquemaEdicion = esquemaBlog
  .pick({ title: true, description: true })
  .extend({ slug: esquemaSlug })
  .transform(({ title, description, slug }) => ({
    title: title.trim(),
    description: description.trim(),
    slug,
  }));

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
