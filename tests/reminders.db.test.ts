import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/db";
import { resetDb } from "./helpers/db";
import { runReminders } from "@/lib/reminders/run";
import { MessageInfo, MessageSender } from "@/lib/whatsapp";

/** Sender de prueba: `create` registra el envío y `fetch` devuelve el estado final dado. */
function recorder(final?: MessageInfo, fallaSi?: (to: string) => boolean) {
  const sent: Array<{ to: string; body: string }> = [];
  const sender: MessageSender = {
    create: async (o) => {
      if (fallaSi?.(o.to)) throw new Error("Twilio: 21211 número inválido");
      sent.push(o);
      return final ? { sid: "SM1", status: "queued" } : {};
    },
    fetch: async (sid) => ({ sid, ...final }),
  };
  return { sent, sender };
}

// Sin esperas reales entre reintentos: el estado final ya viene del `fetch` falso.
const YA = [0];

describe("runReminders", () => {
  const now = new Date("2026-07-16T10:00:00");

  async function setup(
    overrides: { reminder?: boolean; startsAt?: Date; status?: string; phone?: string } = {},
  ) {
    const source = await prisma.source.upsert({
      where: { slug: "s" },
      update: {},
      create: { slug: "s", name: "s" },
    });
    const venue = await prisma.venue.upsert({
      where: { name_city: { name: "Arena", city: "monterrey" } },
      update: {},
      create: { name: "Arena", city: "monterrey" },
    });
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
    const user = await prisma.user.create({ data: { phone: overrides.phone ?? "+5281000001" } });
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
    expect((await runReminders(now, sender, YA)).enviados).toBe(1);
    expect(sent[0].body).toContain("Mañana");
    expect(sent[0].body).toContain("Concierto");
    expect((await runReminders(now, sender, YA)).enviados).toBe(0); // ya enviado
  });

  it("no envía sin opt-in", async () => {
    await setup({ reminder: false });
    const { sender } = recorder();
    expect((await runReminders(now, sender, YA)).enviados).toBe(0);
  });

  it("no envía si el evento no es mañana", async () => {
    await setup({ startsAt: new Date("2026-07-19T21:00:00") });
    const { sender } = recorder();
    expect((await runReminders(now, sender, YA)).enviados).toBe(0);
  });

  it("no envía si el evento se canceló", async () => {
    await setup({ status: "cancelado" });
    const { sender } = recorder();
    expect((await runReminders(now, sender, YA)).enviados).toBe(0);
  });

  it("marca la entrega confirmada con su sid y estado", async () => {
    await setup();
    const { sender } = recorder({ status: "delivered" });
    expect(await runReminders(now, sender, YA)).toEqual({ enviados: 1, fallidos: 0, indecisos: 0 });

    const s = await prisma.savedEvent.findFirstOrThrow();
    expect(s.reminderSentAt).not.toBeNull();
    expect(s.reminderStatus).toBe("delivered");
    expect(s.reminderSid).toBe("SM1");
    expect(s.reminderError).toBeNull();
  });

  it("un mensaje que rebota NO se marca como enviado y se reintenta después", async () => {
    await setup();
    const { sender } = recorder({
      status: "failed",
      errorCode: 63016,
      errorMessage: "fuera de la ventana de 24 h",
    });
    expect(await runReminders(now, sender, YA)).toEqual({ enviados: 0, fallidos: 1, indecisos: 0 });

    const s = await prisma.savedEvent.findFirstOrThrow();
    expect(s.reminderSentAt).toBeNull(); // lo que antes se marcaba en falso
    expect(s.reminderStatus).toBe("failed");
    expect(s.reminderError).toContain("63016");

    // Sigue siendo elegible: la siguiente corrida lo reintenta y ahí sí entrega.
    const ok = recorder({ status: "delivered" });
    expect((await runReminders(now, ok.sender, YA)).enviados).toBe(1);
    expect(ok.sent).toHaveLength(1);
    expect((await prisma.savedEvent.findFirstOrThrow()).reminderError).toBeNull();
  });

  it("cuenta como enviado el que no alcanza estado final, para no duplicar", async () => {
    await setup();
    const { sender } = recorder({ status: "sending" });
    expect(await runReminders(now, sender, YA)).toEqual({ enviados: 1, fallidos: 0, indecisos: 1 });
    expect((await prisma.savedEvent.findFirstOrThrow()).reminderSentAt).not.toBeNull();
  });

  it("un destinatario que truena no tumba el resto del lote", async () => {
    await setup({ phone: "+5281000001" });
    await setup({ phone: "+5281000002" });
    const { sent, sender } = recorder({ status: "delivered" }, (to) => to.includes("0001"));

    expect(await runReminders(now, sender, YA)).toEqual({ enviados: 1, fallidos: 1, indecisos: 0 });
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe("whatsapp:+5281000002");

    const malo = await prisma.savedEvent.findFirstOrThrow({
      where: { user: { phone: "+5281000001" } },
    });
    expect(malo.reminderSentAt).toBeNull();
    expect(malo.reminderError).toContain("21211");
  });
});
