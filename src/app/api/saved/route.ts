import { prisma } from "@/lib/db";
import { getSessionUserId } from "@/lib/auth/session";

export async function POST(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) return Response.json({ error: "No autenticado" }, { status: 401 });
  const { eventId, reminder } = await req.json().catch(() => ({}));
  if (typeof eventId !== "string") return Response.json({ error: "Datos inválidos" }, { status: 400 });
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) return Response.json({ error: "Evento no existe" }, { status: 404 });
  await prisma.savedEvent.upsert({
    where: { userId_eventId: { userId, eventId } },
    update: { reminder: Boolean(reminder) },
    create: { userId, eventId, reminder: Boolean(reminder) },
  });
  return Response.json({ ok: true });
}

export async function DELETE(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) return Response.json({ error: "No autenticado" }, { status: 401 });
  const { eventId } = await req.json().catch(() => ({}));
  if (typeof eventId !== "string") return Response.json({ error: "Datos inválidos" }, { status: 400 });
  await prisma.savedEvent.deleteMany({ where: { userId, eventId } });
  return Response.json({ ok: true });
}
