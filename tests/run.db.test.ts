import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/db";
import { resetDb } from "./helpers/db";
import { runIngest } from "@/lib/ingest/run";
import { Connector } from "@/lib/ingest/connector";
import { NormalizedEvent } from "@/lib/events/types";

const sampleEvent: NormalizedEvent = {
  title: "Evento de prueba",
  startsAt: new Date("2026-10-01T20:00:00"),
  category: "musica",
  tags: [],
  status: "activo",
  venue: { name: "Venue Prueba" },
  city: "monterrey",
};

function conn(slug: string, impl: () => Promise<NormalizedEvent[]>): Connector {
  return { slug, name: slug, fetchEvents: impl };
}

describe("runIngest", () => {
  beforeEach(resetDb);

  it("un conector que falla no detiene a los demás", async () => {
    const reports = await runIngest([
      conn("roto", async () => {
        throw new Error("página caída");
      }),
      conn("sano", async () => [sampleEvent]),
    ]);
    expect(reports[0].ok).toBe(false);
    expect(reports[0].error).toContain("página caída");
    expect(reports[1].ok).toBe(true);
    expect(reports[1].count).toBe(1);
    expect(await prisma.event.count()).toBe(1);
    expect(await prisma.sourceRun.count()).toBe(2);
  });

  it("alerta cuando una fuente pasa de traer eventos a traer cero", async () => {
    const many = Array.from({ length: 6 }, (_, i) => ({
      ...sampleEvent,
      title: `Evento ${i}`,
    }));
    await runIngest([conn("fuente", async () => many)]);
    const [second] = await runIngest([conn("fuente", async () => [])]);
    expect(second.dropAlert).toBe(true);
  });

  it("crea el Source automáticamente si no existe", async () => {
    await runIngest([conn("nueva-fuente", async () => [])]);
    expect(await prisma.source.findUnique({ where: { slug: "nueva-fuente" } })).not.toBeNull();
  });
});
