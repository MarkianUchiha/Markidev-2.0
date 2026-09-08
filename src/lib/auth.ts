import { createRemoteJWKSet, jwtVerify } from "jose";

// Cloudflare Access valida al usuario en el borde, antes de que la peticion
// llegue a este codigo. Verificar el JWT igual no es redundante por dos razones:
// es la unica forma de saber *quien* entro (el correo sale del token), y si algun
// dia el Worker queda alcanzable por una ruta que Access no cubre, esto lo frena.

export interface Usuario {
  email: string;
}

interface Config {
  policyAud: string;
  teamDomain: string;
}

// Cloudflare rota las llaves de firma cada 6 semanas. `createRemoteJWKSet` las
// busca por el `kid` del token y las cachea, asi que no hay que fijar ninguna a
// mano ni renovarla al rotar.
const conjuntosDeLlaves = new Map<
  string,
  ReturnType<typeof createRemoteJWKSet>
>();

function llavesDe(teamDomain: string) {
  const existente = conjuntosDeLlaves.get(teamDomain);
  if (existente) return existente;

  const nuevo = createRemoteJWKSet(
    new URL(`https://${teamDomain}/cdn-cgi/access/certs`),
  );
  conjuntosDeLlaves.set(teamDomain, nuevo);
  return nuevo;
}

/**
 * Devuelve el usuario si el token de Access es valido, o null si no lo es.
 * Nunca lanza: un token corrupto es un visitante no autorizado, no un error 500.
 */
export async function verificarAcceso(
  request: Request,
  { policyAud, teamDomain }: Config,
): Promise<Usuario | null> {
  // La cabecera es la fuente recomendada. La cookie CF_Authorization existe como
  // respaldo, pero Cloudflare no garantiza que llegue.
  const token =
    request.headers.get("Cf-Access-Jwt-Assertion") ??
    leerCookie(request, "CF_Authorization");

  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, llavesDe(teamDomain), {
      issuer: `https://${teamDomain}`,
      // Sin comprobar la audiencia, un token valido de *otra* aplicacion del
      // mismo equipo abriria el panel.
      audience: policyAud,
    });

    const email = payload.email;
    if (typeof email !== "string" || email.length === 0) return null;

    return { email };
  } catch {
    return null;
  }
}

function leerCookie(request: Request, nombre: string): string | null {
  const cabecera = request.headers.get("Cookie");
  if (!cabecera) return null;

  for (const parte of cabecera.split(";")) {
    const [clave, ...resto] = parte.trim().split("=");
    if (clave === nombre) return resto.join("=");
  }
  return null;
}
