import { NormalizedEvent, Category, EventStatus } from "@/lib/events/types";

interface JsonLdEvent {
  "@type"?: string | string[];
  name?: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  eventStatus?: string;
  image?: string | string[];
  url?: string;
  location?: { name?: string; address?: string | { streetAddress?: string } };
  offers?: { price?: string | number; url?: string } | Array<{ price?: string | number; url?: string }>;
}

// Recorre el JSON (objetos, arreglos y @graph) juntando todo nodo cuyo @type termine en "Event".
function collectEvents(node: unknown, out: JsonLdEvent[]): void {
  if (Array.isArray(node)) {
    node.forEach((n) => collectEvents(n, out));
    return;
  }
  if (!node || typeof node !== "object") return;
  const obj = node as Record<string, unknown>;
  const rawType = obj["@type"];
  const types = (Array.isArray(rawType) ? rawType : [rawType]).filter(
    (t): t is string => typeof t === "string",
  );
  if (types.some((t) => t === "Event" || t.endsWith("Event"))) out.push(obj as JsonLdEvent);
  if (Array.isArray(obj["@graph"])) collectEvents(obj["@graph"], out);
}

function statusFrom(eventStatus?: string): EventStatus {
  if (!eventStatus) return "activo";
  if (/Cancelled/i.test(eventStatus)) return "cancelado";
  if (/Postponed|Rescheduled/i.test(eventStatus)) return "pospuesto";
  return "activo";
}

export function extractJsonLdEvents(
  html: string,
  defaults: { category: Category; city: string },
): NormalizedEvent[] {
  const blocks = [
    ...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi),
  ].map((m) => m[1]);

  const found: JsonLdEvent[] = [];
  for (const block of blocks) {
    try {
      collectEvents(JSON.parse(block), found);
    } catch {
      // bloque malformado: se ignora, no debe tumbar al conector
    }
  }

  const events: NormalizedEvent[] = [];
  for (const e of found) {
    if (!e.name || !e.startDate) continue;
    const startsAt = new Date(e.startDate);
    if (isNaN(startsAt.getTime())) continue;
    const offer = Array.isArray(e.offers) ? e.offers[0] : e.offers;
    const address =
      typeof e.location?.address === "string" ? e.location.address : e.location?.address?.streetAddress;
    events.push({
      title: e.name,
      description: e.description,
      startsAt,
      endsAt: e.endDate ? new Date(e.endDate) : undefined,
      category: defaults.category,
      tags: [],
      priceMin: offer?.price != null && offer.price !== "" ? Number(offer.price) : undefined,
      ticketUrl: offer?.url ?? e.url,
      imageUrl: Array.isArray(e.image) ? e.image[0] : e.image,
      status: statusFrom(e.eventStatus),
      venue: { name: e.location?.name ?? "Por confirmar", address },
      city: defaults.city,
    });
  }
  return events;
}
