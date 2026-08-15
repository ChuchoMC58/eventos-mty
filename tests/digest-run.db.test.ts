import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/db";
import { resetDb } from "./helpers/db";
import { runDigest } from "@/lib/digest/run";

/** Variables del envío. Falla claro si el mensaje salió por texto libre en vez de plantilla. */
function varsDe(m: { contentVariables?: string }): Record<string, string> {
  if (!m.contentVariables) throw new Error("el envío fue texto libre, no plantilla");
  return JSON.parse(m.contentVariables);
}
import { MessageSender } from "@/lib/whatsapp";

function recorder(fallaSi?: (to: string) => boolean) {
  const sent: Array<{ to: string; contentSid?: string; contentVariables?: string; body?: string }> = [];
  const sender: MessageSender = {
    create: async (o) => {
      if (fallaSi?.(o.to)) throw new Error("Twilio: 21211 número inválido");
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
    process.env.TWILIO_CONTENT_SID_DIGEST = "HXdigest";
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
      data: { phone: "+528100000001", categories: ["musica"], tags: [], digestDay: 4 },
    });
    await prisma.user.create({
      data: { phone: "+528100000002", categories: ["deportes"], tags: [], digestDay: 4 },
    });
    await prisma.user.create({
      data: { phone: "+528100000003", categories: ["musica"], tags: [], digestDay: 2 }, // hoy no le toca
    });
    const { sent, sender } = recorder();
    const r = await runDigest(now, sender);
    expect(r).toEqual({ sent: 1, skipped: 1, failed: 0 });
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe("whatsapp:+5218100000001");
    // El digest ya no lleva los títulos: la plantilla recibe la cuenta (con su
    // sustantivo, porque el cuerpo aprobado no puede pluralizar) y la ciudad.
    expect(sent[0].contentSid).toBe("HXdigest");
    expect(varsDe(sent[0])).toEqual({ "1": "1 evento", "2": "Monterrey" });
  });

  // El caso que producía "hay 1 eventos": con una sola coincidencia el
  // sustantivo tiene que ir en singular, y con varias en plural. Como el cuerpo
  // de la plantilla es fijo, esto sólo se puede resolver en la variable.
  it("pluraliza la cuenta según cuántos eventos cruzaron", async () => {
    const source = await prisma.source.findFirstOrThrow();
    const venue = await prisma.venue.findFirstOrThrow();
    await prisma.event.create({
      data: {
        title: "Segundo concierto",
        startsAt: new Date("2026-07-21T21:00:00"),
        category: "musica",
        tags: [],
        status: "activo",
        city: "monterrey",
        venueId: venue.id,
        sources: { create: { sourceId: source.id } },
      },
    });
    await prisma.user.create({
      data: { phone: "+528100000001", categories: ["musica"], tags: [], digestDay: 4 },
    });
    const { sent, sender } = recorder();
    await runDigest(now, sender);
    expect(varsDe(sent[0])["1"]).toBe("2 eventos");
  });

  // La ciudad dejó de estar fija en "monterrey": ni se cuentan eventos de otra
  // ciudad ni se le nombra Monterrey a quien no vive ahí.
  it("cada usuario recibe la cuenta y el nombre de SU ciudad", async () => {
    const source = await prisma.source.findFirstOrThrow();
    const gdlVenue = await prisma.venue.create({
      data: { name: "Auditorio GDL", city: "guadalajara" },
    });
    await prisma.event.create({
      data: {
        title: "Concierto tapatío",
        startsAt: new Date("2026-07-20T21:00:00"),
        category: "musica",
        tags: [],
        status: "activo",
        city: "guadalajara",
        venueId: gdlVenue.id,
        sources: { create: { sourceId: source.id } },
      },
    });
    await prisma.user.create({
      data: {
        phone: "+523300000001",
        city: "guadalajara",
        categories: ["musica"],
        tags: [],
        digestDay: 4,
      },
    });
    await prisma.user.create({
      data: { phone: "+528100000001", categories: ["musica"], tags: [], digestDay: 4 },
    });
    const { sent, sender } = recorder();
    await runDigest(now, sender);
    const porNumero = Object.fromEntries(
      sent.map((m) => [m.to, varsDe(m)]),
    );
    // Cada quien ve un solo evento: el de su ciudad, no la suma de las dos.
    expect(porNumero["whatsapp:+5213300000001"]).toEqual({ "1": "1 evento", "2": "Guadalajara" });
    expect(porNumero["whatsapp:+5218100000001"]).toEqual({ "1": "1 evento", "2": "Monterrey" });
  });

  // La baja por WhatsApp gana sobre el digestDay guardado: si no, "baja" sería
  // cosmética y el resumen seguiría llegando el jueves siguiente.
  it("no le manda a quien se dio de baja, aunque le tocara hoy", async () => {
    await prisma.user.create({
      data: {
        phone: "+528100000001",
        categories: ["musica"],
        tags: [],
        digestDay: 4,
        optOutAt: new Date(),
      },
    });
    const { sent, sender } = recorder();

    expect(await runDigest(now, sender)).toEqual({ sent: 0, skipped: 0, failed: 0 });
    expect(sent).toHaveLength(0);
  });

  it("un destinatario que truena no tumba el digest del resto", async () => {
    await prisma.user.create({
      data: { phone: "+528100000001", categories: ["musica"], tags: [], digestDay: 4 },
    });
    await prisma.user.create({
      data: { phone: "+528100000002", categories: ["musica"], tags: [], digestDay: 4 },
    });
    const { sent, sender } = recorder((to) => to.includes("0001"));

    expect(await runDigest(now, sender)).toEqual({ sent: 1, skipped: 0, failed: 1 });
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe("whatsapp:+5218100000002");
  });
});
