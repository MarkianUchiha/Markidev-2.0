import type { Usuario } from "./lib/auth";

declare global {
  namespace App {
    interface Locals {
      // Lo llena el middleware con el correo del JWT de Cloudflare Access.
      // Es null en todo el sitio publico: solo las rutas del panel lo traen.
      usuario: Usuario | null;
    }
  }
}

export {};
