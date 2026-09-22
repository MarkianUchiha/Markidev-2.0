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

/**
 * 303 de vuelta a una pantalla del panel. Si hubo error, lo capturado viaja en la
 * consulta para rellenar el formulario; son unos cuantos campos cortos y el panel
 * esta detras de Access, asi que no hay nada que esconder en la URL.
 */
export function redirigir(
  destino: string,
  {
    error,
    aviso,
    datos,
  }: { error?: string; aviso?: string; datos?: DatosFormulario } = {},
): Response {
  const parametros = new URLSearchParams();
  if (error) parametros.set("error", error);
  if (aviso) parametros.set("aviso", aviso);
  if (error && datos) {
    for (const [campo, valor] of Object.entries(datos)) {
      if (valor) parametros.set(campo, valor);
    }
  }
  const consulta = parametros.toString();
  return new Response(null, {
    status: 303,
    headers: { Location: `${destino}${consulta ? `?${consulta}` : ""}` },
  });
}
