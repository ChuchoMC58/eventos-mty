import { prisma } from "@/lib/db";
import { Connector } from "./connector";
import { upsertEvents } from "@/lib/events/upsert";

export interface IngestReport {
  slug: string;
  ok: boolean;
  count: number;
  error?: string;
  dropAlert: boolean; // la fuente traía eventos y ahora trae 0 (o falló): revisar conector
}

export async function runIngest(connectors: Connector[]): Promise<IngestReport[]> {
  const reports: IngestReport[] = [];
  for (const c of connectors) {
    const source = await prisma.source.upsert({
      where: { slug: c.slug },
      update: { name: c.name },
      create: { slug: c.slug, name: c.name },
    });
    const prev = await prisma.sourceRun.findFirst({
      where: { sourceId: source.id, ok: true },
      orderBy: { ranAt: "desc" },
    });
    try {
      const events = await c.fetchEvents();
      await upsertEvents(c.slug, events);
      await prisma.sourceRun.create({
        data: { sourceId: source.id, ok: true, eventCount: events.length },
      });
      reports.push({
        slug: c.slug,
        ok: true,
        count: events.length,
        dropAlert: (prev?.eventCount ?? 0) >= 5 && events.length === 0,
      });
    } catch (err) {
      await prisma.sourceRun.create({
        data: { sourceId: source.id, ok: false, eventCount: 0, error: String(err) },
      });
      reports.push({ slug: c.slug, ok: false, count: 0, error: String(err), dropAlert: true });
    }
  }
  return reports;
}
