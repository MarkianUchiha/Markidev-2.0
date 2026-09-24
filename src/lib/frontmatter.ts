import { z } from "astro/zod";
import { load, dump } from "js-yaml";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeRaw from "rehype-raw";
import rehypeSlug from "rehype-slug";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import rehypeShikiFromHighlighter from "@shikijs/rehype/core";
import { createHighlighterCore } from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";
import githubDark from "@shikijs/themes/github-dark";
import langBash from "@shikijs/langs/bash";
import langCss from "@shikijs/langs/css";
import langHtml from "@shikijs/langs/html";
import langJson from "@shikijs/langs/json";
import langJs from "@shikijs/langs/javascript";
import langSql from "@shikijs/langs/sql";
import langTs from "@shikijs/langs/typescript";
import rehypeStringify from "rehype-stringify";
import { explicarErrorYaml } from "./yaml-legible";

// Lo que antes hacia Astro al leer `src/content/blog/*.md` hay que hacerlo aqui
// a mano, porque el markdown ya no llega del repositorio sino de un archivo que
// alguien sube al panel. Son tres trabajos distintos y este modulo es el unico
// lugar donde viven: separar el frontmatter, validarlo y convertir el cuerpo.
//
// El archivo se llama `frontmatter` y no `schemas` a proposito: al lado hay un
// `schema.ts` que genera el JSON-LD, y dos nombres a una letra de distancia se
// confunden al importar.

// La unica definicion del frontmatter del blog: `src/content.config.ts` ya no
// tiene la suya desde que el contenido se mudo a D1.
// Los mensajes van escritos y en español porque ya no los lee quien compila:
// los lee, en pantalla, quien acaba de subir un archivo que no paso. Tienen que
// decir que campo falla y como se arregla, no solo que algo esta mal.
export const esquemaBlog = z.object({
  title: z
    .string({ message: "Falta el título." })
    // Un titulo vacio (o solo espacios, ya recortado) es un titulo que falta.
    .min(1, "Falta el título.")
    .max(70, "El título pasa de 70 caracteres; Google lo va a recortar."),
  // Se convierte en la meta description. El maximo si es de Google: corta por
  // ancho, hacia los 155-160 caracteres. El minimo NO es regla de Google, es
  // criterio del proyecto (2026-09-23): una descripcion corta desperdicia el
  // espacio del resultado y Google tiende a sustituirla por texto de la pagina.
  description: z
    .string({ message: "Falta la descripción." })
    .min(70, "La descripción necesita al menos 70 caracteres.")
    .max(
      160,
      "La descripción pasa de 160 caracteres; Google la va a recortar.",
    ),
  question: z.string().optional(),
  pubDate: z.coerce.date({
    message: "Falta la fecha, o no tiene forma de fecha (2026-09-20).",
  }),
  updatedDate: z.coerce
    .date({ message: "La fecha de actualización no tiene forma de fecha." })
    .optional(),
  draft: z
    .boolean({ message: "`draft` solo puede ser true o false." })
    .default(false),
  tags: z
    .array(z.string(), { message: "`tags` tiene que ser una lista." })
    .default([]),
});

export type DatosBlog = z.infer<typeof esquemaBlog>;

// La forma con la que un articulo viaja por el sitio. Es la misma que tenian las
// entradas de coleccion de Astro —`{ id, data }`— para que las paginas y el
// JSON-LD no se enteren de que el contenido cambio de casa. Vive aqui y no en
// `content.ts` porque aquel modulo arrastra el binding de D1, y el generador de
// JSON-LD solo necesita el tipo.
export interface EntradaBlog {
  id: string;
  data: DatosBlog;
}

// El frontmatter abre en la primera linea y cierra en el siguiente `---` que
// este solo en su renglon. No se usa `gray-matter`, que seria lo habitual:
// depende de `Buffer` y este codigo corre en workerd, donde no hay APIs de Node
// salvo que se active `nodejs_compat`.
const SEPARADOR = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

export interface MarkdownLeido {
  datos: DatosBlog;
  cuerpo: string;
}

/**
 * Lee un `.md` completo. Lanza con un mensaje en español si el archivo no trae
 * frontmatter o si algun campo no cumple el esquema: ese texto se le enseña a
 * quien subio el archivo, asi que tiene que decirle que arreglar.
 */
export function leerMarkdown(texto: string): MarkdownLeido {
  const coincidencia = texto.match(SEPARADOR);
  if (!coincidencia) {
    throw new Error(
      "El archivo no empieza con un bloque de frontmatter entre lineas de ---.",
    );
  }

  let crudo: unknown;
  try {
    crudo = load(coincidencia[1]);
  } catch (error) {
    throw new Error(explicarErrorYaml(coincidencia[1], error));
  }

  const resultado = esquemaBlog.safeParse(crudo);
  if (!resultado.success) {
    const problemas = resultado.error.issues
      .map(
        (issue) => `${issue.path.join(".") || "frontmatter"}: ${issue.message}`,
      )
      .join("; ");
    throw new Error(`El frontmatter no cumple el esquema. ${problemas}`);
  }

  return {
    datos: resultado.data,
    cuerpo: texto.slice(coincidencia[0].length).trim(),
  };
}

// Los encabezados llevan `id` para poder enlazar a una seccion, que es lo que
// Astro hacia solo. El esquema de saneado por defecto no deja pasar `id`, asi
// que hay que devolverselo — y solo a los encabezados, que son los unicos que lo
// reciben de `rehype-slug`.
const SANEADO = {
  ...defaultSchema,
  // Sin esto, cada id sale como `user-content-primero-comprueba...`. El prefijo
  // es la defensa contra DOM clobbering —un id del autor pisando una variable
  // global— pero aqui rompe algo concreto: las anclas que ya estan publicadas y
  // enlazadas. Se quita a sabiendas; el HTML ya viene sin scripts ni atributos
  // de evento, y el poco JavaScript del sitio busca sus elementos por
  // `getElementById`, que no pasa por `window`.
  clobberPrefix: "",
  attributes: {
    ...defaultSchema.attributes,
    h1: [...(defaultSchema.attributes?.h1 ?? []), "id"],
    h2: [...(defaultSchema.attributes?.h2 ?? []), "id"],
    h3: [...(defaultSchema.attributes?.h3 ?? []), "id"],
    h4: [...(defaultSchema.attributes?.h4 ?? []), "id"],
    h5: [...(defaultSchema.attributes?.h5 ?? []), "id"],
    h6: [...(defaultSchema.attributes?.h6 ?? []), "id"],
  },
};

// El saneado va DESPUES de convertir, no antes: lo que hay que limpiar es el
// HTML resultante, y el markdown permite incrustar HTML crudo. Quien escriba
// sera alguien contratado, asi que su texto no se trata como de confianza.
//
// Y el resaltado va despues del saneado, no antes, por el mismo motivo al
// reves: los `style` y las clases que pone Shiki los genera este codigo, no el
// autor, asi que pasarlos por el saneador solo serviria para perderlos. El tema
// es el mismo `github-dark` que traia Astro, para que los articulos ya
// publicados no cambien de aspecto.
//
// Shiki trae dos motores de expresiones regulares. El normal es Oniguruma
// compilado a WebAssembly, y ahi muere: workerd no permite generar codigo Wasm
// en caliente y lanza "Wasm code generation disallowed by embedder". El motor de
// JavaScript existe justo para este entorno. `forgiving` es su companero
// obligado: algunas gramaticas usan construcciones de Oniguruma que no tienen
// equivalente, y sin esto una de ellas tumbaria el guardado entero en vez de
// resaltar un poco peor.
//
// Los lenguajes van uno por uno y no con el paquete completo porque ese bundle
// mete cientos de gramaticas en un worker que tiene limite de tamaño. Estos son
// los que aparecen en un blog de este negocio; cualquier otro cae en
// `plaintext`, que no necesita gramatica.
// Ni el resaltador ni el procesador se arman al cargar el modulo: en workerd el
// ambito global se evalua fuera de una peticion y no admite trabajo asincrono.
// Se construyen la primera vez que se guarda un articulo y se reutilizan —
// cargar las gramaticas en cada guardado seria tirar el trabajo.
let procesador: ReturnType<typeof armarProcesador> | null = null;

async function armarProcesador() {
  const resaltador = await createHighlighterCore({
    themes: [githubDark],
    langs: [langBash, langCss, langHtml, langJson, langJs, langSql, langTs],
    engine: createJavaScriptRegexEngine({ forgiving: true }),
  });

  return (
    unified()
      .use(remarkParse)
      .use(remarkGfm)
      .use(remarkRehype, { allowDangerousHtml: true })
      // `remarkRehype` deja el HTML incrustado como texto crudo, y el saneador,
      // que solo entiende elementos, lo borra entero. Con `rehypeRaw` ese texto
      // se convierte en nodos de verdad y entonces el saneado puede hacer su
      // trabajo: quedarse con un <a href> y tirarle el onclick, en vez de tirar
      // los dos. Sin esto, un articulo con una tabla escrita en HTML se publica
      // sin la tabla y sin avisar.
      .use(rehypeRaw)
      .use(rehypeSlug)
      .use(rehypeSanitize, SANEADO)
      .use(rehypeShikiFromHighlighter, resaltador, {
        theme: "github-dark",
        // `default` es para los bloques que no declaran lenguaje y `fallback`
        // para los que declaran uno que no esta cargado. Sin el primero, un bloque
        // abierto con ``` a secas sale sin el fondo del tema y desentona con los
        // de al lado.
        defaultLanguage: "plaintext",
        fallbackLanguage: "plaintext",
      })
      .use(rehypeStringify)
  );
}

export async function aHtml(markdown: string): Promise<string> {
  procesador ??= armarProcesador();
  const archivo = await (await procesador).process(markdown);
  return String(archivo);
}

/**
 * Rehace el `.md` para descargarlo. No devuelve el archivo original byte a byte
 * —las fechas se normalizan y las claves salen en el orden del esquema— pero al
 * volver a subirlo produce exactamente los mismos datos.
 */
export function aMarkdown(datos: DatosBlog, cuerpo: string): string {
  // Las fechas van como YYYY-MM-DD y no como ISO completo: el blog no maneja
  // horas y un `2026-09-09T00:00:00.000Z` en el frontmatter no lo lee bien
  // nadie. Si algun dia importara la hora, esto hay que cambiarlo.
  const aFecha = (valor: Date) => valor.toISOString().slice(0, 10);

  const frontmatter: Record<string, unknown> = {
    title: datos.title,
    description: datos.description,
    ...(datos.question ? { question: datos.question } : {}),
    pubDate: aFecha(datos.pubDate),
    ...(datos.updatedDate ? { updatedDate: aFecha(datos.updatedDate) } : {}),
    draft: datos.draft,
    tags: datos.tags,
  };

  return `---\n${dump(frontmatter, { lineWidth: -1 })}---\n\n${cuerpo}\n`;
}
