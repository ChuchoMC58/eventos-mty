import { prisma } from "@/lib/db";
import {
  sendPlantilla,
  plantillaRecordatorio,
  confirmarEntrega,
  twilioSender,
  MessageSender,
} from "@/lib/whatsapp";
import { formatCuando } from "@/lib/format";

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
  // Ventana: de AHORA hasta el final de mañana. El inicio es `now` y no
  // "mañana 00:00" a propósito. Con el corte anterior, un recordatorio que
  // rebotaba el día D (típicamente 63016, fuera de la ventana de 24 h) dejaba
  // `reminderSentAt` en null para reintentarlo... pero la corrida siguiente ya
  // buscaba en [D+2, D+3) y el evento —que era de D+1— nunca volvía a entrar:
  // el reintento que promete el `catch` de abajo era imposible. Arrancando en
  // `now`, el evento sigue siendo alcanzable mientras no haya empezado.
  const start = now;
  const end = new Date(now);
  end.setDate(end.getDate() + 2);
  end.setHours(0, 0, 0, 0);

  const saved = await prisma.savedEvent.findMany({
    where: {
      reminder: true,
      reminderSentAt: null,
      event: { status: "activo", startsAt: { gte: start, lt: end } },
      // La baja por WhatsApp apaga TODO, no solo el resumen: un evento guardado
      // con recordatorio activo no la sobreescribe.
      user: { optOutAt: null },
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
    // El enlace a boletos ya no va en el texto: las plantillas no admiten
    // segmentos condicionales, así que el botón apunta SIEMPRE a la página del
    // evento, que es la que enlaza los boletos cuando los hay.
    try {
      const msg = await sendPlantilla(
        s.user.phone,
        plantillaRecordatorio(
          s.event.title,
          formatCuando(s.event.startsAt, now),
          s.event.venue.name,
          s.eventId,
        ),
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
