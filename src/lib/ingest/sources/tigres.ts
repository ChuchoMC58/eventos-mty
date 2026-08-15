import { Connector } from "@/lib/ingest/connector";
import { NormalizedEvent, EventStatus } from "@/lib/events/types";

// Tigres NO está en Ticketmaster: consultado por `venueId`, el Estadio
// Universitario da 0 eventos (ver FUENTES.md). Su calendario lo pinta un
// componente de terceros (Datagraph, de mango-soft) que lee una API JSON sin
// autenticación. La URL salió de capturar la red del navegador; el bundle no la
// trae como literal.
//
// Dos etapas, y la primera NO es opcional: el `edition_id` es el id del torneo y
// cambia cada temporada (Apertura → Clausura). Hardcodearlo mata la fuente cada
// seis meses, así que se lee de la propia página del calendario.
const CALENDARIO = "https://www.tigres.com.mx/es/tigres/calendario/";
const UA = "eventos-mty/1.0 (+https://github.com/ChuchoMC58/eventos-mty)";

// El Volcán. La API no manda sede —trae la liga entera, no sólo Monterrey— así
// que el recinto de los partidos de local se sabe por definición, no por dato.
const VENUE = "Estadio Universitario";
const DIRECCION = "Av. Manuel L. Barragán s/n, Ciudad Universitaria, San Nicolás de los Garza";

const BOLETOS = "https://boletomovil.com/club-tigres";

interface Equipo {
  id?: string;
  name?: string;
}

interface Partido {
  name?: string;
  start?: string;
  status?: { name?: string };
  matchday_id?: string;
  home?: Equipo;
  visitor?: Equipo;
  edition?: { name?: string; end_date?: string };
}

/**
 * Los atributos del componente vienen con **espacios alrededor del `=`**
 * (`edition = "…"`), que es justo lo que rompió el primer intento de leerlos con
 * un patrón normal. Mismo caso que las etiquetas partidas de CONARTE: los
 * patrones aceptan cualquier espacio en blanco.
 */
export function leerConfig(html: string): { edicion: string; equipo: string } | null {
  const edicion = html.match(/\bedition\s*=\s*"([^"]+)"/)?.[1];
  const equipo = html.match(/\bid-team-tigres\s*=\s*"([^"]+)"/)?.[1];
  const base = html.match(/\burl\s*=\s*"(https:\/\/[^"]*datagraph[^"]*)"/)?.[1];
  if (!edicion || !equipo || !base) return null;
  return { edicion, equipo };
}

function statusFrom(nombre?: string): EventStatus {
  // La API sólo distingue estados de juego (Not Started / Playing / Finish);
  // no tiene cancelado ni pospuesto. Un partido reprogramado simplemente cambia
  // de `start`, y como la ingesta corre a diario, se corrige solo.
  if (nombre === "Suspended" || nombre === "Postponed") return "pospuesto";
  if (nombre === "Cancelled") return "cancelado";
  return "activo";
}

export function mapPartido(p: Partido, idEquipo: string, ahora: Date): NormalizedEvent | null {
  if (p.home?.id !== idEquipo) return null; // sólo de local: de visita no se juega aquí
  if (!p.start || !p.home?.name || !p.visitor?.name) return null;
  const inicio = new Date(p.start);
  if (Number.isNaN(inicio.getTime()) || inicio <= ahora) return null;

  const jornada = p.matchday_id ? ` — Jornada ${p.matchday_id}` : "";
  return {
    title: `${p.home.name} vs ${p.visitor.name}${jornada}`,
    startsAt: inicio,
    category: "deportes",
    tags: ["futbol", "liga mx"],
    // La API no trae precio y el checkout es de Boletomóvil: `undefined` es
    // "no sé", que no es lo mismo que gratis (regla 4).
    ticketUrl: BOLETOS,
    status: statusFrom(p.status?.name),
    venue: { name: VENUE, address: DIRECCION },
    city: "monterrey",
  };
}

export function tigresConnector(fetchFn: typeof fetch = fetch): Connector {
  return {
    slug: "tigres",
    // Son 7 partidos de local por torneo: el default de 5 haría que perder dos
    // de tres pareciera normal.
    minExpected: 2,
    name: "Tigres UANL",
    async fetchEvents() {
      const resPagina = await fetchFn(CALENDARIO, { headers: { "User-Agent": UA } });
      if (!resPagina.ok) throw new Error(`Tigres: calendario HTTP ${resPagina.status}`);
      const config = leerConfig(await resPagina.text());
      if (!config) {
        throw new Error("Tigres: no se pudo leer edition/id-team del calendario (¿cambió el componente?)");
      }

      const url = `https://datagraph-api.tigrespromo.com/v1/objects/match?edition_id=${config.edicion}`;
      const res = await fetchFn(url, { headers: { "User-Agent": UA } });
      if (!res.ok) throw new Error(`Tigres: API HTTP ${res.status}`);
      const partidos = (await res.json()) as Partido[];
      if (!Array.isArray(partidos) || partidos.length === 0) {
        throw new Error("Tigres: la API no devolvió partidos");
      }

      // 🔴 La página se queda apuntando a un torneo VENCIDO. Comprobado el
      // 2026-08-13: la del femenil sigue en "Liga MX Femenil - 1 Clausura", que
      // terminó el 30 de junio, y por eso da cero partidos futuros. Sin esta
      // comprobación, el varonil haría lo mismo en enero y la fuente se apagaría
      // en silencio —el caso que la regla 1 prohíbe—, porque "0 partidos" es
      // indistinguible de "todavía no publican el calendario".
      const fin = partidos[0].edition?.end_date;
      if (fin) {
        const finFecha = new Date(fin.replace(" ", "T") + "Z");
        if (!Number.isNaN(finFecha.getTime()) && finFecha < new Date()) {
          throw new Error(
            `Tigres: el calendario apunta a "${partidos[0].edition?.name}", que terminó el ${fin}. ` +
              `Hay que esperar a que el sitio actualice el edition_id del torneo nuevo.`,
          );
        }
      }

      const ahora = new Date();
      const eventos = partidos
        .map((p) => mapPartido(p, config.equipo, ahora))
        .filter((e): e is NormalizedEvent => e !== null);

      // El id del equipo también sale de la página, así que si cambia de formato
      // el filtro de "local" deja pasar cero sin que la API falle.
      const deTigres = partidos.filter((p) => p.home?.id === config.equipo || p.visitor?.id === config.equipo);
      if (deTigres.length === 0) {
        throw new Error(
          `Tigres: ninguno de los ${partidos.length} partidos de la edición es de Tigres; ` +
            `el id del equipo (${config.equipo}) ya no coincide`,
        );
      }

      return eventos;
    },
  };
}
