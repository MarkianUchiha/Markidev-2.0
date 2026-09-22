import { z } from "astro/zod";

// Reglas de la pagina de enlaces (`specs/pagina-de-enlaces.md`). Todo lo de
// aqui es puro, sin D1 ni Astro, para poder probarlo con Vitest sin levantar el
// Worker: la base solo guarda lo que estas funciones ya dejaron pasar.

export const TITULO_MAX = 80;
export const DESCRIPCION_MAX = 120;

export interface Enlace {
  id: string;
  titulo: string;
  url: string;
  descripcion: string | null;
  visible: boolean;
  /** Instante ISO en que deja de mostrarse, o null si no vence. */
  vence_en: string | null;
  orden: number;
}

/** Lo que el panel manda al crear o editar, ya validado. */
export type EnlaceNuevo = Pick<
  Enlace,
  "titulo" | "url" | "descripcion" | "vence_en"
>;

export type EstadoEnlace = "visible" | "oculto" | "vencido";

/** Una ruta propia del sitio se abre en la misma pestaña; lo demas, en otra. */
export function esExterno(url: string): boolean {
  // `//dominio` empieza con barra pero el navegador lo resuelve a otro sitio.
  return !url.startsWith("/") || url.startsWith("//");
}

const ORIGEN_PROPIO = "https://markidev.com";

// Lista blanca y no lista negra: prohibir `javascript:` deja pasar `data:`,
// `vbscript:` y lo que invente el siguiente navegador. Solo sale lo que se sabe
// abrir sin riesgo.
function esUrlPermitida(url: string): boolean {
  if (url.startsWith("/")) {
    // `/\dominio` lo normalizan algunos navegadores a `//dominio`.
    if (url.startsWith("//") || url.includes("\\")) return false;
    const destino = new URL(url, ORIGEN_PROPIO);
    // `trailingSlash: "always"`: una ruta interna sin barra final da 404.
    return destino.origin === ORIGEN_PROPIO && destino.pathname.endsWith("/");
  }
  if (!URL.canParse(url)) return false;
  const destino = new URL(url);
  return (
    (destino.protocol === "https:" || destino.protocol === "http:") &&
    destino.hostname !== ""
  );
}

// Mexico dejo el horario de verano en 2022: la Ciudad de Mexico es UTC-6 todo el
// año, asi que el desfase fijo es correcto y no hace falta una base de husos.
const DESFASE_CDMX_HORAS = 6;

/**
 * «Vence el 1 de octubre» se lee como que el 1 todavia se ve. Por eso se guarda
 * el ultimo milisegundo de ese dia en hora de Mexico, no la medianoche UTC, que
 * lo ocultaria seis horas antes de lo prometido.
 */
export function venceAlFinalDelDia(fecha: string): string {
  const [anio, mes, dia] = fecha.split("-").map(Number);
  const finDelDiaUtc = Date.UTC(
    anio,
    mes - 1,
    dia,
    23 + DESFASE_CDMX_HORAS,
    59,
    59,
    999,
  );
  return new Date(finDelDiaUtc).toISOString();
}

/** El dia que se capturo, para volver a mostrarlo en el formulario de edicion. */
export function diaDeVencimiento(venceEn: string): string {
  const enMexico = new Date(new Date(venceEn).getTime() - DESFASE_CDMX_HORAS * 3_600_000);
  return enMexico.toISOString().slice(0, 10);
}

function esFechaReal(fecha: string): boolean {
  const [anio, mes, dia] = fecha.split("-").map(Number);
  const d = new Date(Date.UTC(anio, mes - 1, dia));
  return (
    d.getUTCFullYear() === anio &&
    d.getUTCMonth() === mes - 1 &&
    d.getUTCDate() === dia
  );
}

const texto = z.string().trim();
const opcional = (esquema: z.ZodString) =>
  z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v : null))
    .pipe(esquema.nullable());

const esquemaEnlace = z.object({
  titulo: texto
    .min(1, "Falta el título.")
    .max(TITULO_MAX, `El título no puede pasar de ${TITULO_MAX} caracteres.`),
  url: texto.refine(esUrlPermitida, {
    message:
      "La URL tiene que empezar con https:// o http://, o ser una ruta del sitio con barra final, como /blog/.",
  }),
  descripcion: opcional(
    z
      .string()
      .max(
        DESCRIPCION_MAX,
        `La descripción no puede pasar de ${DESCRIPCION_MAX} caracteres.`,
      ),
  ),
  vence: opcional(
    z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "La fecha de vencimiento no es válida.")
      .refine(esFechaReal, "La fecha de vencimiento no existe."),
  ),
});

export type DatosFormulario = Partial<
  Record<keyof z.input<typeof esquemaEnlace>, string>
>;

export function validarEnlace(
  datos: DatosFormulario,
): { ok: true; enlace: EnlaceNuevo } | { ok: false; error: string } {
  const r = esquemaEnlace.safeParse(datos);
  if (!r.success) return { ok: false, error: r.error.issues[0].message };
  const { titulo, url, descripcion, vence } = r.data;
  return {
    ok: true,
    enlace: {
      titulo,
      url,
      descripcion,
      vence_en: vence ? venceAlFinalDelDia(vence) : null,
    },
  };
}

export function estadoEnlace(enlace: Enlace, ahora: Date): EstadoEnlace {
  // Vencido gana sobre oculto: volver a mostrarlo no basta, primero hay que
  // mover la fecha, y el panel tiene que decirlo.
  if (enlace.vence_en && new Date(enlace.vence_en) <= ahora) return "vencido";
  return enlace.visible ? "visible" : "oculto";
}

export function enlacesVisibles(enlaces: Enlace[], ahora: Date): Enlace[] {
  return enlaces
    .filter((e) => estadoEnlace(e, ahora) === "visible")
    .sort((a, b) => a.orden - b.orden);
}

/**
 * Subir o bajar es intercambiar el `orden` con el vecino. Se devuelven solo las
 * dos filas que cambian, para escribirlas juntas en un `batch`, y null cuando no
 * hay vecino: el extremo de la lista no es un error, simplemente no se mueve.
 */
export function intercambioDeOrden(
  enlaces: Enlace[],
  id: string,
  direccion: "subir" | "bajar",
): [{ id: string; orden: number }, { id: string; orden: number }] | null {
  const ordenados = [...enlaces].sort((a, b) => a.orden - b.orden);
  const i = ordenados.findIndex((e) => e.id === id);
  if (i === -1) return null;
  const vecino = ordenados[direccion === "subir" ? i - 1 : i + 1];
  if (!vecino) return null;
  const actual = ordenados[i];
  return [
    { id: actual.id, orden: vecino.orden },
    { id: vecino.id, orden: actual.orden },
  ];
}
