// Traduce un error de `js-yaml` a algo que entienda quien escribe el articulo,
// que no es programador (M-257). El mensaje original esta en ingles, habla de
// «mapping entries» y trae un fragmento multilinea que el panel aplana, asi que
// justo la sangria que explicaba el fallo quedaba invisible.
//
// `js-yaml` da el mismo motivo —«bad indentation of a mapping entry»— para tres
// problemas distintos. Por eso no basta con traducir el motivo: se mira la
// linea para saber cual de los tres es.

const GENERICO =
  "Revisa que cada campo sea «nombre: valor» y esté pegado al margen izquierdo.";

interface ErrorDeYaml {
  reason?: string;
  mark?: { line: number };
}

/** El YAML empieza despues de la linea `---`: su linea 0 es la 2 del archivo. */
const lineaDelArchivo = (indice: number) => indice + 2;

// El nombre del campo, tambien si va entre comillas (`"title": …`).
function campoDe(linea: string): string | null {
  const m = linea.match(/^\s*(?:"([^"]+)"|'([^']+)'|([A-Za-z_]\w*))\s*:/);
  return m ? (m[1] ?? m[2] ?? m[3]) : null;
}

const sangria = (linea: string) => linea.match(/^\s*/)![0].length;

// `campo (linea N)` si la linea tiene nombre de campo, o solo `linea N`.
function donde(lineas: string[], indice: number): string {
  const campo = campoDe(lineas[indice] ?? "");
  const numero = lineaDelArchivo(indice);
  return campo ? `La línea ${numero} (\`${campo}\`)` : `La línea ${numero}`;
}

function empiezaConEspacios(lineas: string[], indice: number): string {
  return `${donde(lineas, indice)} empieza con espacios. En el frontmatter cada campo va pegado al margen izquierdo; solo los elementos de \`tags\` llevan sangría.`;
}

// El valor de una linea, sin la sangria, sin el `- ` de un elemento de lista y
// sin el nombre del campo si lo tiene.
function valorDe(linea: string): string {
  return linea.replace(
    /^\s*(?:-\s+)?(?:(?:"[^"]*"|'[^']*'|[A-Za-z_]\w*)\s*:\s*)?/,
    "",
  );
}

// Si un valor que abre con `comilla` la vuelve a cerrar. Una comilla escapada no
// cierra: `\"` dentro de dobles, y `''` dentro de simples.
function cierra(valor: string, comilla: string): boolean {
  for (let i = 1; i < valor.length; i++) {
    if (comilla === '"' && valor[i] === "\\") {
      i++;
      continue;
    }
    if (valor[i] !== comilla) continue;
    if (comilla === "'" && valor[i + 1] === "'") {
      i++;
      continue;
    }
    return true;
  }
  return false;
}

// Signos que YAML reserva al principio de un valor: sin comillas, el texto no
// se lee como texto.
const RESERVADOS = ["@", "`", "%"];

// La ultima linea hasta `hasta` cuyo valor abre comillas y no las cierra. Se
// busca hacia atras porque `js-yaml` se da cuenta en la linea SIGUIENTE.
function comillaSinCerrar(lineas: string[], hasta: number): number | null {
  for (let i = Math.min(hasta, lineas.length - 1); i >= 0; i--) {
    const valor = valorDe(lineas[i]).trimEnd();
    const comilla = valor[0];
    if ((comilla === '"' || comilla === "'") && !cierra(valor, comilla)) {
      return i;
    }
  }
  return null;
}

export function explicarErrorYaml(yaml: string, error: unknown): string {
  const { reason = "", mark } = (error ?? {}) as ErrorDeYaml;
  if (!mark) return `El frontmatter tiene un error de formato. ${GENERICO}`;

  const lineas = yaml.split(/\r?\n/);
  const indice = mark.line;
  const linea = lineas[indice] ?? "";

  if (reason.includes("tab characters")) {
    return `La línea ${lineaDelArchivo(indice)} empieza con un tabulador. En el frontmatter no se usan tabuladores: cada campo va pegado al margen y los elementos de \`tags\` llevan dos espacios.`;
  }

  if (reason.includes("duplicated mapping key")) {
    return `El campo \`${campoDe(linea) ?? "?"}\` aparece dos veces (línea ${lineaDelArchivo(indice)}). Deja solo uno.`;
  }

  // La primera linea con sangria hace que `js-yaml` se queje de la siguiente
  // con otro motivo; el problema esta en la primera. Solo si alguna linea
  // posterior va menos sangrada: todo el bloque igual de sangrado es YAML
  // valido, y entonces el fallo esta en otra parte.
  const conTexto = lineas.filter((l) => l.trim() !== "");
  const primera = lineas.findIndex((l) => l.trim() !== "");
  if (
    primera >= 0 &&
    conTexto.some((l) => sangria(l) < sangria(lineas[primera]))
  ) {
    return empiezaConEspacios(lineas, primera);
  }

  if (reason.includes("bad indentation of a mapping entry")) {
    if (/^\s/.test(linea)) return empiezaConEspacios(lineas, indice);

    const valor = valorDe(linea);
    const reservado = RESERVADOS.find((signo) => valor.startsWith(signo));
    if (reservado) {
      const campo = campoDe(linea) ?? "campo";
      return `${donde(lineas, indice)} empieza con «${reservado}», que en YAML tiene otro uso. Pon el texto entre comillas: ${campo}: "…".`;
    }
    if (valor.startsWith('"') || valor.startsWith("'")) {
      return `${donde(lineas, indice)} cierra las comillas antes de que acabe el texto. Pon todo el texto dentro de las comillas.`;
    }
    const campo = campoDe(linea) ?? "campo";
    return `${donde(lineas, indice)} tiene «: » dentro del texto, y eso se lee como otro campo. Pon el texto entre comillas: ${campo}: "…".`;
  }

  const abierta = comillaSinCerrar(lineas, indice);
  if (abierta !== null) {
    return `${donde(lineas, abierta)} abre comillas y no las cierra.`;
  }

  return `El frontmatter tiene un error de formato cerca de la línea ${lineaDelArchivo(indice)}. ${GENERICO}`;
}
