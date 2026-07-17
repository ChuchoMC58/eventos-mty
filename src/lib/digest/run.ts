import { prisma } from "@/lib/db";
import { eventMatchesInterests } from "./match";
import { buildDigestMessage } from "./build";
import { sendWhatsApp, MessageSender } from "@/lib/whatsapp";

export async function runDigest(
  now: Date = new Date(),
  sender?: MessageSender,
): Promise<{ sent: number; skipped: number }> {
  const users = await prisma.user.findMany({ where: { digestDay: now.getDay() } });
  const horizon = new Date(now);
  horizon.setDate(horizon.getDate() + 10);
  const events = await prisma.event.findMany({
    where: { status: "activo", city: "monterrey", startsAt: { gte: now, lt: horizon } },
    include: { venue: true },
    orderBy: { startsAt: "asc" },
  });

  let sent = 0;
  let skipped = 0;
  for (const user of users) {
    const matched = events.filter((e) => eventMatchesInterests(e, user));
    const msg = buildDigestMessage(
      matched.map((e) => ({ title: e.title, startsAt: e.startsAt, venueName: e.venue.name })),
      { webUrl: process.env.BASE_URL ?? "" },
    );
    if (!msg) {
      skipped++; // silencio > relleno
      continue;
    }
    await sendWhatsApp(user.phone, msg, sender);
    sent++;
  }
  return { sent, skipped };
}
