import { prisma } from "@/lib/db";
import { buildIcs } from "@/lib/calendar";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const e = await prisma.event.findUnique({ where: { id }, include: { venue: true } });
  if (!e) return new Response("No encontrado", { status: 404 });
  const ics = buildIcs({
    id: e.id,
    title: e.title,
    startsAt: e.startsAt,
    endsAt: e.endsAt,
    venueName: e.venue.name,
    address: e.venue.address,
    description: e.description,
  });
  return new Response(ics, {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": `attachment; filename="evento.ics"`,
    },
  });
}
