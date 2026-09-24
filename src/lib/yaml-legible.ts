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

function campoDe(linea: string): string | null {
  return linea.match(/^\s*([A-Za-z_]\w*)\s*:/)?.[1] ?? null;
}

// `campo (linea N)` si la linea tiene nombre de campo, o solo `linea N`.
function donde(lineas: string[], indice: number): string {
  const campo = campoDe(lineas[indice] ?? "");
  const numero = lineaDelArchivo(indice);
  return campo ? `La línea ${numero} (\`${campo}\`)` : `La línea ${numero}`;
}

function empiezaConEspacios(lineas: string[], indice: number): string {
  return `${donde(lineas, indice)} empieza con espacios. En el frontmatter cada campo va pegado al margen izquierdo; solo los elementos de \`tags\` llevan sangría.`;
}

// El valor de una linea `campo: valor`, sin el nombre.
function valorDe(linea: string): string {
  return linea.replace(/^\s*[A-Za-z_]\w*\s*:\s*/, "");
}

// La ultima linea hasta `hasta` cuyo valor abre comillas y no las cierra. Se
// busca hacia atras porque `js-yaml` se da cuenta en la linea SIGUIENTE.
function comillaSinCerrar(lineas: string[], hasta: number): number | null {
  for (let i = Math.min(hasta, lineas.length - 1); i >= 0; i--) {
    const valor = valorDe(lineas[i]).trimEnd();
    const comilla = valor[0];
    if (
      (comilla === '"' || comilla === "'") &&
      valor.indexOf(comilla, 1) === -1
    ) {
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
  // con otro motivo; el problema esta en la primera.
  const primera = lineas.findIndex((l) => l.trim() !== "");
  if (primera >= 0 && /^\s/.test(lineas[primera])) {
    return empiezaConEspacios(lineas, primera);
  }

  if (reason.includes("bad indentation of a mapping entry")) {
    if (/^\s/.test(linea)) return empiezaConEspacios(lineas, indice);

    const valor = valorDe(linea);
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
