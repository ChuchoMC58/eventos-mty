import { prisma } from "@/lib/db";
import { sendWhatsApp, MessageSender } from "@/lib/whatsapp";
import { formatFecha } from "@/lib/format";

export async function runReminders(now: Date = new Date(), sender?: MessageSender): Promise<number> {
  const start = new Date(now);
  start.setDate(start.getDate() + 1);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 1);

  const saved = await prisma.savedEvent.findMany({
    where: {
      reminder: true,
      reminderSentAt: null,
      event: { status: "activo", startsAt: { gte: start, lt: end } },
    },
    include: { event: { include: { venue: true } }, user: true },
  });

  for (const s of saved) {
    const boletos = s.event.ticketUrl ? ` Boletos: ${s.event.ticketUrl}` : "";
    await sendWhatsApp(
      s.user.phone,
      `Recordatorio 📅 Mañana es "${s.event.title}" en ${s.event.venue.name} (${formatFecha(s.event.startsAt)}).${boletos}`,
      sender,
    );
    await prisma.savedEvent.update({
      where: { userId_eventId: { userId: s.userId, eventId: s.eventId } },
      data: { reminderSentAt: new Date() },
    });
  }
  return saved.length;
}
