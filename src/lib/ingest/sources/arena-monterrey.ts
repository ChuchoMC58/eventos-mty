import { Connector } from "@/lib/ingest/connector";
import { NormalizedEvent, Category } from "@/lib/events/types";

// API pública del sitio de la Arena (la cartelera es una SPA sin JSON-LD; los
// datos salen de api.arenamonterrey.com). location=10 = ARENA MONTERREY.
const API_URL =
  "https://api.arenamonterrey.com/next_event_dates" +
  "?page=1&zignia=false&page_size=100&month_filter=0&year_filter=0&location=10&category_filter=0";

// El venue debe llamarse igual que en Ticketmaster para que el dedupe
// (venue + día + título similar) fusione los eventos que traen ambas fuentes.
const VENUE = { name: "Arena Monterrey", address: "Av. Francisco I. Madero 2500, Col. Obrera" };

interface ArenaEventDate {
  date?: string | null;
  link_to_tickets?: string | null;
  location_id?: number | null;
}

interface ArenaEvent {
  active?: boolean;
  title?: string;
  description?: string | null;
  link_to_tickets?: string | null;
  square_banner_aws?: string | null;
  banner_aws?: string | null;
  event_dates?: ArenaEventDate[];
}

// Las "categorías" del API son géneros musicales; casi todo es música salvo
// los shows deportivos obvios.
const DEPORTES = [/\bwwe\b/i, /globetrotters/i, /lucha libre/i, /\bbox(eo)?\b/i];

function categoryFrom(title: string): Category {
  return DEPORTES.some((re) => re.test(title)) ? "deportes" : "musica";
}

// Los banners vienen como http://; el host sí sirve https y así evitamos
// mixed content en la web.
function httpsImage(url?: string | null): string | undefined {
  if (!url) return undefined;
  return url.replace(/^http:\/\//, "https://");
}

export function mapArenaEvent(e: ArenaEvent): NormalizedEvent[] {
  if (!e.title || e.active === false) return [];
  const title = e.title.trim();
  const out: NormalizedEvent[] = [];
  for (const d of e.event_dates ?? []) {
    if (!d.date) continue;
    out.push({
      title,
      description: e.description?.trim() || undefined,
      startsAt: new Date(d.date), // trae offset -06:00
      category: categoryFrom(title),
      tags: [],
      ticketUrl: d.link_to_tickets ?? e.link_to_tickets ?? undefined,
      imageUrl: httpsImage(e.square_banner_aws ?? e.banner_aws),
      status: "activo",
      venue: VENUE,
      city: "monterrey",
    });
  }
  return out;
}

export function arenaMonterreyConnector(fetchFn: typeof fetch = fetch): Connector {
  return {
    slug: "arena-monterrey",
    name: "Arena Monterrey",
    async fetchEvents() {
      const res = await fetchFn(API_URL);
      if (!res.ok) throw new Error(`Arena Monterrey HTTP ${res.status}`);
      const data = (await res.json()) as ArenaEvent[];
      return data.flatMap(mapArenaEvent);
    },
  };
}
