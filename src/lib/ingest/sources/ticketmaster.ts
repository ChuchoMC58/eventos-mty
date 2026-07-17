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
  _embedded?: { venues?: Array<{ name?: string; address?: { line1?: string } }> };
}

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
      const url =
        `https://app.ticketmaster.com/discovery/v2/events.json` +
        `?city=Monterrey&countryCode=MX&size=100&apikey=${key}`;
      const res = await fetchFn(url);
      if (!res.ok) throw new Error(`Ticketmaster HTTP ${res.status}`);
      const data = (await res.json()) as { _embedded?: { events?: TmEvent[] } };
      return (data._embedded?.events ?? [])
        .map(mapTicketmasterEvent)
        .filter((e): e is NormalizedEvent => e !== null);
    },
  };
}
