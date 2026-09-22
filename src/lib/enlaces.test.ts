import { describe, expect, it } from "vitest";
import { esExterno } from "./enlaces";

describe("esExterno", () => {
  it("distingue una ruta interna de una URL de otro sitio", () => {
    expect(esExterno("/blog/")).toBe(false);
    expect(esExterno("https://gofundme.com/f/algo")).toBe(true);
  });
});
