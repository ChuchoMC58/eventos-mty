import { prisma } from "@/lib/db";
import { sendWhatsApp, confirmarEntrega, twilioSender, MessageSender } from "@/lib/whatsapp";
import { formatFecha } from "@/lib/format";

export interface ResultadoRecordatorios {
  enviados: number;
  fallidos: number;
  /** Enviados sin confirmación de entrega: se marcan igual, para no duplicar. */
  indecisos: number;
}

export async function runReminders(
  now: Date = new Date(),
  sender?: MessageSender,
  esperas?: number[],
): Promise<ResultadoRecordatorios> {
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

  const res: ResultadoRecordatorios = { enviados: 0, fallidos: 0, indecisos: 0 };
  // El mismo sender para enviar y para releer el estado: sin el `fetch` de esta
  // instancia no habría con qué confirmar la entrega. Se crea solo si hay envíos.
  let cliente = sender;

  for (const s of saved) {
    cliente ??= twilioSender();
    const where = { userId_eventId: { userId: s.userId, eventId: s.eventId } };
    const boletos = s.event.ticketUrl ? ` Boletos: ${s.event.ticketUrl}` : "";
    try {
      const msg = await sendWhatsApp(
        s.user.phone,
        `Recordatorio 📅 Mañana es "${s.event.title}" en ${s.event.venue.name} (${formatFecha(s.event.startsAt)}).${boletos}`,
        cliente,
      );
      // Un `create()` sin excepción NO significa entregado. Solo se marca como
      // enviado si el estado final no es un rebote; si rebotó, reminderSentAt
      // queda en null y el recordatorio sigue siendo elegible para el próximo run.
      const entrega = await confirmarEntrega(msg, cliente, esperas);
      if (!entrega.entregado && !entrega.indeciso) {
        res.fallidos++;
        console.error(`Recordatorio rebotado (${s.user.phone}, ${s.event.title}): ${entrega.error}`);
        await prisma.savedEvent.update({
          where,
          data: {
            reminderSid: msg.sid ?? null,
            reminderStatus: entrega.status ?? null,
            reminderError: entrega.error ?? null,
          },
        });
        continue;
      }
      if (entrega.indeciso) res.indecisos++;
      res.enviados++;
      await prisma.savedEvent.update({
        where,
        data: {
          reminderSentAt: new Date(),
          reminderSid: msg.sid ?? null,
          reminderStatus: entrega.status ?? null,
          reminderError: null,
        },
      });
    } catch (e) {
      // Un destinatario que truena no debe tumbar el resto del lote.
      res.fallidos++;
      const detalle = e instanceof Error ? e.message : String(e);
      console.error(`Recordatorio falló (${s.user.phone}, ${s.event.title}): ${detalle}`);
      await prisma.savedEvent.update({
        where,
        data: { reminderStatus: "error", reminderError: detalle },
      });
    }
  }
  return res;
}
