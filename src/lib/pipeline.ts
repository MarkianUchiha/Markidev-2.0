// Las etapas del tablero viven aqui y en las restricciones CHECK de
// `migrations/0001_leads.sql`. Son los dos unicos lugares: la API, el tablero y
// el formulario las importan de aqui.
//
// Cada etapa lleva su criterio de salida a la vista. El consenso de ventas B2B
// son 5-7 etapas, pero lo que hace util un tablero no son los nombres sino saber
// que tiene que pasar para mover una tarjeta. Sin ese criterio las tarjetas se
// estancan y el tablero se vuelve decoracion.

export const ETAPAS = [
  {
    id: "nuevo",
    nombre: "Nuevo",
    criterio: "Le respondiste",
  },
  {
    id: "calificando",
    nombre: "Calificando",
    criterio: "Sabes qué necesita y si lo tomas",
  },
  {
    id: "propuesta",
    nombre: "Propuesta",
    criterio: "La mandaste",
  },
  {
    id: "negociacion",
    nombre: "Negociación",
    criterio: "Acordaron alcance, precio y esquema de pago",
  },
  {
    id: "retomar",
    nombre: "Retomar",
    criterio: "Encaja, pero no ahora. Requiere fecha",
  },
  {
    id: "ganado",
    nombre: "Ganado",
    criterio: "Firmó",
  },
  {
    id: "descartado",
    nombre: "Descartado",
    criterio: "No va. Requiere motivo",
  },
] as const;

export type EtapaId = (typeof ETAPAS)[number]["id"];

// `ganado` y `descartado` son archivo, no trabajo: una vez ahi la tarjeta ya no
// se toca. Separarlas deja el tablero activo en cinco columnas, que es lo que
// cabe en una pantalla y lo que se puede revisar de un vistazo.
export const ETAPAS_ACTIVAS = ETAPAS.filter(
  (etapa) => etapa.id !== "ganado" && etapa.id !== "descartado",
);

export const ETAPAS_ARCHIVO = ETAPAS.filter(
  (etapa) => etapa.id === "ganado" || etapa.id === "descartado",
);

// Tupla no vacia porque es lo que pide `z.enum`. Sin la anotacion, `.map()`
// devuelve un array suelto y el esquema acaba validando contra `string`, que
// deja pasar cualquier etapa inventada.
export const ETAPA_IDS = ETAPAS.map((etapa) => etapa.id) as [
  EtapaId,
  ...EtapaId[],
];

export function esEtapa(valor: string): valor is EtapaId {
  return ETAPAS.some((etapa) => etapa.id === valor);
}

export function nombreEtapa(id: EtapaId): string {
  return ETAPAS.find((etapa) => etapa.id === id)?.nombre ?? id;
}

// De donde llego el prospecto. El formulario es solo uno de los cinco: el cliente
// que mas factura llega por WhatsApp o recomendado, y un tablero que solo coma
// del formulario deja fuera justo a ese.
export const CANALES = [
  { id: "formulario", nombre: "Formulario" },
  { id: "whatsapp", nombre: "WhatsApp" },
  { id: "correo", nombre: "Correo" },
  { id: "calcom", nombre: "Agenda" },
  { id: "referido", nombre: "Referido" },
] as const;

export type CanalId = (typeof CANALES)[number]["id"];

export const CANAL_IDS = CANALES.map((canal) => canal.id) as [
  CanalId,
  ...CanalId[],
];

export function esCanal(valor: string): valor is CanalId {
  return CANALES.some((canal) => canal.id === valor);
}
