import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import { arenaMonterreyConnector } from "@/lib/ingest/sources/arena-monterrey";

const fixture = readFileSync(path.join(__dirname, "fixtures", "arena-monterrey.json"), "utf8");

function fakeFetch(body: string, status = 200) {
  return (async () => new Response(body, { status })) as unknown as typeof fetch;
}

describe("arenaMonterreyConnector", () => {
  it("aplana fechas múltiples y descarta inactivos y sin fecha", async () => {
    const events = await arenaMonterreyConnector(fakeFetch(fixture)).fetchEvents();
    // Rosalía (2 fechas) + WWE (1) = 3; el inactivo y el sin fechas no salen.
    expect(events).toHaveLength(3);
    expect(events[0].title).toBe("LUX TOUR 2026: ROSALÍA");
    expect(events[1].title).toBe("LUX TOUR 2026: ROSALÍA");
    expect(events[0].startsAt.toISOString()).toBe("2026-09-13T03:00:00.000Z"); // 21:00 -06:00
    expect(events[1].startsAt.toISOString()).toBe("2026-09-14T03:00:00.000Z");
  });

  it("prefiere el link de la fecha y cae al del evento", async () => {
    const events = await arenaMonterreyConnector(fakeFetch(fixture)).fetchEvents();
    expect(events[0].ticketUrl).toBe("https://www.superboletos.com/landing-evento/rosalia-12sep");
    expect(events[1].ticketUrl).toBe("https://www.superboletos.com/landing-evento/rosalia");
  });

  it("clasifica deportes por keywords y música por default", async () => {
    const events = await arenaMonterreyConnector(fakeFetch(fixture)).fetchEvents();
    expect(events[0].category).toBe("musica");
    expect(events[2].category).toBe("deportes"); // WWE
  });

  it("reescribe imágenes a https y usa el venue canónico", async () => {
    const events = await arenaMonterreyConnector(fakeFetch(fixture)).fetchEvents();
    expect(events[0].imageUrl).toMatch(/^https:\/\//);
    expect(events[2].imageUrl).toMatch(/^https:\/\/.*wwe\.webp$/); // banner si no hay square
    expect(events[0].venue.name).toBe("Arena Monterrey"); // igual que TM para el dedupe
  });

  it("lanza error en HTTP no-200 (para que el runner lo registre)", async () => {
    await expect(arenaMonterreyConnector(fakeFetch("[]", 500)).fetchEvents()).rejects.toThrow("500");
  });
});
