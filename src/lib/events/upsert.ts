import { prisma } from "@/lib/db";
import { NormalizedEvent } from "./types";
import { sameEventTitle } from "./normalize";

// Dedupe: mismo venue + mismo día + título similar ⇒ mismo evento.
export async function upsertEvents(
  sourceSlug: string,
  events: NormalizedEvent[],
): Promise<{ created: number; updated: number }> {
  const source = await prisma.source.findUniqueOrThrow({ where: { slug: sourceSlug } });
  let created = 0;
  let updated = 0;

  for (const ev of events) {
    const venue = await prisma.venue.upsert({
      where: { name_city: { name: ev.venue.name, city: ev.city } },
      update: { address: ev.venue.address ?? undefined, zone: ev.venue.zone ?? undefined },
      create: { name: ev.venue.name, address: ev.venue.address, zone: ev.venue.zone, city: ev.city },
    });

    const dayStart = new Date(ev.startsAt);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);

    const candidates = await prisma.event.findMany({
      where: { venueId: venue.id, startsAt: { gte: dayStart, lt: dayEnd } },
    });
    const existing = candidates.find((c) => sameEventTitle(c.title, ev.title));

    if (existing) {
      // Actualiza lo variable; conserva datos existentes cuando la fuente nueva no trae mejores.
      await prisma.event.update({
        where: { id: existing.id },
        data: {
          startsAt: ev.startsAt,
          status: ev.status,
          description: existing.description ?? ev.description,
          ticketUrl: existing.ticketUrl ?? ev.ticketUrl,
          imageUrl: existing.imageUrl ?? ev.imageUrl,
          priceMin: ev.priceMin ?? existing.priceMin,
          priceMax: ev.priceMax ?? existing.priceMax,
          tags: existing.tags.length > 0 ? existing.tags : ev.tags,
        },
      });
      await prisma.eventSource.upsert({
        where: { eventId_sourceId: { eventId: existing.id, sourceId: source.id } },
        update: { lastSeenAt: new Date() },
        create: { eventId: existing.id, sourceId: source.id },
      });
      updated++;
    } else {
      await prisma.event.create({
        data: {
          title: ev.title,
          description: ev.description,
          startsAt: ev.startsAt,
          endsAt: ev.endsAt,
          category: ev.category,
          tags: ev.tags,
          priceMin: ev.priceMin,
          priceMax: ev.priceMax,
          ticketUrl: ev.ticketUrl,
          imageUrl: ev.imageUrl,
          status: ev.status,
          city: ev.city,
          venueId: venue.id,
          sources: { create: { sourceId: source.id } },
        },
      });
      created++;
    }
  }
  return { created, updated };
}
