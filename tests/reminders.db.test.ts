import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/db";
import { resetDb } from "./helpers/db";
import { runReminders } from "@/lib/reminders/run";
import { MessageSender } from "@/lib/whatsapp";

function recorder() {
  const sent: Array<{ to: string; body: string }> = [];
  const sender: MessageSender = {
    create: async (o) => {
      sent.push(o);
      return {};
    },
  };
  return { sent, sender };
}

describe("runReminders", () => {
  const now = new Date("2026-07-16T10:00:00");

  async function setup(overrides: { reminder?: boolean; startsAt?: Date; status?: string } = {}) {
    const source = await prisma.source.create({ data: { slug: "s", name: "s" } });
    const venue = await prisma.venue.create({ data: { name: "Arena", city: "monterrey" } });
    const event = await prisma.event.create({
      data: {
        title: "Concierto",
        startsAt: overrides.startsAt ?? new Date("2026-07-17T21:00:00"), // mañana
        category: "musica",
        tags: [],
        status: overrides.status ?? "activo",
        city: "monterrey",
        venueId: venue.id,
        sources: { create: { sourceId: source.id } },
      },
    });
    const user = await prisma.user.create({ data: { phone: "+5281000001" } });
    await prisma.savedEvent.create({
      data: { userId: user.id, eventId: event.id, reminder: overrides.reminder ?? true },
    });
  }

  beforeEach(async () => {
    process.env.WHATSAPP_TEST_MODE = "false";
    process.env.TWILIO_WHATSAPP_FROM = "+14155238886";
    await resetDb();
  });

  it("envía para evento de mañana con recordatorio activado, sin repetir", async () => {
    await setup();
    const { sent, sender } = recorder();
    expect(await runReminders(now, sender)).toBe(1);
    expect(sent[0].body).toContain("Mañana");
    expect(sent[0].body).toContain("Concierto");
    expect(await runReminders(now, sender)).toBe(0); // ya enviado
  });

  it("no envía sin opt-in", async () => {
    await setup({ reminder: false });
    const { sender } = recorder();
    expect(await runReminders(now, sender)).toBe(0);
  });

  it("no envía si el evento no es mañana", async () => {
    await setup({ startsAt: new Date("2026-07-19T21:00:00") });
    const { sender } = recorder();
    expect(await runReminders(now, sender)).toBe(0);
  });

  it("no envía si el evento se canceló", async () => {
    await setup({ status: "cancelado" });
    const { sender } = recorder();
    expect(await runReminders(now, sender)).toBe(0);
  });
});
