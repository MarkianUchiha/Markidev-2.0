// Reglas de la pagina de enlaces (`specs/pagina-de-enlaces.md`). Todo lo de
// aqui es puro, sin D1 ni Astro, para poder probarlo con Vitest sin levantar el
// Worker: la base solo guarda lo que estas funciones ya dejaron pasar.

/** Una ruta propia del sitio se abre en la misma pestaña; lo demas, en otra. */
export function esExterno(url: string): boolean {
  return !url.startsWith("/");
}
