import { useId, useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  ETAPAS,
  ETAPAS_ACTIVAS,
  ETAPAS_ARCHIVO,
  type EtapaId,
} from "../../lib/pipeline";
// Solo el tipo. `lib/db` importa `cloudflare:workers`, que no existe en el
// navegador: si esto dejara de ser `import type`, el bundle del panel reventaria.
import type { Lead } from "../../lib/db";

interface Props {
  iniciales: Lead[];
}

// Las dos etapas que no aceptan una tarjeta sin justificacion. La base tambien lo
// impone con CHECK; aqui se pide antes para no chocar contra un error de SQL.
const EXIGEN_DATO: Partial<
  Record<
    EtapaId,
    {
      campo: "motivo" | "retomar_el";
      titulo: string;
      etiqueta: string;
      tipo: string;
    }
  >
> = {
  descartado: {
    campo: "motivo",
    titulo: "¿Por qué se descarta?",
    etiqueta: "Motivo",
    tipo: "text",
  },
  retomar: {
    campo: "retomar_el",
    titulo: "¿Cuándo lo retomas?",
    etiqueta: "Fecha",
    tipo: "date",
  },
};

interface Pendiente {
  lead: Lead;
  etapa: EtapaId;
  config: (typeof EXIGEN_DATO)[EtapaId] & {};
}

export default function Tablero({ iniciales }: Props) {
  const [leads, setLeads] = useState(iniciales);
  const [arrastrando, setArrastrando] = useState<Lead | null>(null);
  const [pendiente, setPendiente] = useState<Pendiente | null>(null);
  const [error, setError] = useState<string | null>(null);

  // PointerSensor cubre raton y tactil con el mismo codigo. El de teclado no es
  // adorno: sin el, mover una tarjeta seria imposible sin raton.
  const sensores = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );

  async function guardarMovimiento(
    lead: Lead,
    etapa: EtapaId,
    extra?: Record<string, string>,
  ) {
    const previos = leads;

    // Se pinta el movimiento antes de que responda el servidor: con una sola
    // persona usandolo, esperar el viaje de ida y vuelta se siente roto.
    setLeads((actuales) =>
      actuales.map((item) =>
        item.id === lead.id ? { ...item, etapa, ...extra } : item,
      ),
    );
    setError(null);

    try {
      // La barra final es obligatoria: `trailingSlash: "always"` hace que la
      // misma ruta sin ella responda 404.
      const respuesta = await fetch(`/api/panel/leads/${lead.id}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ etapa, ...extra }),
      });

      if (!respuesta.ok) {
        const detalle = (await respuesta.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(
          detalle?.error ?? `El servidor respondió ${respuesta.status}`,
        );
      }
    } catch (fallo) {
      // Se revierte: dejar la tarjeta donde no quedo guardada es peor que no
      // haberla movido, porque el tablero mentiria hasta la siguiente recarga.
      setLeads(previos);
      setError(
        fallo instanceof Error ? fallo.message : "No se pudo mover la tarjeta.",
      );
    }
  }

  function alSoltar(evento: DragEndEvent) {
    setArrastrando(null);

    const destino = evento.over?.id;
    if (!destino || typeof destino !== "string") return;

    const lead = leads.find((item) => item.id === evento.active.id);
    if (!lead || lead.etapa === destino) return;

    const etapa = destino as EtapaId;
    const config = EXIGEN_DATO[etapa];

    if (config) {
      setPendiente({ lead, etapa, config });
      return;
    }

    void guardarMovimiento(lead, etapa);
  }

  function alEmpezar(evento: DragStartEvent) {
    setArrastrando(leads.find((item) => item.id === evento.active.id) ?? null);
  }

  return (
    <DndContext sensors={sensores} onDragStart={alEmpezar} onDragEnd={alSoltar}>
      {error && (
        <p
          className="border-border text-ink text-body mb-6 rounded-md border px-5 py-4"
          role="alert"
        >
          {error}
        </p>
      )}

      <div className="grid gap-4 [grid-template-columns:repeat(5,minmax(220px,1fr))] overflow-x-auto pb-4">
        {ETAPAS_ACTIVAS.map((etapa) => (
          <Columna
            key={etapa.id}
            etapa={etapa}
            leads={leads.filter((lead) => lead.etapa === etapa.id)}
          />
        ))}
      </div>

      {/* Ganado y descartado son archivo: se ven, pero abajo y en gris, para que
			    no compitan por la atencion con las columnas donde si hay trabajo. */}
      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        {ETAPAS_ARCHIVO.map((etapa) => (
          <Columna
            key={etapa.id}
            etapa={etapa}
            leads={leads.filter((lead) => lead.etapa === etapa.id)}
            apagada
          />
        ))}
      </div>

      <DragOverlay>
        {arrastrando && <Tarjeta lead={arrastrando} superpuesta />}
      </DragOverlay>

      {pendiente && (
        <DialogoDato
          pendiente={pendiente}
          onCancelar={() => setPendiente(null)}
          onConfirmar={(valor) => {
            void guardarMovimiento(pendiente.lead, pendiente.etapa, {
              [pendiente.config.campo]: valor,
            });
            setPendiente(null);
          }}
        />
      )}
    </DndContext>
  );
}

function Columna({
  etapa,
  leads,
  apagada = false,
}: {
  etapa: (typeof ETAPAS)[number];
  leads: Lead[];
  apagada?: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: etapa.id });

  return (
    <section
      ref={setNodeRef}
      className={`rounded-lg border p-3 transition-colors ${
        isOver
          ? "border-accent bg-accent-soft"
          : "border-hairline bg-surface-sunken"
      }`}
    >
      <h2
        className={`text-body-sm font-semibold ${apagada ? "text-ink-soft" : "text-ink-strong"}`}
      >
        {etapa.nombre}
        <span className="text-ink-soft ml-2 font-normal">{leads.length}</span>
      </h2>
      {/* El criterio de salida a la vista es lo que evita que el tablero se
			    vuelva decoracion: dice que tiene que pasar para mover la tarjeta. */}
      <p className="text-micro text-ink-soft mt-1 mb-3 leading-snug">
        {etapa.criterio}
      </p>

      <ul className="flex flex-col gap-2">
        {leads.map((lead) => (
          <li key={lead.id}>
            <Tarjeta lead={lead} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function Tarjeta({
  lead,
  superpuesta = false,
}: {
  lead: Lead;
  superpuesta?: boolean;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: lead.id,
  });

  return (
    <article
      ref={superpuesta ? undefined : setNodeRef}
      {...(superpuesta ? {} : listeners)}
      {...(superpuesta ? {} : attributes)}
      className={`border-hairline bg-surface rounded-md border p-3 text-left ${
        superpuesta ? "shadow-lg" : "cursor-grab"
      } ${isDragging ? "opacity-40" : ""}`}
    >
      <p className="text-body-sm text-ink-strong font-semibold">
        {lead.nombre}
      </p>
      {lead.contacto && (
        <p className="text-micro text-ink-muted mt-1 break-all">
          {lead.contacto}
        </p>
      )}
      <p className="text-micro text-ink-soft mt-2 uppercase">{lead.canal}</p>
      {lead.retomar_el && (
        <p className="text-micro text-accent-text mt-2">
          Retomar: {lead.retomar_el}
        </p>
      )}
    </article>
  );
}

function DialogoDato({
  pendiente,
  onCancelar,
  onConfirmar,
}: {
  pendiente: Pendiente;
  onCancelar: () => void;
  onConfirmar: (valor: string) => void;
}) {
  const [valor, setValor] = useState("");
  const campoId = useId();

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <form
        className="bg-surface w-full max-w-[400px] rounded-lg p-6"
        onSubmit={(evento) => {
          evento.preventDefault();
          if (valor.trim()) onConfirmar(valor.trim());
        }}
      >
        <h2 className="text-title text-ink-strong mb-1 font-semibold">
          {pendiente.config.titulo}
        </h2>
        <p className="text-body-sm text-ink-muted mb-5">
          {pendiente.lead.nombre}
        </p>

        <label
          htmlFor={campoId}
          className="text-body-sm text-ink-strong mb-2 block font-semibold"
        >
          {pendiente.config.etiqueta}
        </label>
        <input
          id={campoId}
          type={pendiente.config.tipo}
          value={valor}
          required
          autoFocus
          onChange={(evento) => setValor(evento.target.value)}
          className="border-border bg-surface text-ink text-body focus:border-ink-soft mb-6 w-full rounded-md border px-4 py-2.5 focus:outline-none"
        />

        <div className="flex gap-3">
          <button
            type="submit"
            className="bg-accent text-on-accent hover:bg-accent-hover text-body-sm rounded-md px-5 py-2.5 font-semibold transition-colors"
          >
            Mover
          </button>
          <button
            type="button"
            onClick={onCancelar}
            className="border-border text-ink hover:border-ink-soft text-body-sm rounded-md border px-5 py-2.5 font-semibold transition-colors"
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}
