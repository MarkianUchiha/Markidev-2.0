import { describe, expect, it } from "vitest";
import {
  enlacesVisibles,
  esExterno,
  estadoEnlace,
  intercambioDeOrden,
  validarEnlace,
  venceAlFinalDelDia,
  type Enlace,
} from "./enlaces";

function enlace(parcial: Partial<Enlace> & { id: string }): Enlace {
  return {
    titulo: "Un enlace",
    url: "https://example.com/",
    descripcion: null,
    visible: true,
    vence_en: null,
    orden: 1,
    ...parcial,
  };
}

describe("esExterno", () => {
  it("distingue una ruta interna de una URL de otro sitio", () => {
    expect(esExterno("/blog/")).toBe(false);
    expect(esExterno("https://gofundme.com/f/algo")).toBe(true);
  });

  it("trata `//dominio` como externo: el navegador lo abre en otro sitio", () => {
    expect(esExterno("//evil.com/")).toBe(true);
  });
});

describe("validarEnlace", () => {
  const valido = { titulo: "Mi campaña", url: "https://gofundme.com/f/algo" };

  it("acepta https y http", () => {
    expect(validarEnlace(valido).ok).toBe(true);
    expect(validarEnlace({ ...valido, url: "http://example.com/" }).ok).toBe(
      true,
    );
  });

  it("acepta una ruta interna con barra final, con ancla o consulta", () => {
    expect(validarEnlace({ ...valido, url: "/blog/" }).ok).toBe(true);
    expect(validarEnlace({ ...valido, url: "/blog/por-que/#causas" }).ok).toBe(
      true,
    );
    expect(
      validarEnlace({ ...valido, url: "/trabajos/?desde=tiktok" }).ok,
    ).toBe(true);
  });

  it.each([
    ["javascript:alert(1)"],
    ["JavaScript:alert(1)"],
    ["data:text/html,<script>alert(1)</script>"],
    ["ftp://example.com/"],
    ["mailto:contacto@markidev.com"],
    ["//evil.com/"],
    ["/\\evil.com/"],
    ["/blog"],
    ["blog/"],
    ["https://"],
    [""],
  ])("rechaza la URL %s", (url) => {
    expect(validarEnlace({ ...valido, url }).ok).toBe(false);
  });

  it("recorta espacios del título y la URL", () => {
    const r = validarEnlace({ titulo: "  Hola  ", url: "  /blog/  " });
    expect(r.ok && r.enlace).toMatchObject({ titulo: "Hola", url: "/blog/" });
  });

  it("exige título de 1 a 80 caracteres", () => {
    expect(validarEnlace({ ...valido, titulo: "   " }).ok).toBe(false);
    expect(validarEnlace({ ...valido, titulo: "a".repeat(80) }).ok).toBe(true);
    expect(validarEnlace({ ...valido, titulo: "a".repeat(81) }).ok).toBe(false);
  });

  it("deja la descripción opcional, de hasta 120, y la vacía como null", () => {
    const sin = validarEnlace({ ...valido, descripcion: "  " });
    expect(sin.ok && sin.enlace.descripcion).toBeNull();
    expect(validarEnlace({ ...valido, descripcion: "a".repeat(120) }).ok).toBe(
      true,
    );
    expect(validarEnlace({ ...valido, descripcion: "a".repeat(121) }).ok).toBe(
      false,
    );
  });

  it("convierte el día de vencimiento al final de ese día en México", () => {
    const r = validarEnlace({ ...valido, vence: "2026-10-01" });
    expect(r.ok && r.enlace.vence_en).toBe("2026-10-02T05:59:59.999Z");
  });

  it("deja el vencimiento vacío como null y rechaza fechas que no existen", () => {
    const sin = validarEnlace({ ...valido, vence: "" });
    expect(sin.ok && sin.enlace.vence_en).toBeNull();
    expect(validarEnlace({ ...valido, vence: "2026-02-30" }).ok).toBe(false);
    expect(validarEnlace({ ...valido, vence: "mañana" }).ok).toBe(false);
  });

  it("explica en español qué falló", () => {
    const r = validarEnlace({ ...valido, url: "javascript:alert(1)" });
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error).toMatch(/URL/);
  });
});

describe("venceAlFinalDelDia", () => {
  it("es el último milisegundo del día en la Ciudad de México (UTC-6)", () => {
    expect(venceAlFinalDelDia("2026-12-31")).toBe("2027-01-01T05:59:59.999Z");
  });
});

describe("estadoEnlace y enlacesVisibles", () => {
  const ahora = new Date("2026-10-01T12:00:00Z");

  it("distingue visible, oculto y vencido", () => {
    expect(estadoEnlace(enlace({ id: "a" }), ahora)).toBe("visible");
    expect(estadoEnlace(enlace({ id: "a", visible: false }), ahora)).toBe(
      "oculto",
    );
    expect(
      estadoEnlace(
        enlace({ id: "a", vence_en: "2026-10-01T05:59:59.999Z" }),
        ahora,
      ),
    ).toBe("vencido");
    expect(
      estadoEnlace(
        enlace({ id: "a", vence_en: "2026-10-02T05:59:59.999Z" }),
        ahora,
      ),
    ).toBe("visible");
  });

  it("vencido gana sobre oculto: es lo que hay que corregir", () => {
    expect(
      estadoEnlace(
        enlace({
          id: "a",
          visible: false,
          vence_en: "2026-09-01T05:59:59.999Z",
        }),
        ahora,
      ),
    ).toBe("vencido");
  });

  it("devuelve solo los visibles y no vencidos, por orden", () => {
    const lista = [
      enlace({ id: "c", orden: 3 }),
      enlace({ id: "oculto", orden: 1, visible: false }),
      enlace({ id: "a", orden: 2 }),
      enlace({ id: "vencido", orden: 0, vence_en: "2026-09-30T05:59:59.999Z" }),
    ];
    expect(enlacesVisibles(lista, ahora).map((e) => e.id)).toEqual(["a", "c"]);
  });
});

describe("intercambioDeOrden", () => {
  const lista = [
    enlace({ id: "a", orden: 1 }),
    enlace({ id: "b", orden: 4 }),
    enlace({ id: "c", orden: 9 }),
  ];

  it("al subir, intercambia el orden con el de arriba", () => {
    expect(intercambioDeOrden(lista, "b", "subir")).toEqual([
      { id: "b", orden: 1 },
      { id: "a", orden: 4 },
    ]);
  });

  it("al bajar, intercambia el orden con el de abajo", () => {
    expect(intercambioDeOrden(lista, "b", "bajar")).toEqual([
      { id: "b", orden: 9 },
      { id: "c", orden: 4 },
    ]);
  });

  it("no hace nada en los extremos ni con un id que no existe", () => {
    expect(intercambioDeOrden(lista, "a", "subir")).toBeNull();
    expect(intercambioDeOrden(lista, "c", "bajar")).toBeNull();
    expect(intercambioDeOrden(lista, "x", "subir")).toBeNull();
  });

  it("no depende de que la lista llegue ordenada", () => {
    const desordenada = [lista[2], lista[0], lista[1]];
    expect(intercambioDeOrden(desordenada, "c", "subir")).toEqual([
      { id: "c", orden: 4 },
      { id: "b", orden: 9 },
    ]);
  });
});
