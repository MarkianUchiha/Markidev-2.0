import { load } from "js-yaml";
import { describe, expect, it } from "vitest";
import { explicarErrorYaml } from "./yaml-legible";

// El YAML es lo que va entre los `---`, asi que su primera linea es la 2 del
// archivo: todos los numeros de linea esperados cuentan desde el archivo.
function explicar(yaml: string): string {
  try {
    load(yaml);
  } catch (error) {
    return explicarErrorYaml(yaml, error);
  }
  throw new Error("Este YAML debia fallar y no fallo.");
}

describe("explicarErrorYaml", () => {
  it("sangria: nombra la linea del archivo y el campo (el caso real de M-257)", () => {
    expect(
      explicar(
        "title: Post de Prueba\n  description: Algo\n  pubDate: 2026-09-23",
      ),
    ).toBe(
      "La línea 3 (`description`) empieza con espacios. En el frontmatter cada campo va pegado al margen izquierdo; solo los elementos de `tags` llevan sangría.",
    );
  });

  it("sangria en la primera linea", () => {
    expect(explicar("  title: T\ndescription: D")).toBe(
      "La línea 2 (`title`) empieza con espacios. En el frontmatter cada campo va pegado al margen izquierdo; solo los elementos de `tags` llevan sangría.",
    );
  });

  it("dos puntos dentro de un valor: sugiere comillas", () => {
    expect(explicar("title: T\ndescription: Esto es: algo")).toBe(
      'La línea 3 (`description`) tiene «: » dentro del texto, y eso se lee como otro campo. Pon el texto entre comillas: description: "…".',
    );
  });

  it("comillas sin cerrar: señala la linea que las abre, no la siguiente", () => {
    expect(explicar('title: "Sin cerrar\ndescription: D')).toBe(
      "La línea 2 (`title`) abre comillas y no las cierra.",
    );
    expect(
      explicar("title: T\ndescription: 'Sin cerrar\npubDate: 2026-09-23"),
    ).toBe("La línea 3 (`description`) abre comillas y no las cierra.");
  });

  it("texto despues de cerrar las comillas", () => {
    expect(explicar('title: "T" y más\ndescription: D')).toBe(
      "La línea 2 (`title`) cierra las comillas antes de que acabe el texto. Pon todo el texto dentro de las comillas.",
    );
  });

  it("tabulador", () => {
    expect(explicar("title: T\n\tdescription: D")).toBe(
      "La línea 3 empieza con un tabulador. En el frontmatter no se usan tabuladores: cada campo va pegado al margen y los elementos de `tags` llevan dos espacios.",
    );
  });

  it("campo repetido", () => {
    expect(explicar("title: T\ntitle: U")).toBe(
      "El campo `title` aparece dos veces (línea 3). Deja solo uno.",
    );
  });

  it("cualquier otro error: mensaje generico en español con la linea", () => {
    expect(explicar("tags: [a, b\ntitle: T")).toBe(
      "El frontmatter tiene un error de formato cerca de la línea 3. Revisa que cada campo sea «nombre: valor» y esté pegado al margen izquierdo.",
    );
  });

  it("nunca deja pasar el texto en ingles de la libreria", () => {
    const mensajes = [
      "title: T\n  description: D",
      "title: T\ndescription: a: b",
      'title: "x',
      "tags: [a, b\ntitle: T",
      "title: T\ntitle: U",
    ].map(explicar);
    for (const mensaje of mensajes) {
      expect(mensaje).not.toMatch(/indentation|mapping|expected|duplicated/i);
    }
  });

  it("un error que no es de YAML tambien sale en español", () => {
    expect(explicarErrorYaml("title: T", new Error("boom"))).toBe(
      "El frontmatter tiene un error de formato. Revisa que cada campo sea «nombre: valor» y esté pegado al margen izquierdo.",
    );
  });
});

// Casos de M-260: salian en español, pero con la causa o la linea equivocadas.
describe("explicarErrorYaml · casos raros (M-260)", () => {
  it.each(["@", "`", "%"])(
    "un valor que empieza con «%s» no se confunde con «: » dentro del texto",
    (signo) => {
      expect(explicar(`title: T\ndescription: ${signo}algo de texto`)).toBe(
        `La línea 3 (\`description\`) empieza con «${signo}», que en YAML tiene otro uso. Pon el texto entre comillas: description: "…".`,
      );
    },
  );

  it("con todo el frontmatter igual de sangrado, culpa al fallo real y no a la sangria", () => {
    expect(explicar('  title: T\n  description: "abc')).toBe(
      "La línea 3 (`description`) abre comillas y no las cierra.",
    );
  });

  it("encuentra la comilla sin cerrar dentro de un elemento de tags", () => {
    expect(explicar('title: T\ntags:\n  - "a\ndescription: D')).toBe(
      "La línea 4 abre comillas y no las cierra.",
    );
  });

  it("una comilla escapada no cuenta como cierre", () => {
    expect(explicar('title: "a \\" b\ndescription: D')).toBe(
      "La línea 2 (`title`) abre comillas y no las cierra.",
    );
  });

  it("nombra el campo repetido aunque vaya entre comillas", () => {
    expect(explicar('"title": a\n"title": b')).toBe(
      "El campo `title` aparece dos veces (línea 3). Deja solo uno.",
    );
  });
});
