import type { DatosFormulario } from "./enlaces";

// Piezas que comparten las dos rutas de la API de enlaces. Van aparte de
// `enlaces.ts` porque aquel archivo son las reglas del dominio, y esto es
// plomeria de formularios HTTP.

const CAMPOS = ["titulo", "url", "descripcion", "vence"] as const;

/** Solo los campos del enlace, como texto. Un archivo o un campo extra se ignora. */
export function datosDelFormulario(formulario: FormData): DatosFormulario {
  const datos: DatosFormulario = {};
  for (const campo of CAMPOS) {
    const valor = formulario.get(campo);
    if (typeof valor === "string") datos[campo] = valor;
  }
  return datos;
}

