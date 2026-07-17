import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import { ticketmasterConnector } from "@/lib/ingest/sources/ticketmaster";

const fixture = readFileSync(path.join(__dirname, "fixtures", "ticketmaster.json"), "utf8");

function fakeFetch(body: string, status = 200) {
  return (async () => new Response(body, { status })) as unknown as typeof fetch;
}

describe("ticketmasterConnector", () => {
  process.env.TICKETMASTER_API_KEY = "test-key";

  it("mapea segmentos a categorías y descarta los desconocidos", async () => {
    const events = await ticketmasterConnector(fakeFetch(fixture)).fetchEvents();
    expect(events).toHaveLength(2);
    expect(events[0].category).toBe("deportes");
    expect(events[0].tags).toContain("soccer");
    expect(events[0].venue.name).toBe("Estadio BBVA");
    expect(events[0].priceMin).toBe(300);
    expect(events[0].priceMax).toBe(2500);
    expect(events[1].category).toBe("cultura");
    expect(events[1].status).toBe("cancelado");
  });

  it("lanza error en HTTP no-200 (para que el runner lo registre)", async () => {
    await expect(ticketmasterConnector(fakeFetch("{}", 500)).fetchEvents()).rejects.toThrow("500");
  });
});
