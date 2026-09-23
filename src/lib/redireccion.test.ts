import { describe, expect, it } from "vitest";
import { redirigir } from "./redireccion";

// La consulta se lee ya decodificada: lo que importa es que la pagina reciba el
// texto intacto, no como se escapo cada caracter.
function destinoDe(respuesta: Response) {
  const url = new URL(respuesta.headers.get("Location")!, "http://x");
  return {
    ruta: url.pathname,
    parametros: Object.fromEntries(url.searchParams),
  };
}

describe("redirigir", () => {
  it("responde 303 para que el navegador vuelva por GET", () => {
    expect(redirigir("/panel/").status).toBe(303);
  });

  it("sin opciones deja el destino tal cual, sin `?` colgando", () => {
    expect(redirigir("/panel/enlaces/").headers.get("Location")).toBe(
      "/panel/enlaces/",
    );
  });

  it("lleva el error con su rotulo, con acentos y comillas intactos", () => {
    const { ruta, parametros } = destinoDe(
      redirigir("/panel/contenido/", {
        error: "Ese artículo ya no existe.",
        rotulo: "No se borró",
      }),
    );
    expect(ruta).toBe("/panel/contenido/");
    expect(parametros).toEqual({
      error: "Ese artículo ya no existe.",
      rotulo: "No se borró",
    });
  });

  it("lleva el aviso", () => {
    expect(
      destinoDe(redirigir("/panel/", { aviso: "Se subió «Hola & adiós»." }))
        .parametros,
    ).toEqual({ aviso: "Se subió «Hola & adiós»." });
  });

  it("ignora el rotulo sin error: solo etiqueta fallos", () => {
    expect(
      destinoDe(
        redirigir("/panel/", { aviso: "Listo.", rotulo: "No se subió" }),
      ).parametros,
    ).toEqual({ aviso: "Listo." });
  });

  it("devuelve lo capturado solo cuando hubo error, y sin campos vacios", () => {
    const datos = { titulo: "Mi enlace", url: "", descripcion: undefined };

    expect(
      destinoDe(redirigir("/panel/enlaces/", { error: "URL inválida.", datos }))
        .parametros,
    ).toEqual({ error: "URL inválida.", titulo: "Mi enlace" });

    expect(
      destinoDe(redirigir("/panel/enlaces/", { aviso: "Guardado.", datos }))
        .parametros,
    ).toEqual({ aviso: "Guardado." });
  });
});
