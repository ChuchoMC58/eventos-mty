import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/db";
import { resetDb } from "./helpers/db";
import { runDigest } from "@/lib/digest/run";
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

describe("runDigest", () => {
  const now = new Date("2026-07-16T18:00:00"); // jueves
  beforeEach(async () => {
    process.env.WHATSAPP_TEST_MODE = "false"; // el recorder captura al destinatario real
    process.env.TWILIO_WHATSAPP_FROM = "+14155238886";
    process.env.BASE_URL = "https://eventos-mty.app";
    await resetDb();
    const source = await prisma.source.create({ data: { slug: "s", name: "s" } });
    const venue = await prisma.venue.create({ data: { name: "Arena", city: "monterrey" } });
    await prisma.event.create({
      data: {
        title: "Concierto dentro del rango",
        startsAt: new Date("2026-07-20T21:00:00"),
        category: "musica",
        tags: [],
        status: "activo",
        city: "monterrey",
        venueId: venue.id,
        sources: { create: { sourceId: source.id } },
      },
    });
  });

  it("envía a quien le toca hoy y cruza; omite a quien no cruza", async () => {
    await prisma.user.create({
      data: { phone: "+5281000001", categories: ["musica"], tags: [], digestDay: 4 },
    });
    await prisma.user.create({
      data: { phone: "+5281000002", categories: ["deportes"], tags: [], digestDay: 4 },
    });
    await prisma.user.create({
      data: { phone: "+5281000003", categories: ["musica"], tags: [], digestDay: 2 }, // hoy no le toca
    });
    const { sent, sender } = recorder();
    const r = await runDigest(now, sender);
    expect(r).toEqual({ sent: 1, skipped: 1 });
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe("whatsapp:+5281000001");
    expect(sent[0].body).toContain("Concierto dentro del rango");
  });
});
