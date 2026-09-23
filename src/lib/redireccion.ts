/**
 * Lo que cada endpoint del panel manda de vuelta a su pantalla. `rotulo` y
 * `datos` solo viajan con un error: el rotulo etiqueta fallos, y lo capturado
 * sirve para rellenar el formulario que no se guardo.
 */
export interface Regreso {
  error?: string;
  aviso?: string;
  /** Sustituye el «No se guardó» generico de `Mensaje.astro`. */
  rotulo?: string;
  datos?: Record<string, string | undefined>;
}

/**
 * 303 de vuelta a una pantalla del panel. 303 y no 302: obliga a volver por GET,
 * y recargar la pantalla no reenvia el formulario. Todo viaja en la consulta
 * porque son unos cuantos campos cortos y el panel esta detras de Access.
 */
export function redirigir(
  destino: string,
  { error, aviso, rotulo, datos }: Regreso = {},
): Response {
  const parametros = new URLSearchParams();
  if (error) {
    parametros.set("error", error);
    if (rotulo) parametros.set("rotulo", rotulo);
    for (const [campo, valor] of Object.entries(datos ?? {})) {
      if (valor) parametros.set(campo, valor);
    }
  }
  if (aviso) parametros.set("aviso", aviso);
  const consulta = parametros.toString();

  return new Response(null, {
    status: 303,
    headers: { Location: `${destino}${consulta ? `?${consulta}` : ""}` },
  });
}
