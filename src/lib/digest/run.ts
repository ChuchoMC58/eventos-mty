import { prisma } from "@/lib/db";
import { eventMatchesInterests } from "./match";
import { sendPlantilla, plantillaDigest, MessageSender } from "@/lib/whatsapp";
import { nombreCiudad } from "@/lib/format";

export async function runDigest(
  now: Date = new Date(),
  sender?: MessageSender,
): Promise<{ sent: number; skipped: number; failed: number }> {
  // `optOutAt: null` = quien pidió "baja" por WhatsApp no entra ni aunque tenga
  // un `digestDay` guardado de antes.
  const users = await prisma.user.findMany({
    where: { digestDay: now.getDay(), optOutAt: null },
  });
  if (users.length === 0) return { sent: 0, skipped: 0, failed: 0 };
  const horizon = new Date(now);
  horizon.setDate(horizon.getDate() + 10);
  // La ciudad ya no está fija en "monterrey": se traen los eventos de las
  // ciudades que de hecho tienen usuarios hoy (una sola consulta, no una por
  // usuario) y abajo cada quien filtra la suya.
  const ciudades = [...new Set(users.map((u) => u.city))];
  const events = await prisma.event.findMany({
    where: { status: "activo", city: { in: ciudades }, startsAt: { gte: now, lt: horizon } },
    include: { venue: true },
    orderBy: { startsAt: "asc" },
  });

  let sent = 0;
  let skipped = 0;
  let failed = 0;
  for (const user of users) {
    const matched = events.filter((e) => e.city === user.city && eventMatchesInterests(e, user));
    if (matched.length === 0) {
      skipped++; // silencio > relleno
      continue;
    }
    // El digest ya no lleva la lista dentro del mensaje: una plantilla tiene un
    // número FIJO de variables y Meta no acepta parámetros vacíos, así que una
    // plantilla de N eventos truena con quien tenga menos. Va un gancho con la
    // cuenta y un botón a la web.
    try {
      await sendPlantilla(
        user.phone,
        plantillaDigest(matched.length, nombreCiudad(user.city)),
        sender,
      );
      sent++;
    } catch (e) {
      // Un destinatario que truena no debe tumbar el digest de los demás.
      failed++;
      console.error(`Digest falló (${user.phone}): ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return { sent, skipped, failed };
}
