import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/db";
import { resetDb } from "./helpers/db";
import { upsertEvents } from "@/lib/events/upsert";
import { NormalizedEvent } from "@/lib/events/types";

function ev(overrides: Partial<NormalizedEvent> = {}): NormalizedEvent {
  return {
    title: "Luis Miguel Tour 2026",
    startsAt: new Date("2026-09-10T21:00:00"),
    category: "musica",
    tags: [],
    status: "activo",
    venue: { name: "Arena Monterrey" },
    city: "monterrey",
    ...overrides,
  };
}

describe("upsertEvents", () => {
  beforeEach(async () => {
    await resetDb();
    await prisma.source.create({ data: { slug: "ticketmaster", name: "Ticketmaster" } });
    await prisma.source.create({ data: { slug: "arena-monterrey", name: "Arena Monterrey" } });
  });

  it("crea evento y venue nuevos", async () => {
    const r = await upsertEvents("ticketmaster", [ev()]);
    expect(r).toEqual({ created: 1, updated: 0 });
    expect(await prisma.event.count()).toBe(1);
    expect(await prisma.venue.count()).toBe(1);
  });

  it("mismo evento desde dos fuentes → un solo evento con dos EventSource", async () => {
    await upsertEvents("ticketmaster", [ev()]);
    const r = await upsertEvents("arena-monterrey", [ev({ title: "Luis Miguel" })]);
    expect(r).toEqual({ created: 0, updated: 1 });
    expect(await prisma.event.count()).toBe(1);
    expect(await prisma.eventSource.count()).toBe(2);
  });

  it("actualiza estado sin duplicar", async () => {
    await upsertEvents("ticketmaster", [ev()]);
    await upsertEvents("ticketmaster", [ev({ status: "cancelado" })]);
    const events = await prisma.event.findMany();
    expect(events).toHaveLength(1);
    expect(events[0].status).toBe("cancelado");
  });

  it("mismo título en fecha distinta = evento distinto", async () => {
    await upsertEvents("ticketmaster", [ev()]);
    await upsertEvents("ticketmaster", [ev({ startsAt: new Date("2026-09-11T21:00:00") })]);
    expect(await prisma.event.count()).toBe(2);
  });
});
