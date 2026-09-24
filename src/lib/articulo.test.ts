import { describe, expect, it } from "vitest";
import { describirCambios, esquemaSlug, validarEdicion } from "./articulo";

const DESCRIPCION =
  "Una descripción de prueba que tiene justo lo necesario para pasar los setenta.";

function edicion(parcial: Record<string, string> = {}) {
  return {
    title: "Un título",
    description: DESCRIPCION,
    slug: "un-articulo",
    ...parcial,
  };
}

describe("esquemaSlug", () => {
  it("acepta minúsculas, números y guiones sueltos", () => {
    expect(esquemaSlug.safeParse("como-cobrar-2026").success).toBe(true);
  });

  it.each([
    [
      "Mayusculas",
      "La URL solo puede llevar minúsculas, números y guiones sueltos.",
    ],
    [
      "doble--guion",
      "La URL solo puede llevar minúsculas, números y guiones sueltos.",
    ],
    [
      "-al-borde",
      "La URL solo puede llevar minúsculas, números y guiones sueltos.",
    ],
    [
      "acentuación",
      "La URL solo puede llevar minúsculas, números y guiones sueltos.",
    ],
    ["ab", "La URL necesita al menos 3 caracteres."],
    ["a".repeat(81), "La URL pasa de 80 caracteres."],
  ])("rechaza «%s» con un mensaje en español", (slug, mensaje) => {
    const r = esquemaSlug.safeParse(slug);
    expect(r.success).toBe(false);
    expect(r.error?.issues[0].message).toBe(mensaje);
  });
});

describe("validarEdicion", () => {
  it("devuelve la edición limpia, sin espacios de sobra", () => {
    expect(
      validarEdicion(
        edicion({ title: "  Un título  ", slug: " un-articulo " }),
      ),
    ).toEqual({ ok: true, edicion: edicion() });
  });

  it("usa el mismo mensaje que la subida para el título", () => {
    expect(validarEdicion(edicion({ title: "x".repeat(71) }))).toEqual({
      ok: false,
      error: "El título pasa de 70 caracteres; Google lo va a recortar.",
    });
  });

  it("usa el mismo mensaje que la subida para la descripción", () => {
    expect(validarEdicion(edicion({ description: "x".repeat(69) }))).toEqual({
      ok: false,
      error: "La descripción necesita al menos 70 caracteres.",
    });
    expect(validarEdicion(edicion({ description: "x".repeat(161) }))).toEqual({
      ok: false,
      error: "La descripción pasa de 160 caracteres; Google la va a recortar.",
    });
  });

  // Recortar despues de validar dejaba pasar 69 caracteres + un espacio, y el
  // articulo guardado ya no cumplia `esquemaBlog`: desaparecia del sitio y del
  // panel. Hallazgo de la revision de M-234.
  it("mide la descripción ya recortada", () => {
    expect(
      validarEdicion(edicion({ description: `${"x".repeat(69)} \n` })),
    ).toEqual({
      ok: false,
      error: "La descripción necesita al menos 70 caracteres.",
    });
  });

  it("rechaza un título hecho solo de espacios", () => {
    expect(validarEdicion(edicion({ title: "   " }))).toEqual({
      ok: false,
      error: "Falta el título.",
    });
  });

  it("rechaza una URL inválida", () => {
    const r = validarEdicion(edicion({ slug: "Con Espacios" }));
    expect(r.ok).toBe(false);
  });

  it("rechaza un campo que no llegó", () => {
    const { title: _, ...sinTitulo } = edicion();
    expect(validarEdicion(sinTitulo)).toEqual({
      ok: false,
      error: "Falta el título.",
    });
  });
});

describe("describirCambios", () => {
  const antes = { title: "Viejo", description: "Desc vieja", slug: "viejo" };

  it("sin cambios devuelve texto vacío", () => {
    expect(describirCambios(antes, { ...antes })).toBe("");
  });

  it("nombra cada campo que cambió con su valor anterior y el nuevo", () => {
    expect(describirCambios(antes, { ...antes, title: "Nuevo" })).toBe(
      "Cambió el título: «Viejo» → «Nuevo».",
    );
    expect(
      describirCambios(antes, {
        title: "Nuevo",
        description: "Desc nueva",
        slug: "nuevo",
      }),
    ).toBe(
      "Cambió el título: «Viejo» → «Nuevo». " +
        "Cambió la descripción: «Desc vieja» → «Desc nueva». " +
        "Cambió la URL: /blog/viejo/ → /blog/nuevo/.",
    );
  });

  it("ignora la URL cuando no se compara, como en la subida", () => {
    expect(
      describirCambios(
        { title: "A", description: "D" },
        { title: "B", description: "D" },
      ),
    ).toBe("Cambió el título: «A» → «B».");
  });
});
