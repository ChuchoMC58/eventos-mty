import { Connector } from "@/lib/ingest/connector";
import { NormalizedEvent, Category, EventStatus } from "@/lib/events/types";

const SEGMENT_TO_CATEGORY: Record<string, Category> = {
  Music: "musica",
  Sports: "deportes",
  "Arts & Theatre": "cultura",
};

interface TmEvent {
  name?: string;
  url?: string;
  images?: Array<{ url?: string }>;
  dates?: { start?: { dateTime?: string }; status?: { code?: string } };
  classifications?: Array<{ segment?: { name?: string }; genre?: { name?: string } }>;
  priceRanges?: Array<{ min?: number; max?: number }>;
  _embedded?: {
    venues?: Array<{
      name?: string;
      address?: { line1?: string };
      state?: { stateCode?: string };
    }>;
  };
}

interface TmRespuesta {
  _embedded?: { events?: TmEvent[] };
  page?: { totalElements?: number; totalPages?: number; number?: number };
}

/**
 * Monterrey es un ÁREA METROPOLITANA y `city=Monterrey` sólo devuelve el
 * municipio: el Estadio BBVA está en Guadalupe y el Foro Corona en
 * "Col. Centro Monterrey", que para Ticketmaster son ciudades distintas. Medido
 * el 2026-08-13 con la llave de prod, esa consulta se comía **41 de 131**
 * eventos —los partidos de Rayados enteros y tres fechas de Karol G— sin que
 * nada lo notara: el conteo seguía siendo alto y `hayCaida()` sólo ve la caída
 * a cero. Por eso se pregunta por geohash + radio, que no depende de cómo
 * Ticketmaster reparta los municipios.
 *
 * El geohash es la Macroplaza (25.6866, -100.3161). 30 km cubre el área metro
 * completa: con 50 km sale exactamente el mismo conjunto, y Saltillo —lo
 * siguiente que habría— está a 85.
 */
const GEOHASH_MTY = "9u8djk053";
const RADIO_KM = 30;

/**
 * La consulta vieja pedía `size=100` y traía 90 de 90: estaba a diez eventos de
 * truncarse en silencio. Ahora se pagina de verdad. El tope existe para que un
 * parámetro ignorado (que en esta API devuelve 200 con el catálogo nacional) no
 * se convierta en un bucle de miles de eventos.
 */
const TAM_PAGINA = 100;
const MAX_PAGINAS = 10;

function statusFrom(code?: string): EventStatus {
  if (code === "cancelled") return "cancelado";
  if (code === "postponed" || code === "rescheduled") return "pospuesto";
  return "activo";
}

export function mapTicketmasterEvent(e: TmEvent): NormalizedEvent | null {
  const segment = e.classifications?.[0]?.segment?.name;
  const category = segment ? SEGMENT_TO_CATEGORY[segment] : undefined;
  const dateTime = e.dates?.start?.dateTime;
  const venue = e._embedded?.venues?.[0];
  if (!category || !e.name || !dateTime || !venue?.name) return null;
  const genre = e.classifications?.[0]?.genre?.name;
  return {
    title: e.name,
    startsAt: new Date(dateTime),
    category,
    tags: genre ? [genre.toLowerCase()] : [],
    priceMin: e.priceRanges?.[0]?.min,
    priceMax: e.priceRanges?.[0]?.max,
    ticketUrl: e.url,
    imageUrl: e.images?.[0]?.url,
    status: statusFrom(e.dates?.status?.code),
    venue: { name: venue.name, address: venue.address?.line1 },
    city: "monterrey",
  };
}

export function ticketmasterConnector(fetchFn: typeof fetch = fetch): Connector {
  return {
    slug: "ticketmaster",
    name: "Ticketmaster MX",
    async fetchEvents() {
      const key = process.env.TICKETMASTER_API_KEY;
      if (!key) throw new Error("Falta TICKETMASTER_API_KEY");

      const eventos: TmEvent[] = [];
      for (let pagina = 0; pagina < MAX_PAGINAS; pagina++) {
        const url =
          `https://app.ticketmaster.com/discovery/v2/events.json` +
          `?geoPoint=${GEOHASH_MTY}&radius=${RADIO_KM}&unit=km&countryCode=MX` +
          `&size=${TAM_PAGINA}&page=${pagina}&apikey=${key}`;
        const res = await fetchFn(url);
        if (!res.ok) throw new Error(`Ticketmaster HTTP ${res.status}`);
        const data = (await res.json()) as TmRespuesta;
        const lote = data._embedded?.events ?? [];
        eventos.push(...lote);

        const totalPaginas = data.page?.totalPages ?? 1;
        if (lote.length === 0 || pagina >= totalPaginas - 1) break;
        if (pagina === MAX_PAGINAS - 1) {
          console.warn(
            `⚠️  Ticketmaster: corte en ${MAX_PAGINAS} páginas con ${totalPaginas} anunciadas ` +
              `(${data.page?.totalElements} eventos). Revisar el filtro geográfico.`,
          );
        }
      }

      // El filtro geográfico es el único que nos separa del catálogo nacional, y
      // esta API responde 200 aunque un parámetro no le guste (misma trampa que
      // Luma). Medido: los 131 eventos del radio son de Nuevo León, así que un
      // porcentaje alto de fuera significa que el radio dejó de aplicarse — no
      // un venue nuevo cerca del límite. Lo siguiente que hay es Saltillo, a 85 km.
      const conEstado = eventos.filter((e) => e._embedded?.venues?.[0]?.state?.stateCode);
      const fuera = conEstado.filter((e) => e._embedded?.venues?.[0]?.state?.stateCode !== "NL");
      if (conEstado.length > 0 && fuera.length / conEstado.length > 0.2) {
        throw new Error(
          `Ticketmaster: ${fuera.length}/${conEstado.length} eventos fuera de Nuevo León; ` +
            `el filtro geográfico dejó de aplicarse`,
        );
      }

      // Los segmentos que no están en el mapa se tiraban sin dejar rastro: ni
      // log, ni caída visible del conteo. Medido el 2026-08-05 con la llave de
      // prod, son 2 de 89 (ambos Miscellaneous), así que el mapa está bien como
      // está — pero si un día Ticketmaster mueve las cosas de segmento, esto
      // tiene que verse.
      const ajenos = eventos.filter((e) => {
        const s = e.classifications?.[0]?.segment?.name;
        return !s || !SEGMENT_TO_CATEGORY[s];
      });
      if (ajenos.length > 0) {
        const cuenta = new Map<string, number>();
        for (const e of ajenos) {
          const s = e.classifications?.[0]?.segment?.name ?? "(sin segmento)";
          cuenta.set(s, (cuenta.get(s) ?? 0) + 1);
        }
        const detalle = [...cuenta].map(([s, n]) => `${s}: ${n}`).join(", ");
        console.warn(`⚠️  Ticketmaster: ${ajenos.length}/${eventos.length} descartados por segmento (${detalle})`);
      }

      return eventos.map(mapTicketmasterEvent).filter((e): e is NormalizedEvent => e !== null);
    },
  };
}
