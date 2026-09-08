import { env } from "cloudflare:workers";
import { defineMiddleware } from "astro:middleware";
import { verificarAcceso } from "./lib/auth";

// Todo lo que cuelga de estas rutas exige un usuario identificado.
const RUTAS_PRIVADAS = ["/panel", "/api/panel"];

function esPrivada(ruta: string): boolean {
  return RUTAS_PRIVADAS.some(
    (base) => ruta === base || ruta.startsWith(`${base}/`),
  );
}

export const onRequest = defineMiddleware(async (contexto, next) => {
  contexto.locals.usuario = null;

  if (!esPrivada(contexto.url.pathname)) {
    return next();
  }

  // En desarrollo no hay Cloudflare Access delante, asi que el panel seria
  // inalcanzable. `import.meta.env.DEV` lo resuelve Vite en tiempo de compilacion:
  // en el build de produccion es literalmente `false` y esta rama desaparece del
  // bundle. No es un portillo que pueda quedar abierto por descuido.
  if (import.meta.env.DEV) {
    contexto.locals.usuario = { email: "local@markidev.com" };
    return next();
  }

  const policyAud = env.POLICY_AUD;
  const teamDomain = env.TEAM_DOMAIN;

  // Sin configuracion no se puede verificar a nadie. Se cierra en vez de dejar
  // pasar: un panel abierto por una variable sin definir es la peor falla posible.
  if (!policyAud || !teamDomain) {
    return new Response("El panel no esta configurado.", { status: 503 });
  }

  const usuario = await verificarAcceso(contexto.request, {
    policyAud,
    teamDomain,
  });

  if (!usuario) {
    return new Response("No autorizado.", { status: 401 });
  }

  contexto.locals.usuario = usuario;
  return next();
});
